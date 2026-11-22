import "server-only"
import { getDb } from "../index"
import {
  riskAssessments,
  type RiskAssessment,
  type RiskAssessmentInputs,
  type RiskFactorBreakdown,
  type FactorDetail,
} from "../schema/risk"
import { auditEvents, outboxEvents } from "../schema/events"
import { and, desc, eq } from "drizzle-orm"

export const INSTRUMENT_NAME = "MDRF-IDRS"
export const INSTRUMENT_VERSION = "2005.1"

export const IDRS_LIMITATIONS = [
  "The Indian Diabetes Risk Score (IDRS) is a validated screening indicator, not a diagnostic medical test.",
  "Designed specifically for adult populations of South Asian / Indian heritage aged 18 and older.",
  "If already diagnosed with diabetes, this prevention screening tool does not apply.",
  "A high or moderate score warrants laboratory confirmatory testing (fasting plasma glucose or HbA1c) by a licensed physician.",
  "Never adjust, start, or discontinue medications based on screening scores alone.",
]

export interface IDRSCalculationResult {
  status: "completed" | "diagnosed_excluded" | "incomplete"
  alreadyDiagnosed: boolean
  totalScore: number | null
  ageScore: number | null
  waistScore: number | null
  activityScore: number | null
  familyHistoryScore: number | null
  riskTier: "low" | "moderate" | "high" | "not_applicable"
  breakdown: RiskFactorBreakdown
  clinicalSummary: string
}

/**
 * Deterministic pure scoring function for the MDRF Indian Diabetes Risk Score (IDRS).
 * Mohan et al., Journal of the Association of Physicians of India (JAPI) 2005; 53: 759-763.
 */
export function calculateIDRS(inputs: RiskAssessmentInputs): IDRSCalculationResult {
  // 1. Diagnosed user pathway: explicitly separate prevention screening from diagnosed diabetes care
  if (inputs.alreadyDiagnosed) {
    const breakdown: RiskFactorBreakdown = {
      factors: [],
      totalScore: null,
      riskTier: "not_applicable",
      instrument: INSTRUMENT_NAME,
      instrumentVersion: INSTRUMENT_VERSION,
      limitations: IDRS_LIMITATIONS,
    }

    return {
      status: "diagnosed_excluded",
      alreadyDiagnosed: true,
      totalScore: null,
      ageScore: null,
      waistScore: null,
      activityScore: null,
      familyHistoryScore: null,
      riskTier: "not_applicable",
      breakdown,
      clinicalSummary:
        "Prior diagnosis of diabetes recorded. The IDRS primary prevention screening instrument is designed for undiagnosed individuals. Regular clinical glycemic monitoring, HbA1c surveillance, and consultation with your personal healthcare team are advised.",
    }
  }

  // 2. Input validation for complete deterministic scoring
  if (
    typeof inputs.ageYears !== "number" ||
    inputs.ageYears < 18 ||
    inputs.ageYears > 120 ||
    typeof inputs.waistCircumferenceCm !== "number" ||
    inputs.waistCircumferenceCm <= 0 ||
    !inputs.gender ||
    !inputs.physicalActivity ||
    !inputs.familyHistory
  ) {
    const breakdown: RiskFactorBreakdown = {
      factors: [],
      totalScore: null,
      riskTier: "not_applicable",
      instrument: INSTRUMENT_NAME,
      instrumentVersion: INSTRUMENT_VERSION,
      limitations: IDRS_LIMITATIONS,
    }

    return {
      status: "incomplete",
      alreadyDiagnosed: false,
      totalScore: null,
      ageScore: null,
      waistScore: null,
      activityScore: null,
      familyHistoryScore: null,
      riskTier: "not_applicable",
      breakdown,
      clinicalSummary:
        "Assessment inputs are incomplete or outside the validated adult range (age >= 18). Missing parameters cannot produce a fabricated score.",
    }
  }

  // 3. Age score
  let ageScore = 0
  let ageSummary = ""
  if (inputs.ageYears < 35) {
    ageScore = 0
    ageSummary = `Age ${inputs.ageYears}: younger adult demographic (< 35 years).`
  } else if (inputs.ageYears <= 49) {
    ageScore = 20
    ageSummary = `Age ${inputs.ageYears}: intermediate age bracket (35–49 years).`
  } else {
    ageScore = 30
    ageSummary = `Age ${inputs.ageYears}: age factor (≥ 50 years).`
  }

  // 4. Waist circumference score (gender-specific per MDRF cutoffs)
  let waistScore = 0
  let waistSummary = ""
  let waistRecommendation = ""
  if (inputs.gender === "female") {
    if (inputs.waistCircumferenceCm < 80) {
      waistScore = 0
      waistSummary = `Waist ${inputs.waistCircumferenceCm} cm: within standard healthy reference (< 80 cm for females).`
    } else if (inputs.waistCircumferenceCm <= 89) {
      waistScore = 10
      waistSummary = `Waist ${inputs.waistCircumferenceCm} cm: borderline abdominal measurement (80–89 cm for females).`
      waistRecommendation = "Aerobic movement and nutritional adjustments can help reduce central abdominal adiposity."
    } else {
      waistScore = 20
      waistSummary = `Waist ${inputs.waistCircumferenceCm} cm: elevated abdominal adiposity (≥ 90 cm for females).`
      waistRecommendation = "Consult your physician or clinical dietitian regarding targeted visceral fat reduction strategies."
    }
  } else {
    // male
    if (inputs.waistCircumferenceCm < 85) {
      waistScore = 0
      waistSummary = `Waist ${inputs.waistCircumferenceCm} cm: within standard healthy reference (< 85 cm for males).`
    } else if (inputs.waistCircumferenceCm <= 99) {
      waistScore = 10
      waistSummary = `Waist ${inputs.waistCircumferenceCm} cm: borderline abdominal measurement (85–99 cm for males).`
      waistRecommendation = "Structured weekly physical activity can help decrease abdominal circumference."
    } else {
      waistScore = 20
      waistSummary = `Waist ${inputs.waistCircumferenceCm} cm: elevated abdominal adiposity (≥ 100 cm for males).`
      waistRecommendation = "Discuss abdominal circumference management with your healthcare team."
    }
  }

  // 5. Physical activity score
  let activityScore = 0
  let activitySummary = ""
  let activityRecommendation = ""
  switch (inputs.physicalActivity) {
    case "vigorous":
      activityScore = 0
      activitySummary = "Vigorous regular physical exercise or strenuous daily work."
      break
    case "moderate":
      activityScore = 10
      activitySummary = "Moderate daily physical exercise or brisk walking routine."
      activityRecommendation = "Consider incorporating short resistance or intensity intervals if medically approved."
      break
    case "mild":
      activityScore = 20
      activitySummary = "Mild exercise with a predominantly sedentary daily routine."
      activityRecommendation = "Target at least 150 minutes of moderate aerobic activity weekly (such as brisk walking)."
      break
    case "sedentary":
      activityScore = 30
      activitySummary = "Sedentary routine with minimal daily physical movement."
      activityRecommendation = "Begin with daily 15-minute walks and reduce extended sitting intervals."
      break
  }

  // 6. Family history score
  let familyHistoryScore = 0
  let familyHistorySummary = ""
  switch (inputs.familyHistory) {
    case "none":
      familyHistoryScore = 0
      familyHistorySummary = "Neither parent has a history of type 2 diabetes."
      break
    case "one_parent":
      familyHistoryScore = 10
      familyHistorySummary = "One parent diagnosed with type 2 diabetes."
      break
    case "both_parents":
      familyHistoryScore = 20
      familyHistorySummary = "Both parents diagnosed with type 2 diabetes."
      break
  }

  const totalScore = ageScore + waistScore + activityScore + familyHistoryScore

  // 7. Risk tier determination
  let riskTier: "low" | "moderate" | "high"
  let clinicalSummary = ""
  if (totalScore < 30) {
    riskTier = "low"
    clinicalSummary =
      "Low diabetes risk profile (score < 30). Maintain balanced lifestyle habits, wholesome nutrition, and repeat periodic screening every 3 years."
  } else if (totalScore <= 59) {
    riskTier = "moderate"
    clinicalSummary =
      "Moderate diabetes risk profile (score 30–59). Lifestyle modifications focusing on routine physical activity and weight management are beneficial. Consider discussing screening with a doctor."
  } else {
    riskTier = "high"
    clinicalSummary =
      "High diabetes risk profile (score ≥ 60). Confirmatory clinical evaluation (such as fasting blood glucose or HbA1c test) by a qualified clinician is strongly advised to evaluate metabolic status."
  }

  const factors: FactorDetail[] = [
    {
      factor: "waist",
      label: "Abdominal adiposity (Waist)",
      score: waistScore,
      maxScore: 20,
      category: "modifiable",
      summary: waistSummary,
      recommendation: waistRecommendation || undefined,
    },
    {
      factor: "activity",
      label: "Physical activity level",
      score: activityScore,
      maxScore: 30,
      category: "modifiable",
      summary: activitySummary,
      recommendation: activityRecommendation || undefined,
    },
    {
      factor: "age",
      label: "Chronological age",
      score: ageScore,
      maxScore: 30,
      category: "non_modifiable",
      summary: ageSummary,
    },
    {
      factor: "family_history",
      label: "Family history",
      score: familyHistoryScore,
      maxScore: 20,
      category: "non_modifiable",
      summary: familyHistorySummary,
    },
  ]

  const breakdown: RiskFactorBreakdown = {
    factors,
    totalScore,
    riskTier,
    instrument: INSTRUMENT_NAME,
    instrumentVersion: INSTRUMENT_VERSION,
    limitations: IDRS_LIMITATIONS,
  }

  return {
    status: "completed",
    alreadyDiagnosed: false,
    totalScore,
    ageScore,
    waistScore,
    activityScore,
    familyHistoryScore,
    riskTier,
    breakdown,
    clinicalSummary,
  }
}

// ─── Persistence & Retrieval ────────────────────────────────────────────────

export interface SaveRiskAssessmentParams {
  tenantId: string
  patientId: string
  assessedByUserId: string
  inputs: RiskAssessmentInputs
  requestId?: string
}

export async function saveRiskAssessmentAtomic(
  params: SaveRiskAssessmentParams
): Promise<RiskAssessment> {
  const db = getDb()
  const calculation = calculateIDRS(params.inputs)

  return await db.transaction(async (tx) => {
    // 1. Insert immutable risk assessment snapshot
    const [record] = await tx
      .insert(riskAssessments)
      .values({
        tenantId: params.tenantId,
        patientId: params.patientId,
        assessedByUserId: params.assessedByUserId,
        status: calculation.status,
        instrumentName: INSTRUMENT_NAME,
        instrumentVersion: INSTRUMENT_VERSION,
        alreadyDiagnosed: calculation.alreadyDiagnosed,
        ageScore: calculation.ageScore,
        waistScore: calculation.waistScore,
        activityScore: calculation.activityScore,
        familyHistoryScore: calculation.familyHistoryScore,
        totalScore: calculation.totalScore,
        riskTier: calculation.riskTier,
        inputs: params.inputs,
        factorBreakdown: calculation.breakdown,
        clinicalSummary: calculation.clinicalSummary,
      })
      .returning()

    // 2. Record audit event
    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.assessedByUserId,
      action: "risk_assessment.created",
      resourceType: "risk_assessment",
      resourceId: record.id,
      purpose: "metabolic_health_screening",
      decision: "allow",
      requestId: params.requestId ?? `risk-${Date.now()}`,
    })

    // 3. Outbox event for potential projection
    await tx.insert(outboxEvents).values({
      tenantId: params.tenantId,
      aggregateType: "risk_assessment",
      aggregateId: record.id,
      aggregateVersion: 1,
      eventType: "risk_assessment.completed",
      schemaVersion: 1,
      payload: {
        assessmentId: record.id,
        patientId: params.patientId,
        riskTier: calculation.riskTier,
        totalScore: calculation.totalScore,
        instrument: INSTRUMENT_NAME,
        status: calculation.status,
      },
    })

    return record
  })
}

export async function getLatestRiskAssessment(
  patientId: string,
  tenantId: string
): Promise<RiskAssessment | null> {
  const db = getDb()

  const [record] = await db
    .select()
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.tenantId, tenantId),
        eq(riskAssessments.patientId, patientId)
      )
    )
    .orderBy(desc(riskAssessments.assessedAt))
    .limit(1)

  return record ?? null
}

export async function getRiskAssessmentHistory(
  patientId: string,
  tenantId: string,
  limit = 10
): Promise<RiskAssessment[]> {
  const db = getDb()

  return await db
    .select()
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.tenantId, tenantId),
        eq(riskAssessments.patientId, patientId)
      )
    )
    .orderBy(desc(riskAssessments.assessedAt))
    .limit(limit)
}
