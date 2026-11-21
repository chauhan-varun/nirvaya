import { describe, it, expect } from "vitest"
import { getDb } from "@/server/db"
import {
  users,
  tenants,
  patients,
  observations,
  auditEvents,
  outboxEvents,
} from "@/server/db/schema"
import { upsertUserFromClerk } from "@/server/db/repositories/users"
import { recordObservationAtomic } from "@/server/db/repositories/observations"
import { eq } from "drizzle-orm"

interface OutboxObservationPayload {
  numericValue: string
  observationId: string
  patientId: string
  type: string
  unit: string
}

describe("PostgreSQL Integration & Repository Contracts", () => {
  it("upserts user from Clerk subject idempotently", async () => {
    const clerkSubject = `test_clerk_${Date.now()}`

    const user1 = await upsertUserFromClerk({
      clerkSubject,
      preferredLocale: "en",
    })

    expect(user1.id).toBeDefined()
    expect(user1.clerkSubject).toBe(clerkSubject)
    expect(user1.preferredLocale).toBe("en")

    // Repeated upsert must return the same user ID
    const user2 = await upsertUserFromClerk({
      clerkSubject,
      preferredLocale: "hi",
    })

    expect(user2.id).toBe(user1.id)
    expect(user2.preferredLocale).toBe("hi")
  })

  it("atomically records observation, audit event, and outbox event in one transaction", async () => {
    const db = getDb()

    // Setup tenant, user, patient
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Personal Care Space" })
      .returning()
    const [user] = await db
      .insert(users)
      .values({ clerkSubject: `clerk_obs_${Date.now()}` })
      .returning()
    const [patient] = await db
      .insert(patients)
      .values({ tenantId: tenant.id, ownerUserId: user.id })
      .returning()

    const observedAt = new Date()
    const result = await recordObservationAtomic({
      observation: {
        tenantId: tenant.id,
        patientId: patient.id,
        type: "glucose_fasting",
        numericValue: "105.50",
        unit: "mg/dL",
        observedAt,
        source: "manual",
        recordedByUserId: user.id,
      },
      actorId: user.id,
      requestId: "req_atomic_test_1",
      purpose: "daily_monitoring",
    })

    expect(result.observation.id).toBeDefined()
    expect(result.observation.numericValue).toBe("105.50")
    expect(result.outboxEventId).toBeDefined()

    // Verify outbox entry exists
    const [outbox] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, result.outboxEventId))
    expect(outbox).toBeDefined()
    expect(outbox.eventType).toBe("observation.recorded")
    const payload = outbox.payload as unknown as OutboxObservationPayload
    expect(payload.numericValue).toBe("105.50")

    // Verify audit entry exists
    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, result.observation.id))
    expect(audits.length).toBe(1)
    expect(audits[0].action).toBe("observation.record")
    expect(audits[0].decision).toBe("allow")
  })

  it("enforces composite foreign key preventing cross-tenant observation injection", async () => {
    const db = getDb()

    // Create Tenant A and Tenant B
    const [tenantA] = await db
      .insert(tenants)
      .values({ name: "Tenant A" })
      .returning()
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: "Tenant B" })
      .returning()

    const [user] = await db
      .insert(users)
      .values({ clerkSubject: `clerk_cross_${Date.now()}` })
      .returning()

    // Patient belongs to Tenant A
    const [patientA] = await db
      .insert(patients)
      .values({ tenantId: tenantA.id, ownerUserId: user.id })
      .returning()

    // Attempting to record an observation for Patient A under Tenant B MUST violate composite FK
    await expect(
      db.insert(observations).values({
        tenantId: tenantB.id, // Mismatched tenant!
        patientId: patientA.id,
        type: "glucose_fasting",
        numericValue: "110.00",
        unit: "mg/dL",
        observedAt: new Date(),
        source: "manual",
      })
    ).rejects.toThrow()
  })
})
