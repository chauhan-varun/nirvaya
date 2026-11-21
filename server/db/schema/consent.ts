import {
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { patients } from "./patients"
import { users } from "./users"

export const consentGrants = pgTable(
  "consent_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    grantorUserId: uuid("grantor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    granteeUserId: uuid("grantee_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    granteeOrgId: text("grantee_org_id"),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    purpose: text("purpose").notNull(),
    policyVersion: text("policy_version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "consent_grants_patient_composite_fk",
    }).onDelete("cascade"),
  ]
)

export const consentEvents = pgTable("consent_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  consentId: uuid("consent_id")
    .notNull()
    .references(() => consentGrants.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  eventType: text("event_type", { enum: ["grant", "revoke", "modify"] })
    .notNull(),
  policyVersion: text("policy_version").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type ConsentGrant = typeof consentGrants.$inferSelect
export type NewConsentGrant = typeof consentGrants.$inferInsert
export type ConsentEvent = typeof consentEvents.$inferSelect
export type NewConsentEvent = typeof consentEvents.$inferInsert
