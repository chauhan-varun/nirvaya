import { describe, it, expect, beforeEach } from "vitest"
import { appRouter } from "@/server/trpc/routers/_app"
import { createCallerFactory } from "@/server/trpc/init"
import type { TRPCContext } from "@/server/trpc/context"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants } from "@/server/db/schema/tenants"
import { consentGrants } from "@/server/db/schema/consent"
import { auditEvents } from "@/server/db/schema/events"
import { eq } from "drizzle-orm"

describe("tRPC Onboarding Router", () => {
  const createCaller = createCallerFactory(appRouter)

  const testClerkSubject = "user_clerk_onboard_test_999"

  const authCtx: TRPCContext = {
    userId: testClerkSubject,
    sessionId: "sess_test_onboard",
    orgId: null,
    requestId: "req_test_onboard",
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

  beforeEach(async () => {
    const db = getDb()
    // Clean up test records
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
        await db.delete(auditEvents).where(eq(auditEvents.tenantId, p.tenantId))
        await db.delete(consentGrants).where(eq(consentGrants.tenantId, p.tenantId))
        await db.delete(patients).where(eq(patients.id, p.id))
        await db.delete(tenants).where(eq(tenants.id, p.tenantId))
      }
      await db.delete(users).where(eq(users.id, u.id))
    }
  })

  it("blocks unauthenticated access to status and submit", async () => {
    const caller = createCaller(unauthCtx)

    await expect(caller.onboarding.status()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })

    await expect(
      caller.onboarding.submit({
        preferredName: "Test User",
        yearOfBirth: 1990,
        gender: "female",
        healthDataConsent: true,
        preferredLocale: "en",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("reports onboarding incomplete when user is not registered", async () => {
    const caller = createCaller(authCtx)
    const status = await caller.onboarding.status()

    expect(status.completed).toBe(false)
    expect(status.patient).toBeNull()
  })

  it("rejects submission if preferredName is too short (<2 chars)", async () => {
    const caller = createCaller(authCtx)

    await expect(
      caller.onboarding.submit({
        preferredName: "A",
        yearOfBirth: 1990,
        gender: "female",
        healthDataConsent: true,
        preferredLocale: "en",
      })
    ).rejects.toThrowError()
  })

  it("rejects submission if user is underage (< 18 years old)", async () => {
    const caller = createCaller(authCtx)
    const currentYear = new Date().getFullYear()

    await expect(
      caller.onboarding.submit({
        preferredName: "Minor User",
        yearOfBirth: currentYear - 10, // 10 years old
        gender: "other",
        healthDataConsent: true,
        preferredLocale: "en",
      })
    ).rejects.toThrowError(/adult metabolic health management/)
  })

  it("rejects submission if health data processing consent is not granted", async () => {
    const caller = createCaller(authCtx)

    await expect(
      caller.onboarding.submit({
        preferredName: "Consent Refuser",
        yearOfBirth: 1985,
        gender: "male",
        healthDataConsent: false,
        preferredLocale: "en",
      })
    ).rejects.toThrowError(/Explicit health data processing consent is required/)
  })

  it("completes onboarding atomically and updates status to completed", async () => {
    const caller = createCaller(authCtx)

    const submitResult = await caller.onboarding.submit({
      preferredName: "Rohan Patel",
      yearOfBirth: 1988,
      gender: "male",
      healthDataConsent: true,
      preferredLocale: "en",
    })

    expect(submitResult.success).toBe(true)
    expect(submitResult.patientId).toBeDefined()
    expect(submitResult.tenantId).toBeDefined()

    // Verify status query reflects completed patient record
    const status = await caller.onboarding.status()
    expect(status.completed).toBe(true)
    expect(status.patient).toMatchObject({
      name: "Rohan Patel",
      yearOfBirth: 1988,
      gender: "male",
      tenantId: submitResult.tenantId,
    })
  })

  it("handles audio transcription when SARVAM_API_KEY is not configured", async () => {
    const caller = createCaller(authCtx)
    const prevKey = process.env.SARVAM_API_KEY
    delete process.env.SARVAM_API_KEY

    try {
      await expect(
        caller.onboarding.transcribeAudio({
          audioBase64: Buffer.from("dummy-audio-bytes").toString("base64"),
          mimeType: "audio/webm",
        })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      })
    } finally {
      if (prevKey) process.env.SARVAM_API_KEY = prevKey
    }
  })
})
