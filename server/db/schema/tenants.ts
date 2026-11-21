import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind", { enum: ["personal", "clinic", "family"] })
    .notNull()
    .default("personal"),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["owner", "member", "clinician", "caregiver"],
    }).notNull(),
    status: text("status", { enum: ["active", "inactive", "revoked"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("memberships_tenant_user_unique").on(table.tenantId, table.userId),
  ]
)

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type Membership = typeof memberships.$inferSelect
export type NewMembership = typeof memberships.$inferInsert
