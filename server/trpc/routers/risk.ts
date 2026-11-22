import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import {
  calculateIDRS,
  saveRiskAssessmentAtomic,
  getLatestRiskAssessment,
  getRiskAssessmentHistory,
  INSTRUMENT_NAME,
  INSTRUMENT_VERSION,
  IDRS_LIMITATIONS,
} from "@/server/db/repositories/risk"
import { eq } from "drizzle-orm"

async function resolvePatientForActor(userId: string) {
  const db = getDb()

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkSubject, userId))
    .limit(1)

  if (!user) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "User profile not found. Please complete onboarding first.",
    })
  }

  const [patient] = await db
    .select({
      id: patients.id,
      tenantId: patients.tenantId,
      name: patients.name,
      yearOfBirth: patients.yearOfBirth,
      gender: patients.gender,
    })
    .from(patients)
    .where(eq(patients.ownerUserId, user.id))
    .limit(1)

  if (!patient) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Patient record not found. Please complete onboarding first.",
    })
  }

  return { internalUserId: user.id, patient }
}

const assessInputSchema = z.object({
  ageYears: z.number().int().min(18, "Age must be at least 18 years").max(120),
  gender: z.enum(["male", "female"]),
  waistCircumferenceCm: z
    .number()
    .min(30, "Waist circumference must be at least 30 cm")
    .max(250, "Waist circumference must be realistic"),
  physicalActivity: z.enum(["vigorous", "moderate", "mild", "sedentary"]),
  familyHistory: z.enum(["none", "one_parent", "both_parents"]),
  alreadyDiagnosed: z.boolean().default(false),
})

export const riskRouter = router({
  /**
   * Evaluate input parameters without persisting (interactive preview/calculation).
   */
  evaluatePreview: protectedProcedure
    .input(assessInputSchema)
    .query(({ input }) => {
      const calculation = calculateIDRS(input)
      return calculation
    }),

  /**
   * Fetch the latest persisted risk assessment for the authenticated patient.
   */
  latest: protectedProcedure.query(async ({ ctx }) => {
    const { patient } = await resolvePatientForActor(ctx.userId)
    const latest = await getLatestRiskAssessment(patient.id, patient.tenantId)

    // Calculate baseline age if available from patient record
    const currentYear = new Date().getFullYear()
    const inferredAge = patient.yearOfBirth
      ? currentYear - patient.yearOfBirth
      : null

    return {
      assessment: latest
        ? {
            id: latest.id,
            status: latest.status,
            instrumentName: latest.instrumentName,
            instrumentVersion: latest.instrumentVersion,
            alreadyDiagnosed: latest.alreadyDiagnosed,
            totalScore: latest.totalScore,
            ageScore: latest.ageScore,
            waistScore: latest.waistScore,
            activityScore: latest.activityScore,
            familyHistoryScore: latest.familyHistoryScore,
            riskTier: latest.riskTier,
            inputs: latest.inputs,
            factorBreakdown: latest.factorBreakdown,
            clinicalSummary: latest.clinicalSummary,
            assessedAt: latest.assessedAt.toISOString(),
          }
        : null,
      patientProfile: {
        name: patient.name,
        inferredAge,
        gender: patient.gender,
      },
      instrument: {
        name: INSTRUMENT_NAME,
        version: INSTRUMENT_VERSION,
        limitations: IDRS_LIMITATIONS,
      },
    }
  }),

  /**
   * Fetch historical assessment records for tracking changes over time.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { patient } = await resolvePatientForActor(ctx.userId)
      const records = await getRiskAssessmentHistory(
        patient.id,
        patient.tenantId,
        input.limit
      )

      return {
        entries: records.map((r) => ({
          id: r.id,
          status: r.status,
          totalScore: r.totalScore,
          riskTier: r.riskTier,
          alreadyDiagnosed: r.alreadyDiagnosed,
          assessedAt: r.assessedAt.toISOString(),
          clinicalSummary: r.clinicalSummary,
        })),
        total: records.length,
      }
    }),

  /**
   * Perform deterministic scoring and atomically persist the immutable assessment record.
   */
  assess: protectedProcedure
    .input(assessInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)

      const record = await saveRiskAssessmentAtomic({
        tenantId: patient.tenantId,
        patientId: patient.id,
        assessedByUserId: internalUserId,
        inputs: input,
        requestId: ctx.requestId,
      })

      return {
        success: true,
        assessment: {
          id: record.id,
          status: record.status,
          instrumentName: record.instrumentName,
          instrumentVersion: record.instrumentVersion,
          alreadyDiagnosed: record.alreadyDiagnosed,
          totalScore: record.totalScore,
          ageScore: record.ageScore,
          waistScore: record.waistScore,
          activityScore: record.activityScore,
          familyHistoryScore: record.familyHistoryScore,
          riskTier: record.riskTier,
          inputs: record.inputs,
          factorBreakdown: record.factorBreakdown,
          clinicalSummary: record.clinicalSummary,
          assessedAt: record.assessedAt.toISOString(),
        },
      }
    }),
})
