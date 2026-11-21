import { describe, it, expect } from "vitest"
import {
  users,
  tenants,
  memberships,
  patients,
  patientDelegations,
  consentGrants,
  consentEvents,
  observations,
  auditEvents,
  outboxEvents,
  idempotencyRecords,
} from "@/server/db/schema"
import { getTableColumns } from "drizzle-orm"

describe("Drizzle Schema Contracts & Constraints", () => {
  it("defines users, tenants, and memberships tables", () => {
    const userCols = getTableColumns(users)
    expect(userCols.id).toBeDefined()
    expect(userCols.clerkSubject).toBeDefined()
    expect(userCols.status).toBeDefined()
    expect(userCols.preferredLocale).toBeDefined()

    const tenantCols = getTableColumns(tenants)
    expect(tenantCols.id).toBeDefined()
    expect(tenantCols.kind).toBeDefined()

    const membershipCols = getTableColumns(memberships)
    expect(membershipCols.tenantId).toBeDefined()
    expect(membershipCols.userId).toBeDefined()
    expect(membershipCols.role).toBeDefined()
  })

  it("defines patients and patientDelegations table with tenant-ownership structure", () => {
    const cols = getTableColumns(patients)
    expect(cols.id).toBeDefined()
    expect(cols.tenantId).toBeDefined()
    expect(cols.ownerUserId).toBeDefined()

    const delegationCols = getTableColumns(patientDelegations)
    expect(delegationCols.tenantId).toBeDefined()
    expect(delegationCols.patientId).toBeDefined()
    expect(delegationCols.delegateUserId).toBeDefined()
    expect(delegationCols.authorityType).toBeDefined()
  })

  it("defines observations with exact numeric precision, unit, and source", () => {
    const cols = getTableColumns(observations)
    expect(cols.numericValue).toBeDefined()
    expect(cols.unit).toBeDefined()
    expect(cols.observedAt).toBeDefined()
    expect(cols.source).toBeDefined()
    expect(cols.tenantId).toBeDefined()
    expect(cols.patientId).toBeDefined()
  })

  it("defines outboxEvents, auditEvents, and idempotencyRecords", () => {
    const outboxCols = getTableColumns(outboxEvents)
    expect(outboxCols.aggregateType).toBeDefined()
    expect(outboxCols.aggregateId).toBeDefined()
    expect(outboxCols.payload).toBeDefined()
    expect(outboxCols.status).toBeDefined()

    const auditCols = getTableColumns(auditEvents)
    expect(auditCols.action).toBeDefined()
    expect(auditCols.actorId).toBeDefined()
    expect(auditCols.requestId).toBeDefined()

    const idempCols = getTableColumns(idempotencyRecords)
    expect(idempCols.principalId).toBeDefined()
    expect(idempCols.operation).toBeDefined()
    expect(idempCols.idempotencyKey).toBeDefined()
  })

  it("defines consentGrants and consentEvents with scopes and revocability", () => {
    const consentCols = getTableColumns(consentGrants)
    expect(consentCols.scopes).toBeDefined()
    expect(consentCols.purpose).toBeDefined()
    expect(consentCols.expiresAt).toBeDefined()
    expect(consentCols.revokedAt).toBeDefined()

    const eventCols = getTableColumns(consentEvents)
    expect(eventCols.consentId).toBeDefined()
    expect(eventCols.eventType).toBeDefined()
  })
})
