import "server-only"
import { withNeo4jSession } from "./driver"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { consentGrants } from "@/server/db/schema/consent"
import { and, eq, gt, isNull } from "drizzle-orm"

export interface CareGraphInsightDTO {
  patientId: string
  yearOfBirth: number | null
  gender: string | null
  ownerUserId: string
  activeConsents: Array<{
    consentId: string
    scopes: string[]
    purpose: string
    granteeId: string
  }>
  observationSummaries: Array<{
    type: string
    unit: string
    count: number
    latestObservedAt: string
  }>
}

/**
 * Retrieves grounded patient care graph insights.
 *
 * CRITICAL SECURITY GUARANTEE:
 * 1. Evaluates verified identity and active consent in canonical PostgreSQL FIRST.
 *    If consent is revoked in Postgres, access is blocked immediately, even before
 *    Neo4j outbox projection sync occurs.
 * 2. All Cypher queries are strictly parameterized, tenant-scoped, and bounded.
 * 3. Returns minimized, safe DTOs without sensitive raw medical text.
 */
export async function getAuthorizedCareGraphInsights(params: {
  clerkSubject: string
  patientId: string
  tenantId: string
  requiredScope?: string
}): Promise<CareGraphInsightDTO> {
  const db = getDb()

  // 1. Resolve internal caller user
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkSubject, params.clerkSubject))
    .limit(1)

  if (!user) {
    throw Object.assign(new Error("Caller user profile not found"), {
      code: "PRECONDITION_FAILED",
    })
  }

  // 2. Resolve target patient record
  const [patient] = await db
    .select({
      id: patients.id,
      tenantId: patients.tenantId,
      ownerUserId: patients.ownerUserId,
      yearOfBirth: patients.yearOfBirth,
      gender: patients.gender,
    })
    .from(patients)
    .where(
      and(
        eq(patients.id, params.patientId),
        eq(patients.tenantId, params.tenantId)
      )
    )
    .limit(1)

  if (!patient) {
    throw Object.assign(new Error("Patient not found in this tenant"), {
      code: "NOT_FOUND",
    })
  }

  // 3. PostgreSQL Canonical Authorization
  const isOwner = patient.ownerUserId === user.id

  if (!isOwner) {
    // If not owner, check active, unexpired, unrevoked consent grant
    const now = new Date()
    const grants = await db
      .select({ id: consentGrants.id, scopes: consentGrants.scopes })
      .from(consentGrants)
      .where(
        and(
          eq(consentGrants.tenantId, params.tenantId),
          eq(consentGrants.patientId, params.patientId),
          eq(consentGrants.granteeUserId, user.id),
          isNull(consentGrants.revokedAt),
          gt(consentGrants.expiresAt, now)
        )
      )

    if (grants.length === 0) {
      throw Object.assign(
        new Error(
          "Access denied: no active consent grant found for this patient."
        ),
        { code: "FORBIDDEN" }
      )
    }

    if (params.requiredScope) {
      const allScopes = grants.flatMap((g) => (g.scopes as string[]) ?? [])
      if (!allScopes.includes(params.requiredScope)) {
        throw Object.assign(
          new Error(
            `Access denied: consent grant does not include requested scope '${params.requiredScope}'`
          ),
          { code: "FORBIDDEN" }
        )
      }
    }
  }

  // 4. Grounded Graph Query (Parameterized, Tenant-Scoped, Bounded)
  return await withNeo4jSession(async (session) => {
    const result = await session.run(
      `
      MATCH (p:Patient { id: $patientId, tenantId: $tenantId })
      OPTIONAL MATCH (u:User)-[:OWNS]->(p)
      OPTIONAL MATCH (p)-[:HAS_CONSENT]->(c:Consent)
        WHERE (c.status = 'active' OR c.status IS NULL) AND c.revokedAt IS NULL
      OPTIONAL MATCH (c)-[:GRANTS_TO]->(grantee:User)
      OPTIONAL MATCH (p)-[:HAS_OBSERVATION_TYPE]->(o:ObservationSummary)
      RETURN
        p.id as patientId,
        p.yearOfBirth as yearOfBirth,
        p.gender as gender,
        u.id as ownerUserId,
        collect(DISTINCT {
          consentId: c.id,
          scopes: coalesce(c.scopes, []),
          purpose: coalesce(c.purpose, ''),
          granteeId: grantee.id
        }) as activeConsents,
        collect(DISTINCT {
          type: o.type,
          unit: o.unit,
          count: o.count,
          latestObservedAt: o.latestObservedAt
        }) as observationSummaries
      LIMIT 1
      `,
      {
        patientId: params.patientId,
        tenantId: params.tenantId,
      }
    )

    const record = result.records[0]
    if (!record) {
      // If graph is not yet projected, fall back safely to canonical Postgres data
      return {
        patientId: patient.id,
        yearOfBirth: patient.yearOfBirth,
        gender: patient.gender,
        ownerUserId: patient.ownerUserId,
        activeConsents: [],
        observationSummaries: [],
      }
    }

    // Filter out null elements from collection aggregation
    const rawConsents = record.get("activeConsents") ?? []
    const cleanConsents = rawConsents.filter(
      (c: any) => c && c.consentId !== null
    )

    const rawObs = record.get("observationSummaries") ?? []
    const cleanObs = rawObs
      .filter((o: any) => o && o.type !== null)
      .map((o: any) => ({
        type: o.type,
        unit: o.unit,
        count: typeof o.count?.toInt === "function" ? o.count.toInt() : Number(o.count || 0),
        latestObservedAt: String(o.latestObservedAt || ""),
      }))

    return {
      patientId: record.get("patientId") || patient.id,
      yearOfBirth: record.get("yearOfBirth") ?? patient.yearOfBirth,
      gender: record.get("gender") ?? patient.gender,
      ownerUserId: record.get("ownerUserId") || patient.ownerUserId,
      activeConsents: cleanConsents,
      observationSummaries: cleanObs,
    }
  })
}
