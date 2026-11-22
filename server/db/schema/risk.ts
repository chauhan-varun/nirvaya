import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { patients } from "./patients"
import { users } from "./users"

export interface RiskAssessmentInputs {
  ageYears: number
  gender: "male" | "female"
  waistCircumferenceCm: number
  physicalActivity: "vigorous" | "moderate" | "mild" | "sedentary"
  familyHistory: "none" | "one_parent" | "both_parents"
  alreadyDiagnosed: boolean
}

export interface FactorDetail {
  factor: "age" | "waist" | "activity" | "family_history"
  label: string
  score: number
  maxScore: number
  category: "modifiable" | "non_modifiable"
  summary: string
  recommendation?: string
}

export interface RiskFactorBreakdown {
  factors: FactorDetail[]
  totalScore: number | null
  riskTier: "low" | "moderate" | "high" | "not_applicable"
  instrument: string
  instrumentVersion: string
  limitations: string[]
}

export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    assessedByUserId: uuid("assessed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["completed", "incomplete", "requires_review", "diagnosed_excluded"],
    }).notNull(),
    instrumentName: text("instrument_name").notNull().default("MDRF-IDRS"),
    instrumentVersion: text("instrument_version").notNull().default("2005.1"),
    alreadyDiagnosed: boolean("already_diagnosed").notNull().default(false),
    ageScore: integer("age_score"),
    waistScore: integer("waist_score"),
    activityScore: integer("activity_score"),
    familyHistoryScore: integer("family_history_score"),
    totalScore: integer("total_score"),
    riskTier: text("risk_tier", {
      enum: ["low", "moderate", "high", "not_applicable"],
    }),
    inputs: jsonb("inputs").notNull().$type<RiskAssessmentInputs>(),
    factorBreakdown: jsonb("factor_breakdown").notNull().$type<RiskFactorBreakdown>(),
    clinicalSummary: text("clinical_summary").notNull(),
    assessedAt: timestamp("assessed_at", { withTimezone: true })
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
      name: "risk_assessments_patient_composite_fk",
    }).onDelete("cascade"),
  ]
)

export type RiskAssessment = typeof riskAssessments.$inferSelect
export type NewRiskAssessment = typeof riskAssessments.$inferInsert
