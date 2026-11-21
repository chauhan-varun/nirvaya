import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { getDb } from "@/server/db"
import { patients } from "@/server/db/schema/patients"
import { users } from "@/server/db/schema/users"
import { completeOnboardingAtomic } from "@/server/db/repositories/onboarding"
import { transcribeAudioChunk } from "@/server/integrations/sarvam"
import { eq } from "drizzle-orm"

const currentYear = new Date().getFullYear()

export const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb()

    // 1. Resolve internal user by clerkSubject
    const userRes = await db
      .select({ id: users.id, preferredLocale: users.preferredLocale })
      .from(users)
      .where(eq(users.clerkSubject, ctx.userId))
      .limit(1)

    if (!userRes[0]) {
      return { completed: false, patient: null }
    }

    // 2. Check if a patient record exists for this user
    const patientRes = await db
      .select({
        id: patients.id,
        name: patients.name,
        yearOfBirth: patients.yearOfBirth,
        gender: patients.gender,
        tenantId: patients.tenantId,
      })
      .from(patients)
      .where(eq(patients.ownerUserId, userRes[0].id))
      .limit(1)

    if (!patientRes[0]) {
      return { completed: false, patient: null }
    }

    return {
      completed: true,
      patient: patientRes[0],
    }
  }),

  submit: protectedProcedure
    .input(
      z.object({
        preferredName: z
          .string()
          .trim()
          .min(2, "Name must be at least 2 characters")
          .max(50, "Name must not exceed 50 characters"),
        yearOfBirth: z
          .number()
          .int()
          .min(1900, "Please enter a valid year of birth")
          .max(
            currentYear - 18,
            "CareBridge is designed for adult metabolic health management (18+)"
          ),
        gender: z
          .enum(["female", "male", "other", "prefer_not_to_say"])
          .optional(),
        healthDataConsent: z
          .boolean()
          .refine(
            (val) => val === true,
            "Explicit health data processing consent is required to proceed"
          ),
        preferredLocale: z.string().default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb()

      // Resolve internal user
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkSubject, ctx.userId))
        .limit(1)

      if (!user) {
        const [newUser] = await db
          .insert(users)
          .values({
            clerkSubject: ctx.userId,
            preferredLocale: input.preferredLocale,
          })
          .returning()
        user = newUser
      }

      const result = await completeOnboardingAtomic({
        userId: user.id,
        preferredName: input.preferredName,
        yearOfBirth: input.yearOfBirth,
        gender: input.gender,
        preferredLocale: input.preferredLocale,
        requestId: ctx.requestId,
      })

      return {
        success: true,
        patientId: result.patient.id,
        tenantId: result.tenantId,
      }
    }),

  transcribeAudio: protectedProcedure
    .input(
      z.object({
        audioBase64: z.string().min(1, "Audio payload cannot be empty"),
        mimeType: z.string().default("audio/webm"),
        languageCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const audioBuffer = Buffer.from(input.audioBase64, "base64")

      const result = await transcribeAudioChunk({
        audioBuffer,
        mimeType: input.mimeType,
        languageCode: input.languageCode,
      })

      if (result.status === "unavailable") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: result.reason,
        })
      }

      if (result.status === "error") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.message,
        })
      }

      return {
        transcript: result.transcript,
        languageCode: result.languageCode,
      }
    }),
})
