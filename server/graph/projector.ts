import "server-only"
import { withNeo4jSession } from "./driver"
import { getDb } from "@/server/db"
import { outboxEvents } from "@/server/db/schema/events"
import { eq, and, lte, asc, sql } from "drizzle-orm"

export interface ProjectionReceipt {
  eventId: string
  aggregateId: string
  aggregateType: string
  aggregateVersion: number
  applied: boolean
  error?: string
}

const CONSUMER_NAME = "neo4j_graph_projector"

/**
 * Projects a single outbox event to Neo4j using parameterized,
 * version-monotonic Cypher MERGE operations.
 */
export async function projectOutboxEventToNeo4j(event: {
  id: string
  tenantId: string
  aggregateType: string
  aggregateId: string
  aggregateVersion: number
  eventType: string
  payload: Record<string, any>
}): Promise<boolean> {
  return await withNeo4jSession(async (session) => {
    const tx = session.beginTransaction()

    try {
      const receiptKey = `${CONSUMER_NAME}_${event.id}`

      // Check if event was already applied (deduplication)
      const receiptCheck = await tx.run(
        `MATCH (pr:ProjectionReceipt { receiptKey: $receiptKey }) RETURN pr.receiptKey as key`,
        { receiptKey }
      )

      if (receiptCheck.records.length > 0) {
        // Already applied
        await tx.commit()
        return true
      }

      switch (event.eventType) {
        case "patient.created": {
          const { ownerUserId, preferredName, yearOfBirth, gender } =
            event.payload

          await tx.run(
            `
            MERGE (t:Tenant { id: $tenantId })
            MERGE (u:User { id: $ownerUserId })
            MERGE (p:Patient { id: $patientId })
            ON CREATE SET
              p.tenantId = $tenantId,
              p.ownerUserId = $ownerUserId,
              p.yearOfBirth = $yearOfBirth,
              p.gender = $gender,
              p._version = $aggregateVersion,
              p._lastProjectedAt = datetime()
            ON MATCH SET
              p.yearOfBirth = CASE WHEN $aggregateVersion >= coalesce(p._version, 0) THEN $yearOfBirth ELSE p.yearOfBirth END,
              p.gender = CASE WHEN $aggregateVersion >= coalesce(p._version, 0) THEN $gender ELSE p.gender END,
              p._version = CASE WHEN $aggregateVersion >= coalesce(p._version, 0) THEN $aggregateVersion ELSE p._version END,
              p._lastProjectedAt = datetime()
            MERGE (u)-[:OWNS]->(p)
            MERGE (u)-[:MEMBER_OF]->(t)
            `,
            {
              tenantId: event.tenantId,
              ownerUserId,
              patientId: event.aggregateId,
              yearOfBirth: yearOfBirth ?? null,
              gender: gender ?? null,
              aggregateVersion: event.aggregateVersion,
            }
          )
          break
        }

        case "consent.granted": {
          const {
            consentId,
            patientId,
            grantorUserId,
            granteeUserId,
            scopes,
            purpose,
            policyVersion,
            expiresAt,
          } = event.payload

          await tx.run(
            `
            MERGE (t:Tenant { id: $tenantId })
            MERGE (p:Patient { id: $patientId })
            MERGE (grantor:User { id: $grantorUserId })
            MERGE (grantee:User { id: $granteeUserId })
            MERGE (c:Consent { id: $consentId })
            ON CREATE SET
              c.tenantId = $tenantId,
              c.patientId = $patientId,
              c.grantorUserId = $grantorUserId,
              c.granteeUserId = $granteeUserId,
              c.scopes = $scopes,
              c.purpose = $purpose,
              c.policyVersion = $policyVersion,
              c.expiresAt = $expiresAt,
              c.status = 'active',
              c._version = $aggregateVersion,
              c._lastProjectedAt = datetime()
            ON MATCH SET
              c.scopes = CASE WHEN $aggregateVersion >= coalesce(c._version, 0) THEN $scopes ELSE c.scopes END,
              c.expiresAt = CASE WHEN $aggregateVersion >= coalesce(c._version, 0) THEN $expiresAt ELSE c.expiresAt END,
              c.status = CASE WHEN $aggregateVersion >= coalesce(c._version, 0) THEN 'active' ELSE c.status END,
              c._version = CASE WHEN $aggregateVersion >= coalesce(c._version, 0) THEN $aggregateVersion ELSE c._version END,
              c._lastProjectedAt = datetime()
            MERGE (p)-[:HAS_CONSENT]->(c)
            MERGE (grantor)-[:GRANTED]->(c)
            MERGE (c)-[:GRANTS_TO]->(grantee)
            `,
            {
              tenantId: event.tenantId,
              patientId,
              grantorUserId,
              granteeUserId,
              consentId: consentId ?? event.aggregateId,
              scopes: scopes ?? [],
              purpose: purpose ?? "support",
              policyVersion: policyVersion ?? "1.0",
              expiresAt: expiresAt ?? null,
              aggregateVersion: event.aggregateVersion,
            }
          )
          break
        }

        case "consent.revoked": {
          const { consentId, revokedAt } = event.payload

          // Revoke the consent node and delete active GRANTS_TO relationship
          await tx.run(
            `
            MATCH (c:Consent { id: $consentId })
            WHERE $aggregateVersion >= coalesce(c._version, 0)
            SET c.revokedAt = $revokedAt,
                c.status = 'revoked',
                c._version = $aggregateVersion,
                c._lastProjectedAt = datetime()
            WITH c
            OPTIONAL MATCH (c)-[r:GRANTS_TO]->()
            DELETE r
            `,
            {
              consentId: consentId ?? event.aggregateId,
              revokedAt: revokedAt ?? new Date().toISOString(),
              aggregateVersion: event.aggregateVersion,
            }
          )
          break
        }

        case "observation.recorded": {
          const { patientId, type, unit, observedAt } = event.payload

          // Minimized aggregate projection - no medical free text or raw notes
          const summaryId = `${patientId}_${type}`

          await tx.run(
            `
            MERGE (p:Patient { id: $patientId })
            MERGE (o:ObservationSummary { id: $summaryId })
            ON CREATE SET
              o.tenantId = $tenantId,
              o.patientId = $patientId,
              o.type = $type,
              o.unit = $unit,
              o.count = 1,
              o.latestObservedAt = $observedAt,
              o._version = $aggregateVersion,
              o._lastProjectedAt = datetime()
            ON MATCH SET
              o.count = coalesce(o.count, 0) + 1,
              o.latestObservedAt = CASE WHEN $observedAt > coalesce(o.latestObservedAt, '') THEN $observedAt ELSE o.latestObservedAt END,
              o._version = CASE WHEN $aggregateVersion >= coalesce(o._version, 0) THEN $aggregateVersion ELSE o._version END,
              o._lastProjectedAt = datetime()
            MERGE (p)-[:HAS_OBSERVATION_TYPE]->(o)
            `,
            {
              tenantId: event.tenantId,
              patientId,
              summaryId,
              type,
              unit,
              observedAt: observedAt ?? new Date().toISOString(),
              aggregateVersion: event.aggregateVersion,
            }
          )
          break
        }

        default:
          // Unhandled event type, acknowledge safely
          break
      }

      // Record projection receipt
      await tx.run(
        `
        MERGE (pr:ProjectionReceipt { receiptKey: $receiptKey })
        ON CREATE SET
          pr.consumer = $consumer,
          pr.eventId = $eventId,
          pr.aggregateId = $aggregateId,
          pr.aggregateVersion = $aggregateVersion,
          pr.appliedAt = datetime()
        `,
        {
          receiptKey,
          consumer: CONSUMER_NAME,
          eventId: event.id,
          aggregateId: event.aggregateId,
          aggregateVersion: event.aggregateVersion,
        }
      )

      await tx.commit()
      return true
    } catch (err) {
      await tx.rollback()
      throw err
    }
  })
}

/**
 * Worker function to claim pending outbox events from PostgreSQL
 * and project them safely into Neo4j.
 * Handles transient failures with exponential backoff and status tracking.
 */
export async function projectPendingOutboxEvents(
  batchSize = 50,
  tenantId?: string
): Promise<{
  processed: number
  failed: number
  remaining: number
}> {
  const db = getDb()

  const conditions = [
    eq(outboxEvents.status, "pending"),
    lte(outboxEvents.nextAttemptAt, sql`now()`),
  ]
  if (tenantId) {
    conditions.push(eq(outboxEvents.tenantId, tenantId))
  }

  // 1. Fetch pending events ready for processing
  const pendingEvents = await db
    .select()
    .from(outboxEvents)
    .where(and(...conditions))
    .orderBy(asc(outboxEvents.occurredAt))
    .limit(batchSize)

  let processed = 0
  let failed = 0

  for (const event of pendingEvents) {
    try {
      await projectOutboxEventToNeo4j({
        id: event.id,
        tenantId: event.tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        aggregateVersion: event.aggregateVersion,
        eventType: event.eventType,
        payload: (event.payload as Record<string, any>) ?? {},
      })

      // Mark completed
      await db
        .update(outboxEvents)
        .set({
          status: "completed",
        })
        .where(eq(outboxEvents.id, event.id))

      processed++
    } catch (err: any) {
      failed++
      const nextAttempts = event.attempts + 1
      const isExhausted = nextAttempts >= 5

      // Bounded exponential backoff: 2s, 4s, 8s, 16s...
      const backoffMs = Math.min(1000 * Math.pow(2, nextAttempts), 60000)
      const nextAttemptAt = new Date(Date.now() + backoffMs)

      await db
        .update(outboxEvents)
        .set({
          status: isExhausted ? "failed" : "pending",
          attempts: nextAttempts,
          nextAttemptAt,
        })
        .where(eq(outboxEvents.id, event.id))
    }
  }

  // Count remaining pending events
  const remainingConditions = [eq(outboxEvents.status, "pending")]
  if (tenantId) {
    remainingConditions.push(eq(outboxEvents.tenantId, tenantId))
  }
  const remainingRows = await db
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(and(...remainingConditions))

  return {
    processed,
    failed,
    remaining: remainingRows.length,
  }
}
