import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { devices } from "@/server/db/schema/devices"
import { observations } from "@/server/db/schema/observations"
import {
  enrollDeviceAtomic,
  revokeDeviceAtomic,
  rotateDeviceSecretAtomic,
  listDevicesForPatient,
} from "@/server/db/repositories/devices"
import { ArduinoStationSimulator } from "@/hardware/simulator"
import { and, desc, eq } from "drizzle-orm"

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

export const devicesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { patient } = await resolvePatientForActor(ctx.userId)

    return await listDevicesForPatient({
      tenantId: patient.tenantId,
      patientId: patient.id,
    })
  }),

  enroll: protectedProcedure
    .input(
      z
        .object({
          model: z.string().max(50).default("arduino_uno_q_station"),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(
        ctx.userId
      )

      try {
        return await enrollDeviceAtomic({
          tenantId: patient.tenantId,
          patientId: patient.id,
          ownerUserId: internalUserId,
          model: input?.model,
          requestId: ctx.requestId,
        })
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to enroll hardware station",
        })
      }
    }),

  revoke: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid("Invalid device ID"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(
        ctx.userId
      )

      try {
        await revokeDeviceAtomic({
          deviceId: input.deviceId,
          tenantId: patient.tenantId,
          patientId: patient.id,
          ownerUserId: internalUserId,
          requestId: ctx.requestId,
        })
        return { success: true }
      } catch (err: any) {
        if (err.code === "NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND", message: err.message })
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to revoke device",
        })
      }
    }),

  rotateSecret: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid("Invalid device ID"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { internalUserId, patient } = await resolvePatientForActor(
        ctx.userId
      )

      try {
        return await rotateDeviceSecretAtomic({
          deviceId: input.deviceId,
          tenantId: patient.tenantId,
          patientId: patient.id,
          ownerUserId: internalUserId,
          requestId: ctx.requestId,
        })
      } catch (err: any) {
        if (err.code === "NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND", message: err.message })
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to rotate device secret",
        })
      }
    }),

  recentReadings: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid("Invalid device ID"),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { patient } = await resolvePatientForActor(ctx.userId)
      const db = getDb()

      const readings = await db
        .select({
          id: observations.id,
          type: observations.type,
          numericValue: observations.numericValue,
          unit: observations.unit,
          observedAt: observations.observedAt,
          receivedAt: observations.receivedAt,
        })
        .from(observations)
        .where(
          and(
            eq(observations.tenantId, patient.tenantId),
            eq(observations.patientId, patient.id),
            eq(observations.deviceId, input.deviceId),
            eq(observations.source, "device")
          )
        )
        .orderBy(desc(observations.observedAt))
        .limit(input.limit)

      return readings
    }),

  simulateReading: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid("Invalid device ID"),
        kind: z.enum(["presence", "ambient_temperature"]),
        value: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { patient } = await resolvePatientForActor(ctx.userId)
      const db = getDb()

      // Look up device
      const [device] = await db
        .select()
        .from(devices)
        .where(
          and(
            eq(devices.id, input.deviceId),
            eq(devices.tenantId, patient.tenantId),
            eq(devices.patientId, patient.id)
          )
        )
        .limit(1)

      if (!device) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
        })
      }

      if (device.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Device is currently ${device.status}`,
        })
      }

      const simulator = new ArduinoStationSimulator({
        deviceExternalId: device.externalId,
        secretKey: device.secretKey,
        keyVersion: device.keyVersion,
      })

      const reading =
        input.kind === "presence"
          ? simulator.generatePresenceReading(input.value === 1)
          : simulator.generateAmbientTemperatureReading(input.value)

      const prepared = simulator.prepareSignedRequest({
        readings: [reading],
      })

      // Send to local endpoint internally
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const res = await fetch(`${appUrl}/api/devices/events`, {
        method: "POST",
        headers: prepared.headers,
        body: prepared.body,
      })

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({ error: "Unknown" }))
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errorJson.error || "Simulation failed to ingest",
        })
      }

      return await res.json()
    }),
})
