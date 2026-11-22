import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest"
import { getNeo4jDriver, closeNeo4jDriver, withNeo4jSession } from "@/server/graph/driver"
import { initializeGraphSchema } from "@/server/graph/schema"
import {
  projectOutboxEventToNeo4j,
  projectPendingOutboxEvents,
} from "@/server/graph/projector"
import { getAuthorizedCareGraphInsights } from "@/server/graph/retrieval"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants } from "@/server/db/schema/tenants"
import { consentGrants } from "@/server/db/schema/consent"
import { outboxEvents } from "@/server/db/schema/events"
import { eq, and } from "drizzle-orm"
import { appRouter } from "@/server/trpc/routers/_app"
import { createCallerFactory } from "@/server/trpc/init"
import type { TRPCContext } from "@/server/trpc/context"

const createCaller = createCallerFactory(appRouter)

const TEST_OWNER_CLERK = "user_clerk_graph_owner_test_101"
const TEST_CAREGIVER_CLERK = "user_clerk_graph_caregiver_test_102"
const TEST_OTHER_CLERK = "user_clerk_graph_other_test_103"

describe("Neo4j Graph Projections & Grounded Retrieval", () => {
  beforeAll(async () => {
    // 1. Initialize schema constraints
    await initializeGraphSchema()
  })

  afterAll(async () => {
    await closeNeo4jDriver()
  })

  beforeEach(async () => {
    // Clean test data in Neo4j
    await withNeo4jSession(async (session) => {
      await session.run(`
        MATCH (n)
        WHERE n.id STARTS WITH 'test_' OR n.tenantId STARTS WITH 'test_'
        DETACH DELETE n
      `)
      await session.run(`
        MATCH (pr:ProjectionReceipt)
        WHERE pr.eventId STARTS WITH 'test_'
        DETACH DELETE pr
      `)
    })

    // Clean test data in PostgreSQL
    const db = getDb()
    for (const clerkSub of [
      TEST_OWNER_CLERK,
      TEST_CAREGIVER_CLERK,
      TEST_OTHER_CLERK,
    ]) {
      const uList = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkSubject, clerkSub))

      for (const u of uList) {
        const pList = await db
          .select({ id: patients.id, tenantId: patients.tenantId })
          .from(patients)
          .where(eq(patients.ownerUserId, u.id))

        for (const p of pList) {
          await db
            .delete(outboxEvents)
            .where(eq(outboxEvents.tenantId, p.tenantId))
          await db
            .delete(consentGrants)
            .where(eq(consentGrants.tenantId, p.tenantId))
          await db.delete(patients).where(eq(patients.id, p.id))
          await db.delete(tenants).where(eq(tenants.id, p.tenantId))
        }
        await db.delete(users).where(eq(users.id, u.id))
      }
    }
  })

  // ─── 1. Constraints & Schema ─────────────────────────────────────────────

  it("enforces uniqueness constraints on canonical IDs", async () => {
    await withNeo4jSession(async (session) => {
      const res = await session.run(`SHOW CONSTRAINTS`)
      const names = res.records.map((r) => r.get("name"))
      expect(names).toContain("user_id_unique")
      expect(names).toContain("patient_id_unique")
      expect(names).toContain("consent_id_unique")
      expect(names).toContain("tenant_id_unique")
    })
  })

  // ─── 2. Idempotent Replay & Monotonic Versioning ─────────────────────────

  it("handles duplicate outbox delivery idempotently without creating duplicate nodes", async () => {
    const event = {
      id: "test_evt_replay_001",
      tenantId: "test_tenant_001",
      aggregateType: "patient",
      aggregateId: "test_patient_replay_001",
      aggregateVersion: 1,
      eventType: "patient.created",
      payload: {
        ownerUserId: "test_user_replay_001",
        preferredName: "Replay Patient",
        yearOfBirth: 1985,
        gender: "female",
      },
    }

    // Deliver first time
    const r1 = await projectOutboxEventToNeo4j(event)
    expect(r1).toBe(true)

    // Deliver exact same event second time (replay)
    const r2 = await projectOutboxEventToNeo4j(event)
    expect(r2).toBe(true)

    // Verify only 1 patient node exists
    await withNeo4jSession(async (session) => {
      const res = await session.run(
        `MATCH (p:Patient { id: $id }) RETURN count(p) as count`,
        { id: event.aggregateId }
      )
      const count = res.records[0].get("count")
      expect(Number(count)).toBe(1)
    })
  })

  it("handles out-of-order event delivery without overwriting newer state", async () => {
    const patientId = "test_patient_ooo_001"
    const tenantId = "test_tenant_ooo_001"

    // Newer event (version 2) arrives first
    const v2Event = {
      id: "test_evt_v2",
      tenantId,
      aggregateType: "patient",
      aggregateId: patientId,
      aggregateVersion: 2,
      eventType: "patient.created",
      payload: {
        ownerUserId: "test_user_ooo_001",
        preferredName: "Newer Name",
        yearOfBirth: 1990,
        gender: "female",
      },
    }
    await projectOutboxEventToNeo4j(v2Event)

    // Stale/delayed older event (version 1) arrives second
    const v1Event = {
      id: "test_evt_v1",
      tenantId,
      aggregateType: "patient",
      aggregateId: patientId,
      aggregateVersion: 1,
      eventType: "patient.created",
      payload: {
        ownerUserId: "test_user_ooo_001",
        preferredName: "Stale Name",
        yearOfBirth: 1970,
        gender: "male",
      },
    }
    await projectOutboxEventToNeo4j(v1Event)

    // Verify patient node retained version 2 state
    await withNeo4jSession(async (session) => {
      const res = await session.run(
        `MATCH (p:Patient { id: $id }) RETURN p.gender as gender, p._version as version`,
        { id: patientId }
      )
      expect(res.records[0].get("gender")).toBe("female")
      expect(Number(res.records[0].get("version"))).toBe(2)
    })
  })

  // ─── 3. Observation Summary Projections (Privacy Preserving) ────────────

  it("projects observation summaries without storing raw free-text notes", async () => {
    const patientId = "test_patient_obs_001"
    const tenantId = "test_tenant_obs_001"

    await projectOutboxEventToNeo4j({
      id: "test_evt_obs_1",
      tenantId,
      aggregateType: "patient",
      aggregateId: patientId,
      aggregateVersion: 1,
      eventType: "observation.recorded",
      payload: {
        patientId,
        type: "glucose_fasting",
        numericValue: "105.00",
        unit: "mg/dL",
        notes: "Sensitive clinical free text that should NOT enter graph",
        observedAt: "2026-11-20T08:00:00Z",
      },
    })

    await projectOutboxEventToNeo4j({
      id: "test_evt_obs_2",
      tenantId,
      aggregateType: "patient",
      aggregateId: patientId,
      aggregateVersion: 2,
      eventType: "observation.recorded",
      payload: {
        patientId,
        type: "glucose_fasting",
        numericValue: "112.00",
        unit: "mg/dL",
        notes: "Another private comment",
        observedAt: "2026-11-21T08:00:00Z",
      },
    })

    // Verify node properties
    await withNeo4jSession(async (session) => {
      const res = await session.run(
        `MATCH (o:ObservationSummary { id: $id }) RETURN o`,
        { id: `${patientId}_glucose_fasting` }
      )
      const props = res.records[0].get("o").properties
      expect(Number(props.count)).toBe(2)
      expect(props.unit).toBe("mg/dL")
      expect(props.latestObservedAt).toBe("2026-11-21T08:00:00Z")
      // Crucial: no free-text notes property
      expect(props.notes).toBeUndefined()
    })
  })

  // ─── 4. Precedence of PostgreSQL Authorization over Graph ───────────────

  it("immediately denies access when consent is revoked in Postgres, even before graph sync", async () => {
    const db = getDb()

    // Setup owner, caregiver, tenant, patient in PostgreSQL
    const [tenant] = await db
      .insert(tenants)
      .values({ kind: "personal", name: "Graph Precedence Tenant" })
      .returning()

    const [owner] = await db
      .insert(users)
      .values({ clerkSubject: TEST_OWNER_CLERK })
      .returning()

    const [caregiver] = await db
      .insert(users)
      .values({ clerkSubject: TEST_CAREGIVER_CLERK })
      .returning()

    const [patient] = await db
      .insert(patients)
      .values({
        tenantId: tenant.id,
        ownerUserId: owner.id,
        name: "Graph Patient",
        yearOfBirth: 1980,
      })
      .returning()

    // Create an active consent grant in PostgreSQL
    const [grant] = await db
      .insert(consentGrants)
      .values({
        tenantId: tenant.id,
        patientId: patient.id,
        grantorUserId: owner.id,
        granteeUserId: caregiver.id,
        scopes: ["view_glucose"],
        purpose: "Care support",
        policyVersion: "1.0",
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning()

    // Project patient and active consent to Neo4j
    await projectOutboxEventToNeo4j({
      id: "test_p_sync",
      tenantId: tenant.id,
      aggregateType: "patient",
      aggregateId: patient.id,
      aggregateVersion: 1,
      eventType: "patient.created",
      payload: {
        ownerUserId: owner.id,
        preferredName: "Graph Patient",
        yearOfBirth: 1980,
      },
    })

    await projectOutboxEventToNeo4j({
      id: "test_c_sync",
      tenantId: tenant.id,
      aggregateType: "consent",
      aggregateId: grant.id,
      aggregateVersion: 1,
      eventType: "consent.granted",
      payload: {
        consentId: grant.id,
        tenantId: tenant.id,
        patientId: patient.id,
        grantorUserId: owner.id,
        granteeUserId: caregiver.id,
        scopes: ["view_glucose"],
        purpose: "Care support",
        policyVersion: "1.0",
      },
    })

    // Step 1: Caregiver CAN access graph insights while active
    const insightsActive = await getAuthorizedCareGraphInsights({
      clerkSubject: TEST_CAREGIVER_CLERK,
      patientId: patient.id,
      tenantId: tenant.id,
      requiredScope: "view_glucose",
    })
    expect(insightsActive.patientId).toBe(patient.id)

    // Step 2: Revoke consent in canonical PostgreSQL ONLY (simulate graph sync delay)
    await db
      .update(consentGrants)
      .set({ revokedAt: new Date() })
      .where(eq(consentGrants.id, grant.id))

    // Step 3: Retrieval must immediately be BLOCKED with FORBIDDEN, even though
    // Neo4j still has the active edge!
    await expect(
      getAuthorizedCareGraphInsights({
        clerkSubject: TEST_CAREGIVER_CLERK,
        patientId: patient.id,
        tenantId: tenant.id,
        requiredScope: "view_glucose",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  // ─── 5. Revocation Tombstone in Neo4j ────────────────────────────────────

  it("removes active GRANTS_TO relationship when consent.revoked event is projected", async () => {
    const consentId = "test_consent_rev_001"
    const patientId = "test_patient_rev_001"
    const tenantId = "test_tenant_rev_001"
    const grantorId = "test_user_rev_grantor"
    const granteeId = "test_user_rev_grantee"

    // Project grant
    await projectOutboxEventToNeo4j({
      id: "test_evt_rev_1",
      tenantId,
      aggregateType: "consent",
      aggregateId: consentId,
      aggregateVersion: 1,
      eventType: "consent.granted",
      payload: {
        consentId,
        tenantId,
        patientId,
        grantorUserId: grantorId,
        granteeUserId: granteeId,
        scopes: ["view_glucose"],
        purpose: "Revoke test",
        policyVersion: "1.0",
      },
    })

    // Verify relationship exists
    await withNeo4jSession(async (session) => {
      const res = await session.run(
        `MATCH (c:Consent { id: $id })-[r:GRANTS_TO]->(u:User) RETURN count(r) as count`,
        { id: consentId }
      )
      expect(Number(res.records[0].get("count"))).toBe(1)
    })

    // Project revocation
    await projectOutboxEventToNeo4j({
      id: "test_evt_rev_2",
      tenantId,
      aggregateType: "consent",
      aggregateId: consentId,
      aggregateVersion: 2,
      eventType: "consent.revoked",
      payload: {
        consentId,
        revokedAt: new Date().toISOString(),
      },
    })

    // Verify GRANTS_TO edge was removed and node status updated
    await withNeo4jSession(async (session) => {
      const res = await session.run(
        `MATCH (c:Consent { id: $id })
         OPTIONAL MATCH (c)-[r:GRANTS_TO]->(u:User)
         RETURN c.status as status, count(r) as edgeCount`,
        { id: consentId }
      )
      expect(res.records[0].get("status")).toBe("revoked")
      expect(Number(res.records[0].get("edgeCount"))).toBe(0)
    })
  })

  // ─── 6. Outbox Worker Catchup ───────────────────────────────────────────

  it("processes pending PostgreSQL outbox events and transitions status to completed", async () => {
    const db = getDb()

    const [tenant] = await db
      .insert(tenants)
      .values({ kind: "personal", name: "Worker Tenant" })
      .returning()

    // Insert an outbox event
    const [evt] = await db
      .insert(outboxEvents)
      .values({
        tenantId: tenant.id,
        aggregateType: "patient",
        aggregateId: "test_worker_patient_001",
        aggregateVersion: 1,
        eventType: "patient.created",
        payload: {
          ownerUserId: "test_worker_user_001",
          preferredName: "Worker Patient",
          yearOfBirth: 1995,
        },
      })
      .returning()

    // Run outbox drain worker
    const workerResult = await projectPendingOutboxEvents(10, tenant.id)
    expect(workerResult.processed).toBeGreaterThanOrEqual(1)

    // Check PostgreSQL status changed to 'completed'
    const [updatedEvt] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, evt.id))

    expect(updatedEvt.status).toBe("completed")

    // Clean up
    await db.delete(outboxEvents).where(eq(outboxEvents.id, evt.id))
    await db.delete(tenants).where(eq(tenants.id, tenant.id))
  })
})
