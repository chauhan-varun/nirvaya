import { describe, it, expect, beforeEach } from "vitest"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants, memberships } from "@/server/db/schema/tenants"
import { riskAssessments } from "@/server/db/schema/risk"
import { auditEvents, outboxEvents } from "@/server/db/schema/events"
import { appRouter } from "@/server/trpc/routers/_app"
import { calculateIDRS } from "@/server/db/repositories/risk"
import { eq, and } from "drizzle-orm"

const CLERK_RISK_USER = "user_clerk_risk_test"
const CLERK_NON_ONBOARDED_USER = "user_clerk_risk_non_onboarded"

function createCallerForUser(clerkUserId: string) {
  return appRouter.createCaller({
    userId: clerkUserId,
    sessionId: null,
    orgId: null,
    requestId: `req_risk_test_${Date.now()}`,
    origin: "http://localhost:3000",
    host: "localhost:3000",
  })
}

describe("Task 4: Explainable Screening & Risk Factors (MDRF-IDRS)", () => {
  let tenantId: string
  let userId: string
  let patientId: string

  beforeEach(async () => {
    const db = getDb()

    // Clean up test data
    await db.delete(riskAssessments).execute()
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkSubject, CLERK_RISK_USER))
    for (const u of existingUsers) {
      await db.delete(patients).where(eq(patients.ownerUserId, u.id))
      await db.delete(memberships).where(eq(memberships.userId, u.id))
      await db.delete(users).where(eq(users.id, u.id))
    }

    // Seed test tenant, user, patient
    const [t] = await db
      .insert(tenants)
      .values({ name: "Risk Test Space", kind: "personal", status: "active" })
      .returning()
    tenantId = t.id

    const [u] = await db
      .insert(users)
      .values({ clerkSubject: CLERK_RISK_USER })
      .returning()
    userId = u.id

    await db.insert(memberships).values({
      tenantId,
      userId,
      role: "owner",
      status: "active",
    })

    const [p] = await db
      .insert(patients)
      .values({
        tenantId,
        ownerUserId: userId,
        name: "Test Patient",
        yearOfBirth: 1985,
        gender: "male",
      })
      .returning()
    patientId = p.id
  })

  describe("Deterministic Pure Scoring Logic (calculateIDRS)", () => {
    it("evaluates Low Risk reference case accurately (score < 30)", () => {
      const result = calculateIDRS({
        ageYears: 28,
        gender: "female",
        waistCircumferenceCm: 72,
        physicalActivity: "vigorous",
        familyHistory: "none",
        alreadyDiagnosed: false,
      })

      expect(result.status).toBe("completed")
      expect(result.alreadyDiagnosed).toBe(false)
      expect(result.ageScore).toBe(0)
      expect(result.waistScore).toBe(0)
      expect(result.activityScore).toBe(0)
      expect(result.familyHistoryScore).toBe(0)
      expect(result.totalScore).toBe(0)
      expect(result.riskTier).toBe("low")
      expect(result.breakdown.factors).toHaveLength(4)
      expect(result.breakdown.instrument).toBe("MDRF-IDRS")
    })

    it("evaluates Moderate Risk reference case accurately (score 30-59)", () => {
      const result = calculateIDRS({
        ageYears: 42, // 20 pts
        gender: "male",
        waistCircumferenceCm: 90, // 10 pts (85-99 cm)
        physicalActivity: "moderate", // 10 pts
        familyHistory: "one_parent", // 10 pts
        alreadyDiagnosed: false,
      })

      expect(result.status).toBe("completed")
      expect(result.totalScore).toBe(50)
      expect(result.ageScore).toBe(20)
      expect(result.waistScore).toBe(10)
      expect(result.activityScore).toBe(10)
      expect(result.familyHistoryScore).toBe(10)
      expect(result.riskTier).toBe("moderate")
    })

    it("evaluates High Risk reference case accurately (score >= 60)", () => {
      const result = calculateIDRS({
        ageYears: 56, // 30 pts
        gender: "female",
        waistCircumferenceCm: 95, // 20 pts (>= 90 cm for female)
        physicalActivity: "sedentary", // 30 pts
        familyHistory: "both_parents", // 20 pts
        alreadyDiagnosed: false,
      })

      expect(result.status).toBe("completed")
      expect(result.totalScore).toBe(100)
      expect(result.ageScore).toBe(30)
      expect(result.waistScore).toBe(20)
      expect(result.activityScore).toBe(30)
      expect(result.familyHistoryScore).toBe(20)
      expect(result.riskTier).toBe("high")
    })

    it("excludes already-diagnosed users from preventive screening calculation", () => {
      const result = calculateIDRS({
        ageYears: 55,
        gender: "male",
        waistCircumferenceCm: 95,
        physicalActivity: "sedentary",
        familyHistory: "both_parents",
        alreadyDiagnosed: true,
      })

      expect(result.status).toBe("diagnosed_excluded")
      expect(result.alreadyDiagnosed).toBe(true)
      expect(result.totalScore).toBeNull()
      expect(result.riskTier).toBe("not_applicable")
      expect(result.clinicalSummary).toContain("Prior diagnosis of diabetes")
    })

    it("rejects incomplete or invalid parameters without fabricating scores", () => {
      const result = calculateIDRS({
        ageYears: 14, // below adult cutoff
        gender: "male",
        waistCircumferenceCm: 80,
        physicalActivity: "moderate",
        familyHistory: "none",
        alreadyDiagnosed: false,
      })

      expect(result.status).toBe("incomplete")
      expect(result.totalScore).toBeNull()
      expect(result.riskTier).toBe("not_applicable")
    })
  })

  describe("Router Integration & Persistence", () => {
    it("evaluates preview via evaluatePreview without writing to database", async () => {
      const caller = createCallerForUser(CLERK_RISK_USER)
      const preview = await caller.risk.evaluatePreview({
        ageYears: 38,
        gender: "male",
        waistCircumferenceCm: 86,
        physicalActivity: "mild",
        familyHistory: "none",
        alreadyDiagnosed: false,
      })

      expect(preview.status).toBe("completed")
      expect(preview.totalScore).toBe(50) // 20 + 10 + 20 + 0

      // Verify no record saved
      const latest = await caller.risk.latest()
      expect(latest.assessment).toBeNull()
    })

    it("atomically assesses and persists immutable snapshot with audit event", async () => {
      const caller = createCallerForUser(CLERK_RISK_USER)
      const res = await caller.risk.assess({
        ageYears: 45,
        gender: "male",
        waistCircumferenceCm: 88,
        physicalActivity: "moderate",
        familyHistory: "one_parent",
        alreadyDiagnosed: false,
      })

      expect(res.success).toBe(true)
      expect(res.assessment.totalScore).toBe(50)
      expect(res.assessment.riskTier).toBe("moderate")

      // Verify latest endpoint retrieves it
      const latest = await caller.risk.latest()
      expect(latest.assessment).not.toBeNull()
      expect(latest.assessment?.totalScore).toBe(50)
      expect(latest.assessment?.riskTier).toBe("moderate")

      // Verify audit event recorded
      const db = getDb()
      const audit = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.tenantId, tenantId),
            eq(auditEvents.action, "risk_assessment.created")
          )
        )
      expect(audit).toHaveLength(1)
    })

    it("rejects non-onboarded users with PRECONDITION_FAILED", async () => {
      const caller = createCallerForUser(CLERK_NON_ONBOARDED_USER)
      await expect(
        caller.risk.assess({
          ageYears: 30,
          gender: "female",
          waistCircumferenceCm: 70,
          physicalActivity: "moderate",
          familyHistory: "none",
          alreadyDiagnosed: false,
        })
      ).rejects.toThrow("User profile not found. Please complete onboarding first.")
    })
  })
})
