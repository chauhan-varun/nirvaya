import {
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { patients } from "./patients"

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    externalId: text("external_id").notNull().unique(),
    model: text("model").notNull().default("arduino_uno_q_station"),
    protocolVersion: text("protocol_version").notNull().default("1.0"),
    status: text("status", {
      enum: ["registered", "active", "suspended", "revoked"],
    })
      .notNull()
      .default("active"),
    secretKey: text("secret_key").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
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
      name: "devices_patient_composite_fk",
    }).onDelete("cascade"),
  ]
)

export const deviceNonces = pgTable(
  "device_nonces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    keyVersion: integer("key_version").notNull(),
    nonce: text("nonce").notNull(),
    signedTimestamp: timestamp("signed_timestamp", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("device_nonces_device_key_nonce_unique").on(
      table.deviceId,
      table.keyVersion,
      table.nonce
    ),
  ]
)

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
export type DeviceNonce = typeof deviceNonces.$inferSelect
export type NewDeviceNonce = typeof deviceNonces.$inferInsert
