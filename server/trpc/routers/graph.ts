import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { outboxEvents } from "@/server/db/schema/events"
import { eq, sql, asc } from "drizzle-orm"
import {
  getAuthorizedCareGraphInsights,
  projectPendingOutboxEvents,
  initializeGraphSchema,
} from "@/server/graph"

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

export const graphRouter = router({
  /**
   * Initialize graph uniqueness constraints idempotently.
   */
  initSchema: protectedProcedure.mutation(async () => {
    try {
      await initializeGraphSchema()
      return { success: true, message: "Neo4j schema constraints initialized" }
    } catch (err: any) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to initialize Neo4j schema: ${err.message}`,
      })
    }
  }),

  /**
   * Retrieves grounded care graph insights for a patient.
   * Authorizes canonical PostgreSQL first — if consent is revoked, denies access immediately.
   */
  insights: protectedProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          requiredScope: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      let patientId: string
      let tenantId: string

      if (input?.patientId) {
        patientId = input.patientId
        // Lookup patient's tenant
        const db = getDb()
        const [p] = await db
          .select({ tenantId: patients.tenantId })
          .from(patients)
          .where(eq(patients.id, patientId))
          .limit(1)

        if (!p) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient not found",
          })
        }
        tenantId = p.tenantId
      } else {
        const resolved = await resolvePatientForActor(ctx.userId)
        patientId = resolved.patient.id
        tenantId = resolved.patient.tenantId
      }

      try {
        return await getAuthorizedCareGraphInsights({
          clerkSubject: ctx.userId,
          patientId,
          tenantId,
          requiredScope: input?.requiredScope,
        })
      } catch (err: any) {
        if (err.code === "FORBIDDEN") {
          throw new TRPCError({ code: "FORBIDDEN", message: err.message })
        }
        if (err.code === "NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND", message: err.message })
        }
        if (err.code === "PRECONDITION_FAILED") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message })
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to retrieve graph insights",
        })
      }
    }),

  /**
   * Triggers a drain/projection of pending outbox events into Neo4j.
   */
  sync: protectedProcedure
    .input(
      z
        .object({
          batchSize: z.number().int().min(1).max(100).default(25),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      try {
        const result = await projectPendingOutboxEvents(input?.batchSize ?? 25)
        return result
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Outbox projection failed: ${err.message}`,
        })
      }
    }),

  /**
   * Returns outbox projection queue health and sync metrics.
   */
  status: protectedProcedure.query(async () => {
    const db = getDb()

    const counts = await db
      .select({
        status: outboxEvents.status,
        count: sql<number>`count(*)::int`,
      })
      .from(outboxEvents)
      .groupBy(outboxEvents.status)

    const oldestPending = await db
      .select({ occurredAt: outboxEvents.occurredAt })
      .from(outboxEvents)
      .where(eq(outboxEvents.status, "pending"))
      .orderBy(asc(outboxEvents.occurredAt))
      .limit(1)

    const statusMap: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    for (const row of counts) {
      statusMap[row.status] = row.count
    }

    return {
      pending: statusMap.pending,
      processing: statusMap.processing,
      completed: statusMap.completed,
      failed: statusMap.failed,
      oldestPendingAt: oldestPending[0]?.occurredAt?.toISOString() ?? null,
    }
  }),
})
