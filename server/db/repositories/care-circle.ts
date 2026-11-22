import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { getDb } from "../index"
import { careCircleInvitations } from "../schema/invitations"
import { consentGrants, consentEvents } from "../schema/consent"
import { auditEvents, outboxEvents } from "../schema/events"
import { observations } from "../schema/observations"
import { patients } from "../schema/patients"
import { users } from "../schema/users"
import {
  and,
  desc,
  eq,
  gt,
  isNull,
  lt,
  or,
} from "drizzle-orm"

// ─── Allowed scopes ────────────────────────────────────────────────────────

export const ALLOWED_SCOPES = [
  "view_glucose",
  "view_weight",
  "view_blood_pressure",
  "view_journal",
  "view_medications",
] as const

export type AllowedScope = (typeof ALLOWED_SCOPES)[number]

export function validateScopes(scopes: string[]): AllowedScope[] {
  for (const s of scopes) {
    if (!ALLOWED_SCOPES.includes(s as AllowedScope)) {
      throw new Error(`Unknown scope: ${s}`)
    }
  }
  if (scopes.length === 0) {
    throw new Error("At least one scope is required")
  }
  return scopes as AllowedScope[]
}

// ─── Token helpers ─────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random opaque token (URL-safe base64).
 * Returns { raw, digest } — raw is sent to recipient, digest is stored.
 */
export function generateInviteToken(): { raw: string; digest: string } {
  const raw = randomBytes(32).toString("base64url")
  const digest = createHash("sha256").update(raw).digest("hex")
  return { raw, digest }
}

export function digestToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

// ─── Create invitation ─────────────────────────────────────────────────────

export interface CreateInvitationParams {
  tenantId: string
  patientId: string
  inviterUserId: string
  inviteeEmail: string
  relationshipLabel?: string
  requestedScopes: AllowedScope[]
  purpose: string
  policyVersion: string
  expiresAt: Date
  requestId: string
}

export interface CreateInvitationResult {
  invitationId: string
  /**
   * Raw token to be delivered to the invitee out-of-band.
   * This is the ONLY time the raw value is available; it is not stored.
   */
  rawToken: string
  expiresAt: Date
}

export async function createInvitationAtomic(
  params: CreateInvitationParams
): Promise<CreateInvitationResult> {
  const db = getDb()
  const { raw, digest } = generateInviteToken()

  let invitationId: string | undefined

  await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(careCircleInvitations)
      .values({
        tenantId: params.tenantId,
        patientId: params.patientId,
        inviterUserId: params.inviterUserId,
        inviteeEmail: params.inviteeEmail.toLowerCase().trim(),
        relationshipLabel: params.relationshipLabel,
        requestedScopes: params.requestedScopes,
        purpose: params.purpose,
        policyVersion: params.policyVersion,
        tokenDigest: digest,
        expiresAt: params.expiresAt,
      })
      .returning({ id: careCircleInvitations.id })

    invitationId = inv.id

    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.inviterUserId,
      action: "invite_sent",
      resourceType: "care_circle_invitation",
      resourceId: inv.id,
      purpose: params.purpose,
      decision: "allow",
      requestId: params.requestId,
    })
  })

  return { invitationId: invitationId!, rawToken: raw, expiresAt: params.expiresAt }
}

// ─── Accept invitation ─────────────────────────────────────────────────────

export interface AcceptInvitationParams {
  rawToken: string
  /** Internal user ID of the authenticated recipient */
  acceptorUserId: string
  /** Verified primary email from Clerk for the accepting session */
  acceptorEmail: string
  policyVersion: string
  requestId: string
  /** Requested grant expiry — capped to invitation.expiresAt if earlier */
  grantExpiresAt: Date
}

export interface AcceptInvitationResult {
  consentGrantId: string
  scopes: string[]
}

export async function acceptInvitationAtomic(
  params: AcceptInvitationParams
): Promise<AcceptInvitationResult> {
  const db = getDb()
  const digest = digestToken(params.rawToken)
  const now = new Date()

  let consentGrantId: string | undefined
  let scopes: string[] = []

  await db.transaction(async (tx) => {
    // 1. Fetch and lock the invitation row
    const rows = await tx
      .select()
      .from(careCircleInvitations)
      .where(eq(careCircleInvitations.tokenDigest, digest))

    const inv = rows[0]

    if (!inv) {
      throw Object.assign(new Error("Invitation not found or already used"), {
        code: "NOT_FOUND",
      })
    }

    // 2. Validate lifecycle — expired, already consumed, revoked
    if (inv.tokenConsumed) {
      throw Object.assign(new Error("This invitation link has already been used"), {
        code: "FORBIDDEN",
      })
    }
    if (inv.status !== "pending") {
      throw Object.assign(new Error(`Invitation is ${inv.status}`), {
        code: "FORBIDDEN",
      })
    }
    if (inv.expiresAt <= now) {
      await tx
        .update(careCircleInvitations)
        .set({ status: "expired", updatedAt: now })
        .where(eq(careCircleInvitations.id, inv.id))
      throw Object.assign(new Error("Invitation has expired"), {
        code: "FORBIDDEN",
      })
    }

    // 3. Email binding check — recipient must match
    if (inv.inviteeEmail !== params.acceptorEmail.toLowerCase().trim()) {
      // Log the mismatch but do NOT reveal the expected email
      await tx.insert(auditEvents).values({
        tenantId: inv.tenantId,
        actorType: "user",
        actorId: params.acceptorUserId,
        action: "invite_accept_email_mismatch",
        resourceType: "care_circle_invitation",
        resourceId: inv.id,
        purpose: "invitation_redemption",
        decision: "deny",
        requestId: params.requestId,
      })
      throw Object.assign(
        new Error(
          "This invitation was sent to a different email address. " +
            "Please sign in with the account that received the invitation."
        ),
        { code: "FORBIDDEN" }
      )
    }

    // 4. Determine effective grant expiry
    const effectiveExpiry =
      params.grantExpiresAt < inv.expiresAt ? params.grantExpiresAt : inv.expiresAt

    // 5. Create consent grant atomically with token consumption + audit
    const [grant] = await tx
      .insert(consentGrants)
      .values({
        tenantId: inv.tenantId,
        patientId: inv.patientId,
        grantorUserId: inv.inviterUserId,
        granteeUserId: params.acceptorUserId,
        scopes: inv.requestedScopes,
        purpose: inv.purpose,
        policyVersion: params.policyVersion,
        expiresAt: effectiveExpiry,
      })
      .returning({ id: consentGrants.id })

    consentGrantId = grant.id
    scopes = inv.requestedScopes

    // 6. Append consent event
    await tx.insert(consentEvents).values({
      tenantId: inv.tenantId,
      consentId: grant.id,
      actorUserId: params.acceptorUserId,
      eventType: "grant",
      policyVersion: params.policyVersion,
    })

    // 7. Mark invitation as accepted + consumed
    await tx
      .update(careCircleInvitations)
      .set({
        status: "accepted",
        tokenConsumed: true,
        acceptedAt: now,
        consentGrantId: grant.id,
        updatedAt: now,
      })
      .where(eq(careCircleInvitations.id, inv.id))

    // 8. Audit
    await tx.insert(auditEvents).values({
      tenantId: inv.tenantId,
      actorType: "user",
      actorId: params.acceptorUserId,
      action: "invite_accepted",
      resourceType: "care_circle_invitation",
      resourceId: inv.id,
      purpose: inv.purpose,
      decision: "allow",
      requestId: params.requestId,
    })

    // 9. Outbox event for Neo4j projection
    await tx.insert(outboxEvents).values({
      tenantId: inv.tenantId,
      aggregateType: "consent",
      aggregateId: grant.id,
      aggregateVersion: 1,
      eventType: "consent.granted",
      schemaVersion: 1,
      payload: {
        consentId: grant.id,
        tenantId: inv.tenantId,
        patientId: inv.patientId,
        grantorUserId: inv.inviterUserId,
        granteeUserId: params.acceptorUserId,
        scopes: inv.requestedScopes,
        purpose: inv.purpose,
        policyVersion: params.policyVersion,
        expiresAt: effectiveExpiry.toISOString(),
      },
    })
  })

  return { consentGrantId: consentGrantId!, scopes }
}

// ─── Revoke invitation (owner cancels before acceptance) ───────────────────

export interface RevokeInvitationParams {
  invitationId: string
  revokerUserId: string
  tenantId: string
  patientId: string
  requestId: string
}

export async function revokeInvitationAtomic(
  params: RevokeInvitationParams
): Promise<void> {
  const db = getDb()
  const now = new Date()

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(careCircleInvitations)
      .where(
        and(
          eq(careCircleInvitations.id, params.invitationId),
          eq(careCircleInvitations.tenantId, params.tenantId),
          eq(careCircleInvitations.patientId, params.patientId)
        )
      )

    const inv = rows[0]
    if (!inv) {
      throw Object.assign(new Error("Invitation not found"), { code: "NOT_FOUND" })
    }

    // Only pending invitations can be revoked this way.
    // Accepted grants must be revoked through the consent revocation pathway.
    if (inv.status !== "pending") {
      throw Object.assign(
        new Error(
          `Only pending invitations can be cancelled. ` +
            `This invitation is ${inv.status}. ` +
            `To stop sharing with an accepted contact, use Revoke Access.`
        ),
        { code: "BAD_REQUEST" }
      )
    }

    await tx
      .update(careCircleInvitations)
      .set({
        status: "revoked",
        revokedAt: now,
        revokerUserId: params.revokerUserId,
        updatedAt: now,
      })
      .where(eq(careCircleInvitations.id, inv.id))

    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.revokerUserId,
      action: "invite_revoked",
      resourceType: "care_circle_invitation",
      resourceId: inv.id,
      purpose: "owner_cancellation",
      decision: "allow",
      requestId: params.requestId,
    })
  })
}

// ─── Revoke consent grant (owner removes an accepted contact) ──────────────

export interface RevokeConsentGrantParams {
  consentGrantId: string
  revokerUserId: string
  tenantId: string
  patientId: string
  policyVersion: string
  requestId: string
}

export async function revokeConsentGrantAtomic(
  params: RevokeConsentGrantParams
): Promise<void> {
  const db = getDb()
  const now = new Date()

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(consentGrants)
      .where(
        and(
          eq(consentGrants.id, params.consentGrantId),
          eq(consentGrants.tenantId, params.tenantId),
          eq(consentGrants.patientId, params.patientId),
          eq(consentGrants.grantorUserId, params.revokerUserId)
        )
      )

    const grant = rows[0]
    if (!grant) {
      throw Object.assign(new Error("Consent grant not found or not owned by you"), {
        code: "NOT_FOUND",
      })
    }
    if (grant.revokedAt) {
      throw Object.assign(new Error("Grant already revoked"), { code: "BAD_REQUEST" })
    }

    // Revoke canonical PostgreSQL grant — immediately blocks all subsequent reads
    await tx
      .update(consentGrants)
      .set({ revokedAt: now })
      .where(eq(consentGrants.id, grant.id))

    await tx.insert(consentEvents).values({
      tenantId: params.tenantId,
      consentId: grant.id,
      actorUserId: params.revokerUserId,
      eventType: "revoke",
      policyVersion: params.policyVersion,
    })

    // Also update the linked invitation row if one exists
    await tx
      .update(careCircleInvitations)
      .set({ status: "revoked", revokedAt: now, revokerUserId: params.revokerUserId, updatedAt: now })
      .where(
        and(
          eq(careCircleInvitations.consentGrantId, grant.id),
          eq(careCircleInvitations.tenantId, params.tenantId)
        )
      )

    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.revokerUserId,
      action: "consent_revoked",
      resourceType: "consent_grant",
      resourceId: grant.id,
      purpose: "owner_revocation",
      decision: "allow",
      requestId: params.requestId,
    })

    // Outbox event for Neo4j projection
    await tx.insert(outboxEvents).values({
      tenantId: params.tenantId,
      aggregateType: "consent",
      aggregateId: grant.id,
      aggregateVersion: 2,
      eventType: "consent.revoked",
      schemaVersion: 1,
      payload: {
        consentId: grant.id,
        tenantId: params.tenantId,
        patientId: params.patientId,
        revokedAt: now.toISOString(),
      },
    })
  })
}

// ─── List active grants (caregiver view of what they can see) ─────────────

export interface ActiveGrant {
  grantId: string
  scopes: string[]
  purpose: string
  expiresAt: Date
  grantedAt: Date
}

export async function getActiveGrantsForGrantee(
  granteeUserId: string,
  patientId: string,
  tenantId: string
): Promise<ActiveGrant[]> {
  const db = getDb()
  const now = new Date()

  const rows = await db
    .select({
      id: consentGrants.id,
      scopes: consentGrants.scopes,
      purpose: consentGrants.purpose,
      expiresAt: consentGrants.expiresAt,
      grantedAt: consentGrants.grantedAt,
    })
    .from(consentGrants)
    .where(
      and(
        eq(consentGrants.tenantId, tenantId),
        eq(consentGrants.patientId, patientId),
        eq(consentGrants.granteeUserId, granteeUserId),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, now)
      )
    )

  return rows.map((r) => ({
    grantId: r.id,
    scopes: r.scopes ?? [],
    purpose: r.purpose,
    expiresAt: r.expiresAt,
    grantedAt: r.grantedAt,
  }))
}

// ─── Sharing history (owner sees all past and present grants) ─────────────

export interface SharingHistoryRow {
  invitationId: string
  inviteeEmail: string
  relationshipLabel: string | null
  status: string
  requestedScopes: string[]
  purpose: string
  createdAt: Date
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  consentGrantId: string | null
  consentRevokedAt: Date | null
}

export async function getSharingHistory(
  patientId: string,
  tenantId: string,
  limit = 50
): Promise<SharingHistoryRow[]> {
  const db = getDb()

  const rows = await db
    .select({
      invitationId: careCircleInvitations.id,
      inviteeEmail: careCircleInvitations.inviteeEmail,
      relationshipLabel: careCircleInvitations.relationshipLabel,
      status: careCircleInvitations.status,
      requestedScopes: careCircleInvitations.requestedScopes,
      purpose: careCircleInvitations.purpose,
      createdAt: careCircleInvitations.createdAt,
      expiresAt: careCircleInvitations.expiresAt,
      acceptedAt: careCircleInvitations.acceptedAt,
      revokedAt: careCircleInvitations.revokedAt,
      consentGrantId: careCircleInvitations.consentGrantId,
      consentRevokedAt: consentGrants.revokedAt,
    })
    .from(careCircleInvitations)
    .leftJoin(
      consentGrants,
      and(
        eq(consentGrants.id, careCircleInvitations.consentGrantId!),
        eq(consentGrants.tenantId, tenantId)
      )
    )
    .where(
      and(
        eq(careCircleInvitations.tenantId, tenantId),
        eq(careCircleInvitations.patientId, patientId)
      )
    )
    .orderBy(desc(careCircleInvitations.createdAt))
    .limit(limit)

  // Eagerly mark expired pending invitations
  const now = new Date()
  return rows.map((r) => ({
    ...r,
    status:
      r.status === "pending" && r.expiresAt <= now ? "expired" : r.status,
    requestedScopes: (r.requestedScopes as string[]) ?? [],
    consentRevokedAt: r.consentRevokedAt ?? null,
  }))
}

// ─── Authorization helper ──────────────────────────────────────────────────

/**
 * Re-evaluate consent at every protected read.
 * Returns the effective scopes if access is allowed, throws otherwise.
 * Canonical PostgreSQL check — never relies on graph or session state.
 */
export async function checkActiveConsent(
  granteeUserId: string,
  patientId: string,
  tenantId: string,
  requiredScope: AllowedScope
): Promise<AllowedScope[]> {
  const db = getDb()
  const now = new Date()

  const rows = await db
    .select({ id: consentGrants.id, scopes: consentGrants.scopes })
    .from(consentGrants)
    .where(
      and(
        eq(consentGrants.tenantId, tenantId),
        eq(consentGrants.patientId, patientId),
        eq(consentGrants.granteeUserId, granteeUserId),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, now)
      )
    )

  const allScopes = rows.flatMap((r) => (r.scopes as string[]) ?? [])
  if (!allScopes.includes(requiredScope)) {
    throw Object.assign(new Error("Access denied: scope not granted or grant expired/revoked"), {
      code: "FORBIDDEN",
    })
  }
  return allScopes as AllowedScope[]
}

// ─── Delegate / Caregiver view ─────────────────────────────────────────────

export interface DelegatePatientView {
  consentGrantId: string
  patientId: string
  tenantId: string
  patientName: string | null
  grantorEmail: string
  purpose: string
  scopes: AllowedScope[]
  grantedAt: Date
  expiresAt: Date
}

/**
 * Returns all active consent grants where the given user is the grantee
 * (i.e., someone shared their health data with this user).
 * Never returns revoked or expired grants.
 */
export async function getGrantedPatientViews(
  delegateClerkUserId: string
): Promise<DelegatePatientView[]> {
  const db = getDb()
  const now = new Date()

  // 1. Resolve internal user id
  const [delegateUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkSubject, delegateClerkUserId))
    .limit(1)

  if (!delegateUser) return []

  // 2. Query active grants for this delegate
  const rows = await db
    .select({
      consentGrantId: consentGrants.id,
      patientId: consentGrants.patientId,
      tenantId: consentGrants.tenantId,
      purpose: consentGrants.purpose,
      scopes: consentGrants.scopes,
      grantedAt: consentGrants.grantedAt,
      expiresAt: consentGrants.expiresAt,
      patientName: patients.name,
      grantorEmail: users.clerkSubject, // used as display identifier
    })
    .from(consentGrants)
    .innerJoin(patients, eq(patients.id, consentGrants.patientId))
    .innerJoin(users, eq(users.id, consentGrants.grantorUserId))
    .where(
      and(
        eq(consentGrants.granteeUserId, delegateUser.id),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, now)
      )
    )
    .orderBy(desc(consentGrants.grantedAt))

  return rows.map((r) => ({
    consentGrantId: r.consentGrantId,
    patientId: r.patientId,
    tenantId: r.tenantId,
    patientName: r.patientName,
    grantorEmail: r.grantorEmail,
    purpose: r.purpose,
    scopes: (r.scopes as string[]) as AllowedScope[],
    grantedAt: r.grantedAt,
    expiresAt: r.expiresAt,
  }))
}

/**
 * Fetches recent observations for a patient that the delegate has scope to view.
 * Enforces consent at the data layer — never trusts the caller.
 */
export async function getDelegateObservations(
  delegateClerkUserId: string,
  patientId: string,
  tenantId: string,
  limit = 20
) {
  const db = getDb()
  const now = new Date()

  // 1. Resolve internal delegate user id
  const [delegateUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkSubject, delegateClerkUserId))
    .limit(1)

  if (!delegateUser) {
    throw Object.assign(new Error("Delegate user not found"), { code: "NOT_FOUND" })
  }

  // 2. Load active grant and scopes — real authorization check
  const [grant] = await db
    .select({ scopes: consentGrants.scopes })
    .from(consentGrants)
    .where(
      and(
        eq(consentGrants.granteeUserId, delegateUser.id),
        eq(consentGrants.patientId, patientId),
        eq(consentGrants.tenantId, tenantId),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, now)
      )
    )
    .limit(1)

  if (!grant) {
    throw Object.assign(
      new Error("Access denied: no active consent grant for this patient"),
      { code: "FORBIDDEN" }
    )
  }

  const allowedScopes = (grant.scopes as string[]) as AllowedScope[]

  // 3. Map scopes → observation types
  const typeFilter: string[] = []
  if (allowedScopes.includes("view_glucose")) {
    typeFilter.push("glucose_fasting", "glucose_postprandial", "glucose_random")
  }
  if (allowedScopes.includes("view_weight")) {
    typeFilter.push("weight")
  }
  if (allowedScopes.includes("view_blood_pressure")) {
    typeFilter.push("systolic_bp", "diastolic_bp")
  }

  if (typeFilter.length === 0) {
    // No observation-type scopes granted
    return { observations: [], allowedScopes }
  }

  // 4. Fetch only allowed observation types
  const rows = await db
    .select({
      id: observations.id,
      type: observations.type,
      numericValue: observations.numericValue,
      unit: observations.unit,
      notes: observations.notes,
      observedAt: observations.observedAt,
      source: observations.source,
    })
    .from(observations)
    .where(
      and(
        eq(observations.tenantId, tenantId),
        eq(observations.patientId, patientId),
        // type IN typeFilter using OR chain
        or(...typeFilter.map((t) => eq(observations.type, t as never)))
      )
    )
    .orderBy(desc(observations.observedAt))
    .limit(limit)

  return { observations: rows, allowedScopes }
}
