import {
  boolean,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { patients } from "./patients"
import { users } from "./users"

/**
 * care_circle_invitations
 *
 * Single-use, expiring, opaque-token invitations from an owner to a named
 * email address. The token is never stored raw; only a SHA-256 hex digest
 * is persisted so a leaked table cannot be replayed.
 *
 * Status transitions:
 *   pending → accepted (creates a consent_grant row atomically)
 *   pending → expired  (checked on every read; no background timer needed)
 *   pending → revoked  (owner cancels before acceptance)
 *
 * Family relationships do NOT authorize access; PostgreSQL consent_grants is
 * canonical. Graph edges derived from these rows are advisory only.
 */
export const careCircleInvitations = pgTable(
  "care_circle_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    inviterUserId: uuid("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    /**
     * Email address of the intended recipient (lowercase-normalised at write
     * time). Redemption must verify that the authenticated Clerk account's
     * primary email matches this value; a mismatch is rejected and logged.
     */
    inviteeEmail: text("invitee_email").notNull(),

    /**
     * Optional display name for the relationship (e.g. "Spouse", "Parent").
     * Never used as an authorization predicate.
     */
    relationshipLabel: text("relationship_label"),

    /**
     * Scopes this invitation will grant upon acceptance. Stored as a constrained
     * JSON array of well-known scope strings (validated at write time).
     * Example: ["view_glucose", "view_weight"]
     */
    requestedScopes: jsonb("requested_scopes").$type<string[]>().notNull(),

    /**
     * Optional free-text purpose shown to the recipient.
     * Must not contain health data.
     */
    purpose: text("purpose").notNull(),

    /**
     * Policy version at time of invitation creation; copied to the grant on
     * acceptance so the audit trail is complete.
     */
    policyVersion: text("policy_version").notNull(),

    /**
     * SHA-256 hex digest of the opaque random token. The raw token is sent
     * to the invitee email (future work) and never stored.
     */
    tokenDigest: text("token_digest").notNull(),

    /**
     * Whether the token has been consumed. Combined with expiresAt and
     * revokedAt, this gives a complete lifecycle.
     */
    tokenConsumed: boolean("token_consumed").notNull().default(false),

    status: text("status", {
      enum: ["pending", "accepted", "revoked", "expired"],
    })
      .notNull()
      .default("pending"),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokerUserId: uuid("revoker_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),

    /**
     * The consent_grant row created on acceptance. Null until accepted.
     * This field links the invitation to its resulting grant for audit.
     */
    consentGrantId: uuid("consent_grant_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "care_circle_invitations_patient_composite_fk",
    }).onDelete("cascade"),
    // A given digest may only appear once in the table (enforces single-use)
    unique("care_circle_invitations_token_digest_unique").on(table.tokenDigest),
  ]
)

export type CareCircleInvitation = typeof careCircleInvitations.$inferSelect
export type NewCareCircleInvitation =
  typeof careCircleInvitations.$inferInsert
