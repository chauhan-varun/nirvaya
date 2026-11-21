import { describe, it, expect, beforeEach } from "vitest"
import { appRouter } from "@/server/trpc/routers/_app"
import { createCallerFactory } from "@/server/trpc/init"
import type { TRPCContext } from "@/server/trpc/context"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants } from "@/server/db/schema/tenants"
import { careCircleInvitations } from "@/server/db/schema/invitations"
import { consentGrants, consentEvents } from "@/server/db/schema/consent"
import { auditEvents } from "@/server/db/schema/events"
import { eq, and } from "drizzle-orm"
import { generateInviteToken, digestToken } from "@/server/db/repositories/care-circle"

const createCaller = createCallerFactory(appRouter)

// ─── Test identities ─────────────────────────────────────────────────────────

const OWNER_CLERK = "user_clerk_care_owner_test_001"
const INVITEE_CLERK = "user_clerk_care_invitee_test_002"
const INVITEE_EMAIL = "invitee-care-test@example.com"
const OTHER_CLERK = "user_clerk_care_other_test_003"

const ownerCtx: TRPCContext = {
  userId: OWNER_CLERK,
  sessionId: "sess_care_owner",
  orgId: null,
  requestId: "req_care_owner",
  origin: "http://localhost:3000",
  host: "localhost:3000",
}

const inviteeCtx: TRPCContext = {
  userId: INVITEE_CLERK,
  sessionId: "sess_care_invitee",
  orgId: null,
  requestId: "req_care_invitee",
  origin: "http://localhost:3000",
  host: "localhost:3000",
}

const otherCtx: TRPCContext = {
  userId: OTHER_CLERK,
  sessionId: "sess_care_other",
  orgId: null,
  requestId: "req_care_other",
  origin: "http://localhost:3000",
  host: "localhost:3000",
}

const unauthCtx: TRPCContext = {
  userId: null,
  sessionId: null,
  orgId: null,
  requestId: "req_unauth",
  origin: null,
  host: "localhost:3000",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupOwner() {
  const db = getDb()

  const [tenant] = await db
    .insert(tenants)
    .values({ kind: "personal", name: "Care Test Tenant" })
    .returning({ id: tenants.id })

  const [user] = await db
    .insert(users)
    .values({ clerkSubject: OWNER_CLERK })
    .returning({ id: users.id })
    .onConflictDoUpdate({
      target: users.clerkSubject,
      set: { clerkSubject: OWNER_CLERK },
    })

  const [patient] = await db
    .insert(patients)
    .values({
      tenantId: tenant.id,
      ownerUserId: user.id,
      name: "Care Test Owner",
      yearOfBirth: 1988,
    })
    .returning({ id: patients.id, tenantId: patients.tenantId })

  return { tenant, user, patient }
}

async function setupInvitee() {
  const db = getDb()
  const [user] = await db
    .insert(users)
    .values({ clerkSubject: INVITEE_CLERK })
    .returning({ id: users.id })
    .onConflictDoUpdate({
      target: users.clerkSubject,
      set: { clerkSubject: INVITEE_CLERK },
    })
  return { user }
}

async function cleanupByClerkSubject(clerkSubject: string) {
  const db = getDb()
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkSubject, clerkSubject))

  for (const u of existing) {
    const pts = await db
      .select({ id: patients.id, tenantId: patients.tenantId })
      .from(patients)
      .where(eq(patients.ownerUserId, u.id))

    for (const p of pts) {
      await db.delete(careCircleInvitations).where(
        eq(careCircleInvitations.tenantId, p.tenantId)
      )
      await db.delete(consentGrants).where(
        eq(consentGrants.tenantId, p.tenantId)
      )
      await db.delete(auditEvents).where(
        and(eq(auditEvents.tenantId, p.tenantId))
      )
      await db.delete(patients).where(eq(patients.id, p.id))
      const [t] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, p.tenantId))
      if (t) await db.delete(tenants).where(eq(tenants.id, t.id))
    }

    await db.delete(users).where(eq(users.id, u.id))
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("tRPC Care Circle Router", () => {
  beforeEach(async () => {
    await cleanupByClerkSubject(OWNER_CLERK)
    await cleanupByClerkSubject(INVITEE_CLERK)
    await cleanupByClerkSubject(OTHER_CLERK)
  })

  // ─── Authentication guard ───────────────────────────────────────────────

  describe("Authentication", () => {
    it("rejects unauthenticated invite", async () => {
      const caller = createCaller(unauthCtx)
      await expect(
        caller.careCircle.invite({
          inviteeEmail: INVITEE_EMAIL,
          requestedScopes: ["view_glucose"],
          purpose: "Test",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    })

    it("rejects unauthenticated history", async () => {
      const caller = createCaller(unauthCtx)
      await expect(caller.careCircle.history({})).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })
  })

  // ─── Preconditions (no onboarding) ─────────────────────────────────────

  describe("Preconditions", () => {
    it("requires onboarding before invite", async () => {
      const caller = createCaller(ownerCtx)
      await expect(
        caller.careCircle.invite({
          inviteeEmail: INVITEE_EMAIL,
          requestedScopes: ["view_glucose"],
          purpose: "Test",
        })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" })
    })
  })

  // ─── Happy path ─────────────────────────────────────────────────────────

  describe("Happy path", () => {
    it("creates an invitation and returns a raw token (single exposure)", async () => {
      await setupOwner()
      const caller = createCaller(ownerCtx)

      const result = await caller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose", "view_weight"],
        purpose: "Family health support",
        ttlHours: 1,
      })

      expect(result.invitationId).toMatch(/^[0-9a-f-]{36}$/)
      expect(result.rawToken).toBeTruthy()
      expect(result.rawToken.length).toBeGreaterThan(20)
      expect(result.scopes).toContain("view_glucose")
      expect(result.scopes).toContain("view_weight")

      // Verify digest stored, not raw token
      const db = getDb()
      const rows = await db
        .select()
        .from(careCircleInvitations)
        .where(eq(careCircleInvitations.id, result.invitationId))

      expect(rows[0].tokenDigest).not.toEqual(result.rawToken)
      expect(rows[0].tokenDigest).toEqual(digestToken(result.rawToken))
      expect(rows[0].status).toEqual("pending")
    })

    it("populates the history with the pending invitation", async () => {
      await setupOwner()
      const caller = createCaller(ownerCtx)

      await caller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Support check",
      })

      const history = await caller.careCircle.history({})
      expect(history.entries.length).toBeGreaterThan(0)
      expect(history.entries[0].inviteeEmail).toEqual(INVITEE_EMAIL)
      expect(history.entries[0].status).toEqual("pending")
    })

    it("accepts invitation and creates a consent grant", async () => {
      await setupOwner()
      await setupInvitee()

      const ownerCaller = createCaller(ownerCtx)
      const inviteResult = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Family monitoring",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      const acceptResult = await inviteeCaller.careCircle.accept({
        rawToken: inviteResult.rawToken,
        acceptorEmail: INVITEE_EMAIL,
      })

      expect(acceptResult.consentGrantId).toMatch(/^[0-9a-f-]{36}$/)
      expect(acceptResult.scopes).toContain("view_glucose")

      // Verify invitation is now accepted and consumed
      const db = getDb()
      const rows = await db
        .select()
        .from(careCircleInvitations)
        .where(eq(careCircleInvitations.id, inviteResult.invitationId))

      expect(rows[0].status).toEqual("accepted")
      expect(rows[0].tokenConsumed).toEqual(true)
      expect(rows[0].consentGrantId).toEqual(acceptResult.consentGrantId)

      // Verify consent grant exists and is active
      const grants = await db
        .select()
        .from(consentGrants)
        .where(eq(consentGrants.id, acceptResult.consentGrantId))

      expect(grants[0].revokedAt).toBeNull()
    })

    it("revokes access and marks grant as revoked immediately", async () => {
      await setupOwner()
      await setupInvitee()

      const ownerCaller = createCaller(ownerCtx)
      const { rawToken, invitationId } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Monitoring",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      const { consentGrantId } = await inviteeCaller.careCircle.accept({
        rawToken,
        acceptorEmail: INVITEE_EMAIL,
      })

      const revokeResult = await ownerCaller.careCircle.revokeAccess({
        consentGrantId,
      })
      expect(revokeResult.success).toEqual(true)

      // Grant must be immediately revoked in canonical PostgreSQL
      const db = getDb()
      const grants = await db
        .select()
        .from(consentGrants)
        .where(eq(consentGrants.id, consentGrantId))

      expect(grants[0].revokedAt).not.toBeNull()

      // History must show revoked
      const history = await ownerCaller.careCircle.history({})
      const entry = history.entries.find((e) => e.invitationId === invitationId)
      expect(entry?.consentActive).toEqual(false)
    })

    it("cancels a pending invitation", async () => {
      await setupOwner()
      const caller = createCaller(ownerCtx)

      const { invitationId } = await caller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_weight"],
        purpose: "Test cancel",
      })

      const result = await caller.careCircle.cancelInvitation({ invitationId })
      expect(result.success).toEqual(true)

      const history = await caller.careCircle.history({})
      const entry = history.entries.find((e) => e.invitationId === invitationId)
      expect(entry?.status).toEqual("revoked")
    })
  })

  // ─── Security / negative tests ──────────────────────────────────────────

  describe("Security — negative cases", () => {
    it("rejects replay of a used token", async () => {
      await setupOwner()
      await setupInvitee()

      const ownerCaller = createCaller(ownerCtx)
      const { rawToken } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Replay test",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      await inviteeCaller.careCircle.accept({
        rawToken,
        acceptorEmail: INVITEE_EMAIL,
      })

      // Attempt replay with same token
      await expect(
        inviteeCaller.careCircle.accept({
          rawToken,
          acceptorEmail: INVITEE_EMAIL,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("rejects acceptance with wrong email (binding check)", async () => {
      await setupOwner()
      await setupInvitee()

      const ownerCaller = createCaller(ownerCtx)
      const { rawToken } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Wrong email test",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      await expect(
        inviteeCaller.careCircle.accept({
          rawToken,
          acceptorEmail: "someone-else@example.com",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("rejects cancellation of another owner's invitation", async () => {
      await setupOwner()

      // Set up a second owner
      const db = getDb()
      const [t2] = await db.insert(tenants).values({ kind: "personal", name: "Isolation Tenant" }).returning({ id: tenants.id })
      const [u2] = await db.insert(users).values({ clerkSubject: OTHER_CLERK }).returning({ id: users.id })
        .onConflictDoUpdate({ target: users.clerkSubject, set: { clerkSubject: OTHER_CLERK } })
      await db.insert(patients).values({ tenantId: t2.id, ownerUserId: u2.id, name: "Other" })

      const ownerCaller = createCaller(ownerCtx)
      const { invitationId } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Isolation test",
      })

      // Other user tries to cancel owner's invitation
      const otherCaller = createCaller(otherCtx)
      await expect(
        otherCaller.careCircle.cancelInvitation({ invitationId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("rejects revocation of another owner's grant", async () => {
      await setupOwner()
      await setupInvitee()

      const db = getDb()
      const [t2] = await db.insert(tenants).values({ kind: "personal", name: "Isolation Tenant 2" }).returning({ id: tenants.id })
      const [u2] = await db.insert(users).values({ clerkSubject: OTHER_CLERK }).returning({ id: users.id })
        .onConflictDoUpdate({ target: users.clerkSubject, set: { clerkSubject: OTHER_CLERK } })
      await db.insert(patients).values({ tenantId: t2.id, ownerUserId: u2.id, name: "Other2" })

      const ownerCaller = createCaller(ownerCtx)
      const { rawToken, invitationId } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Isolation grant test",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      const { consentGrantId } = await inviteeCaller.careCircle.accept({
        rawToken,
        acceptorEmail: INVITEE_EMAIL,
      })

      const otherCaller = createCaller(otherCtx)
      await expect(
        otherCaller.careCircle.revokeAccess({ consentGrantId })
      ).rejects.toMatchObject({ code: "NOT_FOUND" })
    })

    it("rejects cancellation of an already-accepted invitation", async () => {
      await setupOwner()
      await setupInvitee()

      const ownerCaller = createCaller(ownerCtx)
      const { rawToken, invitationId } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Cancel accepted test",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      await inviteeCaller.careCircle.accept({
        rawToken,
        acceptorEmail: INVITEE_EMAIL,
      })

      await expect(
        ownerCaller.careCircle.cancelInvitation({ invitationId })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("rejects invalid scope values", async () => {
      await setupOwner()
      const caller = createCaller(ownerCtx)

      await expect(
        caller.careCircle.invite({
          inviteeEmail: INVITEE_EMAIL,
          // @ts-expect-error intentional invalid scope
          requestedScopes: ["view_diagnosis"],
          purpose: "Bad scope",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("rejects empty scope array", async () => {
      await setupOwner()
      const caller = createCaller(ownerCtx)

      await expect(
        caller.careCircle.invite({
          inviteeEmail: INVITEE_EMAIL,
          requestedScopes: [],
          purpose: "Empty scope",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("rejects double revocation of the same grant", async () => {
      await setupOwner()
      await setupInvitee()

      const ownerCaller = createCaller(ownerCtx)
      const { rawToken } = await ownerCaller.careCircle.invite({
        inviteeEmail: INVITEE_EMAIL,
        requestedScopes: ["view_glucose"],
        purpose: "Double revoke test",
        ttlHours: 2,
      })

      const inviteeCaller = createCaller(inviteeCtx)
      const { consentGrantId } = await inviteeCaller.careCircle.accept({
        rawToken,
        acceptorEmail: INVITEE_EMAIL,
      })

      await ownerCaller.careCircle.revokeAccess({ consentGrantId })

      await expect(
        ownerCaller.careCircle.revokeAccess({ consentGrantId })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  // ─── Token helpers unit tests ────────────────────────────────────────────

  describe("Token helpers", () => {
    it("generateInviteToken returns a raw token and a consistent digest", () => {
      const { raw, digest } = generateInviteToken()
      expect(raw).toBeTruthy()
      expect(digest).toHaveLength(64) // sha256 hex
      expect(digestToken(raw)).toEqual(digest)
    })

    it("different invocations produce different tokens", () => {
      const a = generateInviteToken()
      const b = generateInviteToken()
      expect(a.raw).not.toEqual(b.raw)
      expect(a.digest).not.toEqual(b.digest)
    })
  })
})
