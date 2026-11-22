import {
  foreignKey,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { patients } from "./patients"
import { users } from "./users"

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    type: text("type", {
      enum: [
        "glucose_fasting",
        "glucose_postprandial",
        "glucose_random",
        "weight",
        "systolic_bp",
        "diastolic_bp",
        "meal",
        "activity",
        "sleep",
        "hydration",
        "medication",
        "presence",
        "ambient_temperature",
      ],
    }).notNull(),
    // Preserve exact numeric decimal precision: never floating point
    numericValue: numeric("numeric_value", {
      precision: 8,
      scale: 2,
    }).notNull(),
    unit: text("unit").notNull(),
    notes: text("notes"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source", { enum: ["manual", "device", "clinical"] })
      .notNull(),
    deviceId: uuid("device_id"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    qualityFlags: jsonb("quality_flags").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.patientId],
      foreignColumns: [patients.tenantId, patients.id],
      name: "observations_patient_composite_fk",
    }).onDelete("cascade"),
  ]
)

export type Observation = typeof observations.$inferSelect
export type NewObservation = typeof observations.$inferInsert
