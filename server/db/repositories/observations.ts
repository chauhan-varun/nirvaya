import "server-only"
import { getDb } from "../index"
import {
  observations,
  type NewObservation,
  type Observation,
} from "../schema/observations"
import {
  auditEvents,
  outboxEvents,
  idempotencyRecords,
} from "../schema/events"
import { and, eq, gte, lte, desc, inArray } from "drizzle-orm"

export interface RecordObservationParams {
  observation: NewObservation
  actorId: string
  requestId: string
  purpose: string
  idempotencyKey?: string
}

export interface RecordObservationResult {
  observation: Observation
  outboxEventId: string
  isDuplicate?: boolean
}

/**
 * Pure medical unit conversion for blood glucose.
 * 1 mmol/L = 18.0182 mg/dL
 * Rounds strictly to 2 decimal places to prevent floating-point inaccuracy.
 */
export function convertGlucose(
  value: number,
  fromUnit: "mg/dL" | "mmol/L",
  toUnit: "mg/dL" | "mmol/L"
): number {
  if (fromUnit === toUnit) {
    return Math.round(value * 100) / 100
  }
  if (fromUnit === "mmol/L" && toUnit === "mg/dL") {
    return Math.round(value * 18.0182 * 100) / 100
  }
  return Math.round((value / 18.0182) * 100) / 100
}

export async function recordObservationAtomic(
  params: RecordObservationParams
): Promise<RecordObservationResult> {
  const db = getDb()

  return await db.transaction(async (tx) => {
    // 1. Idempotency Check (if key provided)
    if (params.idempotencyKey) {
      const existingRecords = await tx
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.tenantId, params.observation.tenantId),
            eq(idempotencyRecords.principalId, params.actorId),
            eq(idempotencyRecords.operation, "observation.record"),
            eq(idempotencyRecords.idempotencyKey, params.idempotencyKey)
          )
        )
        .limit(1)

      if (existingRecords[0] && existingRecords[0].status === "completed") {
        const cached = existingRecords[0].responseRef as {
          observation: Observation
          outboxEventId: string
        }
        return {
          observation: cached.observation,
          outboxEventId: cached.outboxEventId,
          isDuplicate: true,
        }
      }
    }

    // 2. Insert canonical observation
    const [obs] = await tx
      .insert(observations)
      .values(params.observation)
      .returning()

    // 3. Insert audit event
    await tx.insert(auditEvents).values({
      tenantId: obs.tenantId,
      actorType: "user",
      actorId: params.actorId,
      action: "observation.record",
      resourceType: "observation",
      resourceId: obs.id,
      purpose: params.purpose,
      decision: "allow",
      requestId: params.requestId,
    })

    // 4. Insert transactional outbox event for eventual Neo4j projection
    const [outbox] = await tx
      .insert(outboxEvents)
      .values({
        tenantId: obs.tenantId,
        aggregateType: "patient",
        aggregateId: obs.patientId,
        aggregateVersion: 1,
        eventType: "observation.recorded",
        schemaVersion: 1,
        payload: {
          observationId: obs.id,
          patientId: obs.patientId,
          type: obs.type,
          numericValue: obs.numericValue,
          unit: obs.unit,
          notes: obs.notes,
          observedAt: obs.observedAt.toISOString(),
          source: obs.source,
        },
      })
      .returning()

    // 5. Store idempotency record (24 hour expiration)
    if (params.idempotencyKey) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await tx.insert(idempotencyRecords).values({
        tenantId: obs.tenantId,
        principalId: params.actorId,
        operation: "observation.record",
        idempotencyKey: params.idempotencyKey,
        requestHash: `obs_${obs.type}_${obs.observedAt.getTime()}`,
        status: "completed",
        responseRef: {
          observation: obs,
          outboxEventId: outbox.id,
        },
        expiresAt,
      })
    }

    return {
      observation: obs,
      outboxEventId: outbox.id,
      isDuplicate: false,
    }
  })
}

export interface GetObservationsParams {
  tenantId: string
  patientId: string
  types?: (typeof observations.$inferSelect)["type"][]
  since?: Date
  until?: Date
  limit?: number
  offset?: number
}

export async function getObservationsByPatient(
  params: GetObservationsParams
): Promise<Observation[]> {
  const db = getDb()

  const conditions = [
    eq(observations.tenantId, params.tenantId),
    eq(observations.patientId, params.patientId),
  ]

  if (params.types && params.types.length > 0) {
    conditions.push(inArray(observations.type, params.types))
  }
  if (params.since) {
    conditions.push(gte(observations.observedAt, params.since))
  }
  if (params.until) {
    conditions.push(lte(observations.observedAt, params.until))
  }

  const queryLimit = Math.min(params.limit ?? 50, 100)
  const queryOffset = params.offset ?? 0

  return await db
    .select()
    .from(observations)
    .where(and(...conditions))
    .orderBy(desc(observations.observedAt))
    .limit(queryLimit)
    .offset(queryOffset)
}
