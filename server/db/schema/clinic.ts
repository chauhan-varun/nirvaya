import {
  foreignKey,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { patients } from "./patients"
import { tenants } from "./tenants"
import { users } from "./users"

export const clinicianProfiles = pgTable(
  "clinician_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verificationStatus: text("verification_status", {
      enum: ["unverified", "verified", "suspended"],
    })
      .notNull()
      .default("unverified"),
    licenseNumber: text("license_number"),
    jurisdiction: text("jurisdiction"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("clinician_profiles_tenant_user_unique").on(
      table.tenantId,
      table.userId
    ),
  ]
)

export const careAssignments = pgTable(
  "care_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    clinicianUserId: uuid("clinician_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "completed", "cancelled"] })
      .notNull()
      .default("active"),
    priority: text("priority", { enum: ["routine", "urgent"] })
      .notNull()
      .default("routine"),
    notes: text("notes"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
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
      name: "care_assignments_patient_composite_fk",
    }).onDelete("cascade"),
    unique("care_assignments_active_unique").on(
      table.tenantId,
      table.patientId,
      table.clinicianUserId,
      table.status
    ),
  ]
)

export const followUpActions = pgTable(
  "follow_up_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    clinicianUserId: uuid("clinician_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionType: text("action_type", {
      enum: ["phone_call", "review", "referral", "message", "in_person"],
    }).notNull(),
    status: text("status", { enum: ["completed", "scheduled", "cancelled"] })
      .notNull()
      .default("completed"),
    notes: text("notes"),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "follow_up_actions_patient_composite_fk",
    }).onDelete("cascade"),
  ]
)

export const screenings = pgTable(
  "screenings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    screenedByUserId: uuid("screened_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    screeningType: text("screening_type", {
      enum: [
        "glucose_fasting",
        "glucose_random",
        "systolic_bp",
        "diastolic_bp",
        "weight",
      ],
    }).notNull(),
    value: numeric("value", { precision: 8, scale: 2 }).notNull(),
    unit: text("unit").notNull(),
    batchId: uuid("batch_id"),
    externalReference: text("external_reference"),
    screenedAt: timestamp("screened_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "screenings_patient_composite_fk",
    }).onDelete("cascade"),
    unique("screenings_tenant_patient_type_time_unique").on(
      table.tenantId,
      table.patientId,
      table.screeningType,
      table.screenedAt
    ),
  ]
)

export type ClinicianProfile = typeof clinicianProfiles.$inferSelect
export type NewClinicianProfile = typeof clinicianProfiles.$inferInsert
export type CareAssignment = typeof careAssignments.$inferSelect
export type NewCareAssignment = typeof careAssignments.$inferInsert
export type FollowUpAction = typeof followUpActions.$inferSelect
export type NewFollowUpAction = typeof followUpActions.$inferInsert
export type Screening = typeof screenings.$inferSelect
export type NewScreening = typeof screenings.$inferInsert
