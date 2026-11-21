import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import {
  recordObservationAtomic,
  getObservationsByPatient,
} from "@/server/db/repositories/observations"
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

function parseAndValidateObservedAt(dateStr: string): Date {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid observedAt date format. Must be a valid ISO-8601 string.",
    })
  }

  const nowWithGrace = Date.now() + 15 * 60 * 1000 // 15 min clock skew grace
  if (date.getTime() > nowWithGrace) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Observation timestamp cannot be in the future.",
    })
  }

  return date
}

export const journalRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          types: z
            .array(
              z.enum([
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
              ])
            )
            .optional(),
          since: z.string().optional(),
          until: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({ limit: 50, offset: 0 })
    )
    .query(async ({ ctx, input }) => {
      const { patient } = await resolvePatientForActor(ctx.userId)

      const since = input.since ? new Date(input.since) : undefined
      const until = input.until ? new Date(input.until) : undefined

      const records = await getObservationsByPatient({
        tenantId: patient.tenantId,
        patientId: patient.id,
        types: input.types,
        since,
        until,
        limit: input.limit,
        offset: input.offset,
      })

      return {
        observations: records,
        count: records.length,
      }
    }),

  recordGlucose: protectedProcedure
    .input(
      z.object({
        value: z.number().positive("Blood glucose must be greater than 0"),
        unit: z.enum(["mg/dL", "mmol/L"]),
        context: z.enum([
          "glucose_fasting",
          "glucose_postprandial",
          "glucose_random",
        ]),
        observedAt: z.string(),
        notes: z.string().max(300).optional(),
        idempotencyKey: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)
      const observedAt = parseAndValidateObservedAt(input.observedAt)

      // Clinical plausible boundary validation (prevent egregious entry error)
      if (input.unit === "mg/dL" && (input.value < 20 || input.value > 600)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Glucose value out of plausible physiological range (20–600 mg/dL). Please verify entry.",
        })
      }
      if (input.unit === "mmol/L" && (input.value < 1.1 || input.value > 33.3)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Glucose value out of plausible physiological range (1.1–33.3 mmol/L). Please verify entry.",
        })
      }

      const result = await recordObservationAtomic({
        observation: {
          tenantId: patient.tenantId,
          patientId: patient.id,
          type: input.context,
          numericValue: input.value.toFixed(2),
          unit: input.unit,
          notes: input.notes,
          observedAt,
          source: "manual",
          recordedByUserId: internalUserId,
          qualityFlags: ["self_reported"],
        },
        actorId: internalUserId,
        requestId: ctx.requestId,
        purpose: "clinical_journal_glucose",
        idempotencyKey: input.idempotencyKey,
      })

      return {
        success: true,
        observationId: result.observation.id,
        isDuplicate: result.isDuplicate ?? false,
      }
    }),

  recordMeal: protectedProcedure
    .input(
      z.object({
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        description: z
          .string()
          .trim()
          .min(2, "Meal description must be at least 2 characters")
          .max(200, "Meal description must not exceed 200 characters"),
        carbsGrams: z.number().nonnegative().max(500).optional(),
        observedAt: z.string(),
        idempotencyKey: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)
      const observedAt = parseAndValidateObservedAt(input.observedAt)

      const result = await recordObservationAtomic({
        observation: {
          tenantId: patient.tenantId,
          patientId: patient.id,
          type: "meal",
          numericValue: (input.carbsGrams ?? 1).toFixed(2),
          unit: input.carbsGrams !== undefined ? "grams" : "servings",
          notes: input.description,
          observedAt,
          source: "manual",
          recordedByUserId: internalUserId,
          qualityFlags: [input.mealType],
        },
        actorId: internalUserId,
        requestId: ctx.requestId,
        purpose: "clinical_journal_meal",
        idempotencyKey: input.idempotencyKey,
      })

      return {
        success: true,
        observationId: result.observation.id,
        isDuplicate: result.isDuplicate ?? false,
      }
    }),

  recordActivity: protectedProcedure
    .input(
      z.object({
        activityType: z.enum([
          "walking",
          "running",
          "cycling",
          "yoga",
          "strength",
          "other",
        ]),
        durationMinutes: z
          .number()
          .int()
          .min(1, "Activity must be at least 1 minute")
          .max(720, "Activity must not exceed 720 minutes (12 hours)"),
        notes: z.string().max(200).optional(),
        observedAt: z.string(),
        idempotencyKey: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)
      const observedAt = parseAndValidateObservedAt(input.observedAt)

      const result = await recordObservationAtomic({
        observation: {
          tenantId: patient.tenantId,
          patientId: patient.id,
          type: "activity",
          numericValue: input.durationMinutes.toFixed(2),
          unit: "minutes",
          notes: input.notes,
          observedAt,
          source: "manual",
          recordedByUserId: internalUserId,
          qualityFlags: [input.activityType],
        },
        actorId: internalUserId,
        requestId: ctx.requestId,
        purpose: "clinical_journal_activity",
        idempotencyKey: input.idempotencyKey,
      })

      return {
        success: true,
        observationId: result.observation.id,
        isDuplicate: result.isDuplicate ?? false,
      }
    }),

  recordSleep: protectedProcedure
    .input(
      z.object({
        durationHours: z
          .number()
          .min(0.5, "Sleep duration must be at least 30 minutes (0.5 hours)")
          .max(24, "Sleep duration must not exceed 24 hours"),
        quality: z.enum(["restful", "interrupted", "light"]).optional(),
        notes: z.string().max(200).optional(),
        observedAt: z.string(),
        idempotencyKey: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)
      const observedAt = parseAndValidateObservedAt(input.observedAt)

      const result = await recordObservationAtomic({
        observation: {
          tenantId: patient.tenantId,
          patientId: patient.id,
          type: "sleep",
          numericValue: input.durationHours.toFixed(2),
          unit: "hours",
          notes: input.notes,
          observedAt,
          source: "manual",
          recordedByUserId: internalUserId,
          qualityFlags: input.quality ? [input.quality] : ["normal"],
        },
        actorId: internalUserId,
        requestId: ctx.requestId,
        purpose: "clinical_journal_sleep",
        idempotencyKey: input.idempotencyKey,
      })

      return {
        success: true,
        observationId: result.observation.id,
        isDuplicate: result.isDuplicate ?? false,
      }
    }),

  recordHydration: protectedProcedure
    .input(
      z.object({
        amountMl: z
          .number()
          .int()
          .min(50, "Hydration entry must be at least 50 mL")
          .max(5000, "Hydration entry must not exceed 5000 mL"),
        observedAt: z.string(),
        idempotencyKey: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)
      const observedAt = parseAndValidateObservedAt(input.observedAt)

      const result = await recordObservationAtomic({
        observation: {
          tenantId: patient.tenantId,
          patientId: patient.id,
          type: "hydration",
          numericValue: input.amountMl.toFixed(2),
          unit: "mL",
          observedAt,
          source: "manual",
          recordedByUserId: internalUserId,
          qualityFlags: ["self_reported"],
        },
        actorId: internalUserId,
        requestId: ctx.requestId,
        purpose: "clinical_journal_hydration",
        idempotencyKey: input.idempotencyKey,
      })

      return {
        success: true,
        observationId: result.observation.id,
        isDuplicate: result.isDuplicate ?? false,
      }
    }),

  recordMedication: protectedProcedure
    .input(
      z.object({
        medicationName: z
          .string()
          .trim()
          .min(2, "Medication name must be at least 2 characters")
          .max(100, "Medication name must not exceed 100 characters"),
        dose: z
          .string()
          .trim()
          .min(1, "Prescribed dose must be entered")
          .max(50, "Prescribed dose must not exceed 50 characters"),
        notes: z.string().max(200).optional(),
        observedAt: z.string(),
        idempotencyKey: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(ctx.userId)
      const observedAt = parseAndValidateObservedAt(input.observedAt)

      const result = await recordObservationAtomic({
        observation: {
          tenantId: patient.tenantId,
          patientId: patient.id,
          type: "medication",
          numericValue: "1.00",
          unit: "dose",
          notes: `${input.medicationName} (${input.dose})${input.notes ? ` - ${input.notes}` : ""}`,
          observedAt,
          source: "manual",
          recordedByUserId: internalUserId,
          qualityFlags: ["prescribed_log"],
        },
        actorId: internalUserId,
        requestId: ctx.requestId,
        purpose: "clinical_journal_medication",
        idempotencyKey: input.idempotencyKey,
      })

      return {
        success: true,
        observationId: result.observation.id,
        isDuplicate: result.isDuplicate ?? false,
      }
    }),
})
