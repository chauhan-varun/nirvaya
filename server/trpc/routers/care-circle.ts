import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { eq, and } from "drizzle-orm"
import {
  getGrantedPatientViews,
  getDelegateObservations,
  ALLOWED_SCOPES,
  validateScopes,
  createInvitationAtomic,
  acceptInvitationAtomic,
  revokeInvitationAtomic,
  revokeConsentGrantAtomic,
  getSharingHistory,
} from "@/server/db/repositories/care-circle"

const POLICY_VERSION = "v1.0"

// ─── Shared helpers ────────────────────────────────────────────────────────

/**
 * Resolve internal user and their owned patient record.
 * Always uses clerkSubject from ctx — never trusts client-supplied userId.
 */
async function resolveOwnerContext(clerkUserId: string) {
  const db = getDb()

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkSubject, clerkUserId))
    .limit(1)

  if (!user) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "User profile not found. Please complete onboarding first.",
    })
  }

  const [patient] = await db
    .select({
      id: patients.id,
      tenantId: patients.tenantId,
    })
    .from(patients)
    .where(eq(patients.ownerUserId, user.id))
    .limit(1)

  if (!patient) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Patient record not found. Please complete onboarding first.",
    })
  }

  return { internalUserId: user.id, patient }
}

function mapRepoError(err: unknown): never {
  const e = err as { code?: string; message?: string }
  const code = e?.code
  if (code === "NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: e.message })
  if (code === "FORBIDDEN") throw new TRPCError({ code: "FORBIDDEN", message: e.message })
  if (code === "BAD_REQUEST") throw new TRPCError({ code: "BAD_REQUEST", message: e.message })
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" })
}

// ─── Input validators ──────────────────────────────────────────────────────

const scopesSchema = z
  .array(z.enum(ALLOWED_SCOPES))
  .min(1, "At least one scope is required")
  .max(ALLOWED_SCOPES.length, "Too many scopes")

// ─── Router ────────────────────────────────────────────────────────────────

export const careCircleRouter = router({
  /**
   * Owner sends an invitation to a named email address.
   * Returns the raw token (single exposure) for out-of-band delivery.
   * In this in-app phase the token is returned to the UI; external email
   * delivery requires provider/consent approval.
   */
  invite: protectedProcedure
    .input(
      z.object({
        inviteeEmail: z
          .string()
          .email("Must be a valid email address")
          .max(254, "Email too long"),
        relationshipLabel: z
          .string()
          .trim()
          .max(50, "Relationship label too long")
          .optional(),
        requestedScopes: scopesSchema,
        purpose: z
          .string()
          .trim()
          .min(4, "Purpose too short")
          .max(200, "Purpose too long"),
        /**
         * TTL in hours. Min 1 hour, max 72 hours (3 days).
         * Short TTL is required by the security model.
         */
        ttlHours: z
          .number()
          .int()
          .min(1, "TTL must be at least 1 hour")
          .max(72, "TTL must not exceed 72 hours")
          .default(48),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolveOwnerContext(ctx.userId)

      let validatedScopes: ReturnType<typeof validateScopes>
      try {
        validatedScopes = validateScopes(input.requestedScopes)
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: (err as Error).message,
        })
      }

      const expiresAt = new Date(Date.now() + input.ttlHours * 60 * 60 * 1000)

      let result: Awaited<ReturnType<typeof createInvitationAtomic>>
      try {
        result = await createInvitationAtomic({
          tenantId: patient.tenantId,
          patientId: patient.id,
          inviterUserId: internalUserId,
          inviteeEmail: input.inviteeEmail,
          relationshipLabel: input.relationshipLabel,
          requestedScopes: validatedScopes,
          purpose: input.purpose,
          policyVersion: POLICY_VERSION,
          expiresAt,
          requestId: ctx.requestId,
        })
      } catch (err) {
        mapRepoError(err)
      }

      return {
        invitationId: result!.invitationId,
        /**
         * Raw token — displayed in-app for the owner to share.
         * External delivery (email/SMS) is deferred pending provider approval.
         * This is the ONLY time the raw value is available.
         */
        rawToken: result!.rawToken,
        expiresAt: result!.expiresAt.toISOString(),
        inviteeEmail: input.inviteeEmail.toLowerCase().trim(),
        scopes: validatedScopes,
        note: "Share this token with the person you are inviting. It expires in " + input.ttlHours + " hours and can only be used once.",
      }
    }),

  /**
   * Recipient redeems their invitation token.
   * The authenticated session's primary email must match the invitation.
   * Returns the new consent grant's scopes.
   */
  accept: protectedProcedure
    .input(
      z.object({
        rawToken: z
          .string()
          .min(10, "Invalid token")
          .max(200, "Invalid token"),
        /**
         * The authenticated user's verified primary email (from client).
         * Re-validated server-side against the invitation's inviteeEmail.
         */
        acceptorEmail: z
          .string()
          .email("Must be a valid email address")
          .max(254),
        /**
         * Optional grant expiry — bounded to the invitation's own expiresAt.
         * ISO-8601 string.
         */
        grantExpiresAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb()

      // Resolve accepting user
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkSubject, ctx.userId))
        .limit(1)

      if (!user) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "User profile not found. Please complete onboarding first.",
        })
      }

      const grantExpiresAt = input.grantExpiresAt
        ? new Date(input.grantExpiresAt)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // default 1 year

      let result: Awaited<ReturnType<typeof acceptInvitationAtomic>>
      try {
        result = await acceptInvitationAtomic({
          rawToken: input.rawToken,
          acceptorUserId: user.id,
          acceptorEmail: input.acceptorEmail,
          policyVersion: POLICY_VERSION,
          requestId: ctx.requestId,
          grantExpiresAt,
        })
      } catch (err) {
        mapRepoError(err)
      }

      return {
        consentGrantId: result!.consentGrantId,
        scopes: result!.scopes,
        message: "Access granted. You now have view access to the shared health data.",
      }
    }),

  /**
   * Owner cancels a pending invitation (before it is accepted).
   */
  cancelInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.string().uuid("Invalid invitation ID"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolveOwnerContext(ctx.userId)

      try {
        await revokeInvitationAtomic({
          invitationId: input.invitationId,
          revokerUserId: internalUserId,
          tenantId: patient.tenantId,
          patientId: patient.id,
          requestId: ctx.requestId,
        })
      } catch (err) {
        mapRepoError(err)
      }

      return { success: true }
    }),

  /**
   * Owner revokes an accepted consent grant, immediately blocking future access.
   * This is the canonical revocation path; PostgreSQL is updated synchronously.
   */
  revokeAccess: protectedProcedure
    .input(
      z.object({
        consentGrantId: z.string().uuid("Invalid grant ID"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolveOwnerContext(ctx.userId)

      try {
        await revokeConsentGrantAtomic({
          consentGrantId: input.consentGrantId,
          revokerUserId: internalUserId,
          tenantId: patient.tenantId,
          patientId: patient.id,
          policyVersion: POLICY_VERSION,
          requestId: ctx.requestId,
        })
      } catch (err) {
        mapRepoError(err)
      }

      return {
        success: true,
        message: "Access revoked immediately. This person can no longer view your health data.",
      }
    }),

  /**
   * Owner's sharing history — all invitations and their lifecycle status.
   * Returns safe DTOs with no health data content.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const { patient } = await resolveOwnerContext(ctx.userId)

      const rows = await getSharingHistory(
        patient.id,
        patient.tenantId,
        input.limit
      )

      return {
        entries: rows.map((r) => ({
          invitationId: r.invitationId,
          inviteeEmail: r.inviteeEmail,
          relationshipLabel: r.relationshipLabel,
          status: r.status,
          scopes: r.requestedScopes,
          purpose: r.purpose,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
          acceptedAt: r.acceptedAt?.toISOString() ?? null,
          revokedAt: r.revokedAt?.toISOString() ?? null,
          consentGrantId: r.consentGrantId,
          consentActive: r.status === "accepted" && !r.consentRevokedAt,
        })),
        total: rows.length,
      }
    }),

  /**
   * Delegate view — returns all patients who have actively shared data with
   * the authenticated user. No owner patient record required.
   */
  sharedWithMe: protectedProcedure.query(async ({ ctx }) => {
    const views = await getGrantedPatientViews(ctx.userId)

    return {
      grants: views.map((v) => ({
        consentGrantId: v.consentGrantId,
        patientId: v.patientId,
        tenantId: v.tenantId,
        patientName: v.patientName,
        grantorEmail: v.grantorEmail,
        purpose: v.purpose,
        scopes: v.scopes,
        grantedAt: v.grantedAt.toISOString(),
        expiresAt: v.expiresAt.toISOString(),
      })),
      total: views.length,
    }
  }),

  /**
   * Delegate observations — returns recent observations for a patient who
   * has actively shared data with the authenticated user.
   * Data-layer authorization is enforced inside the repository.
   */
  delegateObservations: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const result = await getDelegateObservations(
          ctx.userId,
          input.patientId,
          input.tenantId,
          input.limit
        )

        return {
          observations: result.observations.map((o) => ({
            id: o.id,
            type: o.type,
            numericValue: o.numericValue,
            unit: o.unit,
            notes: o.notes ?? null,
            observedAt: o.observedAt.toISOString(),
            source: o.source,
          })),
          allowedScopes: result.allowedScopes,
          total: result.observations.length,
        }
      } catch (err) {
        mapRepoError(err)
      }
    }),
})
