import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { users } from "./users"

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name"),
    yearOfBirth: integer("year_of_birth"),
    gender: text("gender"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Real composite unique constraint required by child tables for composite FK
    unique("patients_tenant_id_id_unique").on(table.tenantId, table.id),
  ]
)

export const patientDelegations = pgTable(
  "patient_delegations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    delegateUserId: uuid("delegate_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    authorityType: text("authority_type").notNull(),
    status: text("status", { enum: ["active", "revoked"] })
      .notNull()
      .default("active"),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "delegations_patient_composite_fk",
    }).onDelete("cascade"),
  ]
)

export type Patient = typeof patients.$inferSelect
export type NewPatient = typeof patients.$inferInsert
export type PatientDelegation = typeof patientDelegations.$inferSelect
export type NewPatientDelegation = typeof patientDelegations.$inferInsert
