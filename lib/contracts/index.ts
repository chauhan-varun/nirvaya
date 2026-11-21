/** Integration boundaries only. These are not validation schemas or clinical models. */
export type { Locale } from "@/lib/i18n/languages"
export type IsoDateTime = string
export type LogKind =
  "meal" | "activity" | "sleep" | "hydration" | "glucose" | "medication"
export type ConsentScope =
  | "habit_summary"
  | "glucose_summary"
  | "medication_reminders"
  | "support_alerts"

export interface DailyLogSummary {
  id: string
  kind: LogKind
  occurredAt: IsoDateTime
  title: string
  source: "self_report" | "device_context"
}

export interface RiskFactorExplanation {
  code: string
  label: string
  explanation: string
  modifiable: boolean
  provenance: string
}

export interface AssessmentSummary {
  id: string
  status: "incomplete" | "requires_review" | "completed"
  instrument: { name: string; version: string } | null
  factors: RiskFactorExplanation[]
  // No score until a validated instrument, population and missing-data policy are selected.
}

export interface DeviceContextEvent {
  eventId: string
  deviceId: string
  observedAt: IsoDateTime
  kind: "presence" | "ambient_temperature"
  value: number
  unit: "presence_binary" | "celsius"
  firmwareVersion: string
}

export interface CareConsentSummary {
  id: string
  caregiverDisplayName: string
  scopes: ConsentScope[]
  status: "pending" | "active" | "revoked" | "expired"
  expiresAt: IsoDateTime | null
}

/** Domain mutation metadata; tRPC output/error types are inferred from AppRouter later. */
export interface MutationMetadata {
  idempotencyKey: string
}
