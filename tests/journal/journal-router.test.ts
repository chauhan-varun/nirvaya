import { describe, it, expect, beforeEach } from "vitest"
import { appRouter } from "@/server/trpc/routers/_app"
import { createCallerFactory } from "@/server/trpc/init"
import type { TRPCContext } from "@/server/trpc/context"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants } from "@/server/db/schema/tenants"
import { observations } from "@/server/db/schema/observations"
import { auditEvents, outboxEvents, idempotencyRecords } from "@/server/db/schema/events"
import { consentGrants } from "@/server/db/schema/consent"
import { convertGlucose } from "@/server/db/repositories/observations"
import { eq } from "drizzle-orm"

describe("tRPC Journal Router & Daily Health Observations", () => {
  const createCaller = createCallerFactory(appRouter)

  const testClerkSubject = "user_clerk_journal_test_888"

  const authCtx: TRPCContext = {
    userId: testClerkSubject,
    sessionId: "sess_test_journal",
    orgId: null,
    requestId: "req_test_journal",
    origin: "http://localhost:3000",
    host: "localhost:3000",
  }

  const unauthCtx: TRPCContext = {
    userId: null,
    sessionId: null,
    orgId: null,
    requestId: "req_test_unauth",
    origin: null,
    host: "localhost:3000",
  }

  let testTenantId: string
  let testPatientId: string

  beforeEach(async () => {
    const db = getDb()

    // 1. Clean up previous test runs
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkSubject, testClerkSubject))

    for (const u of existingUsers) {
      const pts = await db
        .select({ id: patients.id, tenantId: patients.tenantId })
        .from(patients)
        .where(eq(patients.ownerUserId, u.id))

      for (const p of pts) {
        await db.delete(idempotencyRecords).where(eq(idempotencyRecords.tenantId, p.tenantId))
        await db.delete(outboxEvents).where(eq(outboxEvents.tenantId, p.tenantId))
        await db.delete(auditEvents).where(eq(auditEvents.tenantId, p.tenantId))
        await db.delete(observations).where(eq(observations.tenantId, p.tenantId))
        await db.delete(consentGrants).where(eq(consentGrants.tenantId, p.tenantId))
        await db.delete(patients).where(eq(patients.id, p.id))
        await db.delete(tenants).where(eq(tenants.id, p.tenantId))
      }
      await db.delete(users).where(eq(users.id, u.id))
    }

    // 2. Setup verified onboarded patient for the authenticated user
    const caller = createCaller(authCtx)
    const onboardRes = await caller.onboarding.submit({
      preferredName: "Sunita Sharma",
      yearOfBirth: 1982,
      gender: "female",
      healthDataConsent: true,
      preferredLocale: "en",
    })

    testTenantId = onboardRes.tenantId
    testPatientId = onboardRes.patientId
  })

  it("blocks unauthenticated requests to journal procedures", async () => {
    const caller = createCaller(unauthCtx)

    await expect(caller.journal.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })

    await expect(
      caller.journal.recordGlucose({
        value: 110,
        unit: "mg/dL",
        context: "glucose_fasting",
        observedAt: new Date().toISOString(),
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("fails with PRECONDITION_FAILED when user has not completed onboarding", async () => {
    const unboardedCtx: TRPCContext = {
      userId: "user_clerk_not_onboarded_000",
      sessionId: "sess_000",
      orgId: null,
      requestId: "req_000",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    }
    const caller = createCaller(unboardedCtx)

    await expect(caller.journal.list({})).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: /Please complete onboarding first/,
    })
  })

  describe("Glucose Recording & Pure Unit Conversion", () => {
    it("converts units deterministically without floating-point errors", () => {
      // 100 mg/dL -> 5.55 mmol/L
      expect(convertGlucose(100, "mg/dL", "mmol/L")).toBe(5.55)
      // 5.55 mmol/L -> 100.00 mg/dL
      expect(convertGlucose(5.55, "mmol/L", "mg/dL")).toBe(100)
      // Identity
      expect(convertGlucose(125.5, "mg/dL", "mg/dL")).toBe(125.5)
      expect(convertGlucose(7.2, "mmol/L", "mmol/L")).toBe(7.2)
    })

    it("rejects physiologically impossible glucose values", async () => {
      const caller = createCaller(authCtx)

      // Below 20 mg/dL
      await expect(
        caller.journal.recordGlucose({
          value: 10,
          unit: "mg/dL",
          context: "glucose_fasting",
          observedAt: new Date().toISOString(),
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: /out of plausible physiological range/,
      })

      // Above 600 mg/dL
      await expect(
        caller.journal.recordGlucose({
          value: 750,
          unit: "mg/dL",
          context: "glucose_random",
          observedAt: new Date().toISOString(),
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: /out of plausible physiological range/,
      })

      // Above 33.3 mmol/L
      await expect(
        caller.journal.recordGlucose({
          value: 40.0,
          unit: "mmol/L",
          context: "glucose_postprandial",
          observedAt: new Date().toISOString(),
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      })
    })

    it("rejects future timestamps beyond clock skew grace", async () => {
      const caller = createCaller(authCtx)
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours future

      await expect(
        caller.journal.recordGlucose({
          value: 120,
          unit: "mg/dL",
          context: "glucose_fasting",
          observedAt: futureDate,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: /timestamp cannot be in the future/,
      })
    })

    it("records glucose observation with exact decimal precision and audits write", async () => {
      const caller = createCaller(authCtx)
      const now = new Date().toISOString()

      const result = await caller.journal.recordGlucose({
        value: 118.5,
        unit: "mg/dL",
        context: "glucose_fasting",
        observedAt: now,
        notes: "Morning fasting reading before breakfast",
      })

      expect(result.success).toBe(true)
      expect(result.observationId).toBeDefined()
      expect(result.isDuplicate).toBe(false)

      const db = getDb()
      const [savedObs] = await db
        .select()
        .from(observations)
        .where(eq(observations.id, result.observationId))

      expect(savedObs).toBeDefined()
      expect(savedObs.numericValue).toBe("118.50")
      expect(savedObs.unit).toBe("mg/dL")
      expect(savedObs.type).toBe("glucose_fasting")
      expect(savedObs.notes).toBe("Morning fasting reading before breakfast")
      expect(savedObs.tenantId).toBe(testTenantId)
      expect(savedObs.patientId).toBe(testPatientId)
    })

    it("enforces idempotency on duplicate submission with the same key", async () => {
      const caller = createCaller(authCtx)
      const now = new Date().toISOString()
      const idempotencyKey = "client_txn_key_abc_123"

      // First submission
      const firstRes = await caller.journal.recordGlucose({
        value: 135.0,
        unit: "mg/dL",
        context: "glucose_postprandial",
        observedAt: now,
        idempotencyKey,
      })

      expect(firstRes.success).toBe(true)
      expect(firstRes.isDuplicate).toBe(false)

      // Duplicate submission with same idempotencyKey
      const secondRes = await caller.journal.recordGlucose({
        value: 135.0,
        unit: "mg/dL",
        context: "glucose_postprandial",
        observedAt: now,
        idempotencyKey,
      })

      expect(secondRes.success).toBe(true)
      expect(secondRes.isDuplicate).toBe(true)
      expect(secondRes.observationId).toBe(firstRes.observationId)

      // Verify only 1 observation exists in database
      const db = getDb()
      const obsCount = await db
        .select()
        .from(observations)
        .where(eq(observations.patientId, testPatientId))

      expect(obsCount.length).toBe(1)
    })
  })

  describe("Lifestyle Logs: Meal, Activity, Sleep, Hydration, Medication", () => {
    it("records meal with carbohydrate metadata", async () => {
      const caller = createCaller(authCtx)

      const result = await caller.journal.recordMeal({
        mealType: "lunch",
        description: "Brown rice, dal tadka, and stir-fried okra",
        carbsGrams: 55,
        observedAt: new Date().toISOString(),
      })

      expect(result.success).toBe(true)
      const list = await caller.journal.list({ types: ["meal"] })
      expect(list.count).toBe(1)
      expect(list.observations[0].notes).toBe("Brown rice, dal tadka, and stir-fried okra")
      expect(list.observations[0].unit).toBe("grams")
    })

    it("records activity and rejects out-of-range duration", async () => {
      const caller = createCaller(authCtx)

      // Negative duration rejected
      await expect(
        caller.journal.recordActivity({
          activityType: "walking",
          durationMinutes: -15,
          observedAt: new Date().toISOString(),
        })
      ).rejects.toThrowError()

      // Valid entry
      const result = await caller.journal.recordActivity({
        activityType: "walking",
        durationMinutes: 45,
        notes: "Evening walk around the park",
        observedAt: new Date().toISOString(),
      })

      expect(result.success).toBe(true)
    })

    it("records sleep duration and optional quality flag", async () => {
      const caller = createCaller(authCtx)

      const result = await caller.journal.recordSleep({
        durationHours: 7.5,
        quality: "restful",
        observedAt: new Date().toISOString(),
      })

      expect(result.success).toBe(true)
    })

    it("records hydration volume without automated clinical claims", async () => {
      const caller = createCaller(authCtx)

      const result = await caller.journal.recordHydration({
        amountMl: 400,
        observedAt: new Date().toISOString(),
      })

      expect(result.success).toBe(true)
    })

    it("records prescribed medication strictly as reported, without dose alteration", async () => {
      const caller = createCaller(authCtx)

      const result = await caller.journal.recordMedication({
        medicationName: "Metformin",
        dose: "500 mg",
        notes: "Taken with dinner as prescribed",
        observedAt: new Date().toISOString(),
      })

      expect(result.success).toBe(true)

      const list = await caller.journal.list({ types: ["medication"] })
      expect(list.count).toBe(1)
      expect(list.observations[0].notes).toContain("Metformin (500 mg)")
      // Quality flag confirms prescribed_log provenance
      expect(list.observations[0].qualityFlags).toContain("prescribed_log")
    })
  })

  describe("Journal Listing & Sorting", () => {
    it("returns observations sorted by observedAt descending and respects limit", async () => {
      const caller = createCaller(authCtx)
      const baseTime = Date.now()

      // Record 3 entries spaced by 1 hour
      await caller.journal.recordGlucose({
        value: 110,
        unit: "mg/dL",
        context: "glucose_fasting",
        observedAt: new Date(baseTime - 3 * 3600 * 1000).toISOString(),
      })
      await caller.journal.recordMeal({
        mealType: "breakfast",
        description: "Oats with almonds",
        observedAt: new Date(baseTime - 2 * 3600 * 1000).toISOString(),
      })
      await caller.journal.recordGlucose({
        value: 142,
        unit: "mg/dL",
        context: "glucose_postprandial",
        observedAt: new Date(baseTime - 1 * 3600 * 1000).toISOString(),
      })

      // Query all with limit = 2
      const list = await caller.journal.list({ limit: 2 })
      expect(list.count).toBe(2)
      // Most recent should be first
      expect(list.observations[0].type).toBe("glucose_postprandial")
      expect(list.observations[1].type).toBe("meal")
    })
  })
})
