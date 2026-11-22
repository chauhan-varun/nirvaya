import "server-only"
import { getDb } from "../index"
import {
  clinicianProfiles,
  careAssignments,
  followUpActions,
  screenings,
  type ClinicianProfile,
  type CareAssignment,
  type FollowUpAction,
} from "../schema/clinic"
import { memberships, tenants, type Tenant } from "../schema/tenants"
import { users, type User } from "../schema/users"
import { patients, type Patient } from "../schema/patients"
import { observations } from "../schema/observations"
import { auditEvents } from "../schema/events"
import { consentGrants } from "../schema/consent"
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm"
import crypto from "node:crypto"

export interface VerifiedClinicianContext {
  user: User
  tenant: Tenant
  profile: ClinicianProfile
}

/**
 * Formula injection protection: prepends single-quote to any cell
 * beginning with dangerous spreadsheet execution symbols (=, +, -, @, \t, \r).
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value).trim()
  if (/^[=+@\-\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Verifies that the requesting Clerk user has an active, verified clinician role
 * in the specified or default clinic tenant. Never relies on user metadata.
 */
export async function verifyClinicianMembership(
  clerkUserId: string,
  clinicTenantId?: string
): Promise<VerifiedClinicianContext> {
  const db = getDb()

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkSubject, clerkUserId))
    .limit(1)

  if (!user) {
    throw Object.assign(
      new Error("User profile not found. Please complete onboarding first."),
      { code: "FORBIDDEN" }
    )
  }

  // Find membership with role 'clinician' and active status
  const membershipConditions = [
    eq(memberships.userId, user.id),
    eq(memberships.role, "clinician"),
    eq(memberships.status, "active"),
  ]

  if (clinicTenantId) {
    membershipConditions.push(eq(memberships.tenantId, clinicTenantId))
  }

  const userMemberships = await db
    .select({
      membership: memberships,
      tenant: tenants,
    })
    .from(memberships)
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .where(
      and(
        ...membershipConditions,
        eq(tenants.kind, "clinic"),
        eq(tenants.status, "active")
      )
    )
    .limit(1)

  if (userMemberships.length === 0) {
    throw Object.assign(
      new Error("Forbidden: verified clinician organization membership required"),
      { code: "FORBIDDEN" }
    )
  }

  const { tenant } = userMemberships[0]

  // Verify clinician profile verification status
  const [profile] = await db
    .select()
    .from(clinicianProfiles)
    .where(
      and(
        eq(clinicianProfiles.tenantId, tenant.id),
        eq(clinicianProfiles.userId, user.id)
      )
    )
    .limit(1)

  if (!profile || profile.verificationStatus !== "verified") {
    throw Object.assign(
      new Error("Forbidden: clinician credentials are not verified or suspended"),
      { code: "FORBIDDEN" }
    )
  }

  return { user, tenant, profile }
}

/**
 * Checks clinician status safely without throwing for UI display gating.
 */
export async function getClinicianStatus(clerkUserId: string) {
  const db = getDb()

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkSubject, clerkUserId))
    .limit(1)

  if (!user) {
    return {
      isClinician: false,
      verificationStatus: null,
      clinicTenantId: null,
      clinicName: null,
      licenseNumber: null,
    }
  }

  const results = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      verificationStatus: clinicianProfiles.verificationStatus,
      licenseNumber: clinicianProfiles.licenseNumber,
    })
    .from(memberships)
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .leftJoin(
      clinicianProfiles,
      and(
        eq(clinicianProfiles.tenantId, tenants.id),
        eq(clinicianProfiles.userId, user.id)
      )
    )
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.role, "clinician"),
        eq(memberships.status, "active"),
        eq(tenants.kind, "clinic"),
        eq(tenants.status, "active")
      )
    )
    .limit(1)

  if (results.length === 0) {
    return {
      isClinician: false,
      verificationStatus: null,
      clinicTenantId: null,
      clinicName: null,
      licenseNumber: null,
    }
  }

  const row = results[0]
  const isVerified = row.verificationStatus === "verified"

  return {
    isClinician: isVerified,
    verificationStatus: row.verificationStatus,
    clinicTenantId: row.tenantId,
    clinicName: row.tenantName,
    licenseNumber: row.licenseNumber,
  }
}

export interface ListAssignedPatientsParams {
  clinicianUserId: string
  tenantId: string
  search?: string
  priority?: "all" | "routine" | "urgent"
  status?: "all" | "active" | "completed" | "cancelled"
  page?: number
  pageSize?: number
}

export async function listAssignedPatients(params: ListAssignedPatientsParams) {
  const db = getDb()
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 10))
  const offset = (page - 1) * pageSize

  // Build conditions: MUST filter strictly by (tenantId, clinicianUserId)
  const conditions = [
    eq(careAssignments.tenantId, params.tenantId),
    eq(careAssignments.clinicianUserId, params.clinicianUserId),
  ]

  if (params.status && params.status !== "all") {
    conditions.push(eq(careAssignments.status, params.status))
  } else if (!params.status) {
    conditions.push(eq(careAssignments.status, "active"))
  }

  if (params.priority && params.priority !== "all") {
    conditions.push(eq(careAssignments.priority, params.priority))
  }

  if (params.search && params.search.trim()) {
    conditions.push(ilike(patients.name, `%${params.search.trim()}%`))
  }

  // Count total matching assigned patients
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(careAssignments)
    .innerJoin(
      patients,
      and(
        eq(careAssignments.patientId, patients.id),
        eq(careAssignments.tenantId, patients.tenantId)
      )
    )
    .where(and(...conditions))

  const totalCount = countResult?.count ?? 0

  // Fetch paginated assignments with patient details
  const rows = await db
    .select({
      assignmentId: careAssignments.id,
      patientId: patients.id,
      patientName: patients.name,
      yearOfBirth: patients.yearOfBirth,
      gender: patients.gender,
      priority: careAssignments.priority,
      status: careAssignments.status,
      assignedAt: careAssignments.assignedAt,
      notes: careAssignments.notes,
    })
    .from(careAssignments)
    .innerJoin(
      patients,
      and(
        eq(careAssignments.patientId, patients.id),
        eq(careAssignments.tenantId, patients.tenantId)
      )
    )
    .where(and(...conditions))
    .orderBy(desc(careAssignments.assignedAt))
    .limit(pageSize)
    .offset(offset)

  // Enrich each row with latest observation and follow-up action counts
  const items = await Promise.all(
    rows.map(async (row) => {
      const [lastObs] = await db
        .select({
          type: observations.type,
          numericValue: observations.numericValue,
          unit: observations.unit,
          observedAt: observations.observedAt,
        })
        .from(observations)
        .where(
          and(
            eq(observations.tenantId, params.tenantId),
            eq(observations.patientId, row.patientId)
          )
        )
        .orderBy(desc(observations.observedAt))
        .limit(1)

      const [actionCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(followUpActions)
        .where(
          and(
            eq(followUpActions.tenantId, params.tenantId),
            eq(followUpActions.patientId, row.patientId)
          )
        )

      return {
        ...row,
        lastObservation: lastObs
          ? {
              type: lastObs.type,
              value: lastObs.numericValue,
              unit: lastObs.unit,
              observedAt: lastObs.observedAt,
            }
          : null,
        followUpActionsCount: actionCount?.count ?? 0,
      }
    })
  )

  return {
    items,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    page,
    pageSize,
  }
}

/**
 * Asserts that the clinician is explicitly assigned to this patient in the tenant.
 * Throws FORBIDDEN if not assigned or patient does not exist.
 */
async function assertClinicianAssignedToPatient(
  clinicianUserId: string,
  tenantId: string,
  patientId: string
) {
  const db = getDb()

  const [assignment] = await db
    .select()
    .from(careAssignments)
    .where(
      and(
        eq(careAssignments.tenantId, tenantId),
        eq(careAssignments.clinicianUserId, clinicianUserId),
        eq(careAssignments.patientId, patientId),
        eq(careAssignments.status, "active")
      )
    )
    .limit(1)

  if (!assignment) {
    throw Object.assign(
      new Error("Forbidden: you are not actively assigned to this patient"),
      { code: "FORBIDDEN" }
    )
  }

  return assignment
}

export interface RecordFollowUpActionParams {
  clinicianUserId: string
  tenantId: string
  patientId: string
  actionType: "phone_call" | "review" | "referral" | "message" | "in_person"
  status?: "completed" | "scheduled" | "cancelled"
  notes?: string
  performedAt?: Date
  updatePriority?: "routine" | "urgent"
  requestId: string
}

export async function recordFollowUpActionAtomic(
  params: RecordFollowUpActionParams
): Promise<FollowUpAction> {
  const db = getDb()

  // 1. Assert active care assignment
  await assertClinicianAssignedToPatient(
    params.clinicianUserId,
    params.tenantId,
    params.patientId
  )

  return await db.transaction(async (tx) => {
    // 2. Insert follow up action
    const [action] = await tx
      .insert(followUpActions)
      .values({
        tenantId: params.tenantId,
        patientId: params.patientId,
        clinicianUserId: params.clinicianUserId,
        actionType: params.actionType,
        status: params.status ?? "completed",
        notes: params.notes?.trim() || null,
        performedAt: params.performedAt ?? new Date(),
      })
      .returning()

    // 3. Update priority if requested
    if (params.updatePriority) {
      await tx
        .update(careAssignments)
        .set({
          priority: params.updatePriority,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(careAssignments.tenantId, params.tenantId),
            eq(careAssignments.patientId, params.patientId),
            eq(careAssignments.clinicianUserId, params.clinicianUserId),
            eq(careAssignments.status, "active")
          )
        )
    }

    // 4. Audit log: record action metadata, NEVER excess health content
    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.clinicianUserId,
      action: "clinic.record_follow_up",
      resourceType: "patient",
      resourceId: params.patientId,
      purpose: "clinical_follow_up",
      decision: "allow",
      requestId: params.requestId,
    })

    return action
  })
}

export async function getPatientFollowUpHistory(
  clinicianUserId: string,
  tenantId: string,
  patientId: string
): Promise<FollowUpAction[]> {
  const db = getDb()

  // Assert active assignment
  await assertClinicianAssignedToPatient(clinicianUserId, tenantId, patientId)

  return await db
    .select()
    .from(followUpActions)
    .where(
      and(
        eq(followUpActions.tenantId, tenantId),
        eq(followUpActions.patientId, patientId)
      )
    )
    .orderBy(desc(followUpActions.performedAt))
}

export interface ExportPatientSummaryParams {
  clinicianUserId: string
  tenantId: string
  patientId: string
  purpose: string
  format: "json" | "csv"
  requestId: string
}

export async function exportPatientSummary(params: ExportPatientSummaryParams) {
  const db = getDb()

  if (!params.purpose || params.purpose.trim().length === 0) {
    throw Object.assign(
      new Error("Export purpose is required for clinical data disclosure"),
      { code: "BAD_REQUEST" }
    )
  }

  // 1. Assert active assignment
  await assertClinicianAssignedToPatient(
    params.clinicianUserId,
    params.tenantId,
    params.patientId
  )

  // 2. Fetch minimal patient data
  const [patient] = await db
    .select({
      id: patients.id,
      name: patients.name,
      yearOfBirth: patients.yearOfBirth,
      gender: patients.gender,
    })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, params.tenantId),
        eq(patients.id, params.patientId)
      )
    )
    .limit(1)

  if (!patient) {
    throw Object.assign(new Error("Patient not found"), { code: "NOT_FOUND" })
  }

  // 3. Fetch observations (recent 20)
  const obsList = await db
    .select({
      type: observations.type,
      numericValue: observations.numericValue,
      unit: observations.unit,
      observedAt: observations.observedAt,
      source: observations.source,
    })
    .from(observations)
    .where(
      and(
        eq(observations.tenantId, params.tenantId),
        eq(observations.patientId, params.patientId)
      )
    )
    .orderBy(desc(observations.observedAt))
    .limit(20)

  // 4. Fetch follow-up actions (recent 10)
  const actionsList = await db
    .select({
      actionType: followUpActions.actionType,
      status: followUpActions.status,
      notes: followUpActions.notes,
      performedAt: followUpActions.performedAt,
    })
    .from(followUpActions)
    .where(
      and(
        eq(followUpActions.tenantId, params.tenantId),
        eq(followUpActions.patientId, params.patientId)
      )
    )
    .orderBy(desc(followUpActions.performedAt))
    .limit(10)

  const provenance = {
    exportedByUserId: params.clinicianUserId,
    tenantId: params.tenantId,
    patientId: params.patientId,
    exportedAt: new Date().toISOString(),
    purpose: params.purpose.trim(),
    dataClassification: "RESTRICTED_HEALTH_SUMMARY",
  }

  // 5. Append audit log
  await db.insert(auditEvents).values({
    tenantId: params.tenantId,
    actorType: "user",
    actorId: params.clinicianUserId,
    action: "clinic.export_summary",
    resourceType: "patient",
    resourceId: params.patientId,
    purpose: params.purpose.trim(),
    decision: "allow",
    requestId: params.requestId,
  })

  if (params.format === "json") {
    return {
      format: "json" as const,
      summary: {
        patient,
        observations: obsList,
        followUpActions: actionsList,
      },
      provenance,
    }
  }

  // CSV formatting with strict formula injection sanitization
  const csvHeaders = [
    "Section",
    "Field",
    "Value",
    "Unit",
    "Timestamp",
    "Notes_Or_Source",
  ].join(",")

  const csvRows: string[] = [csvHeaders]

  // Provenance rows
  csvRows.push(
    [
      sanitizeCsvCell("Provenance"),
      sanitizeCsvCell("ExportedBy"),
      sanitizeCsvCell(provenance.exportedByUserId),
      "",
      sanitizeCsvCell(provenance.exportedAt),
      sanitizeCsvCell(`Purpose: ${provenance.purpose}`),
    ].join(",")
  )

  // Patient demographic rows
  csvRows.push(
    [
      sanitizeCsvCell("Patient"),
      sanitizeCsvCell("PatientId"),
      sanitizeCsvCell(patient.id),
      "",
      "",
      "",
    ].join(",")
  )
  csvRows.push(
    [
      sanitizeCsvCell("Patient"),
      sanitizeCsvCell("Name"),
      sanitizeCsvCell(patient.name ?? "Anonymous"),
      "",
      "",
      "",
    ].join(",")
  )
  csvRows.push(
    [
      sanitizeCsvCell("Patient"),
      sanitizeCsvCell("YearOfBirth"),
      sanitizeCsvCell(patient.yearOfBirth),
      "",
      "",
      "",
    ].join(",")
  )

  // Observation rows
  for (const obs of obsList) {
    csvRows.push(
      [
        sanitizeCsvCell("Observation"),
        sanitizeCsvCell(obs.type),
        sanitizeCsvCell(obs.numericValue),
        sanitizeCsvCell(obs.unit),
        sanitizeCsvCell(obs.observedAt.toISOString()),
        sanitizeCsvCell(obs.source),
      ].join(",")
    )
  }

  // Follow-up action rows
  for (const act of actionsList) {
    csvRows.push(
      [
        sanitizeCsvCell("FollowUpAction"),
        sanitizeCsvCell(act.actionType),
        sanitizeCsvCell(act.status),
        "",
        sanitizeCsvCell(act.performedAt.toISOString()),
        sanitizeCsvCell(act.notes ?? ""),
      ].join(",")
    )
  }

  return {
    format: "csv" as const,
    content: csvRows.join("\n"),
    provenance,
  }
}

export interface BulkImportScreeningRow {
  patientId: string
  screeningType:
    | "glucose_fasting"
    | "glucose_random"
    | "systolic_bp"
    | "diastolic_bp"
    | "weight"
  value: string
  unit: string
  screenedAt: string
  externalReference?: string
}

export interface BulkImportScreeningsParams {
  clinicianUserId: string
  tenantId: string
  dryRun: boolean
  purpose: string
  rows: BulkImportScreeningRow[]
  requestId: string
}

export async function bulkImportScreeningsAtomic(
  params: BulkImportScreeningsParams
) {
  const db = getDb()

  // 1. Bounds checking: 1 to 500 rows
  if (!params.rows || params.rows.length === 0) {
    throw Object.assign(new Error("No rows provided for screening import"), {
      code: "BAD_REQUEST",
    })
  }

  if (params.rows.length > 500) {
    throw Object.assign(
      new Error(`Import row count exceeds maximum limit of 500 rows (received ${params.rows.length})`),
      { code: "BAD_REQUEST" }
    )
  }

  // Validate purpose
  if (!params.purpose || params.purpose.trim().length === 0) {
    throw Object.assign(new Error("Screening import purpose is required"), {
      code: "BAD_REQUEST",
    })
  }

  const errors: string[] = []
  const validScreeningTypes = new Set([
    "glucose_fasting",
    "glucose_random",
    "systolic_bp",
    "diastolic_bp",
    "weight",
  ])

  const seenInBatch = new Set<string>()
  const parsedRows: Array<{
    patientId: string
    screeningType: BulkImportScreeningRow["screeningType"]
    value: string
    unit: string
    screenedAt: Date
    externalReference?: string
  }> = []

  // 2. Validate row schema & bounds
  for (let i = 0; i < params.rows.length; i++) {
    const r = params.rows[i]
    const rowNum = i + 1

    if (!r.patientId || typeof r.patientId !== "string") {
      errors.push(`Row ${rowNum}: Missing or invalid patientId`)
      continue
    }

    if (!validScreeningTypes.has(r.screeningType)) {
      errors.push(`Row ${rowNum}: Unsupported screeningType '${r.screeningType}'`)
      continue
    }

    const num = Number(r.value)
    if (isNaN(num) || num <= 0 || !isFinite(num)) {
      errors.push(`Row ${rowNum}: Invalid numeric value '${r.value}'`)
      continue
    }

    if (!r.unit || typeof r.unit !== "string") {
      errors.push(`Row ${rowNum}: Missing unit`)
      continue
    }

    const date = new Date(r.screenedAt)
    if (isNaN(date.getTime())) {
      errors.push(`Row ${rowNum}: Invalid screenedAt date '${r.screenedAt}'`)
      continue
    }

    // Must not be in the far future (allow 5 min clock skew)
    if (date.getTime() > Date.now() + 5 * 60 * 1000) {
      errors.push(`Row ${rowNum}: screenedAt cannot be in the future`)
      continue
    }

    // Check duplicate within batch
    const batchKey = `${r.patientId}:${r.screeningType}:${date.toISOString()}`
    if (seenInBatch.has(batchKey)) {
      errors.push(
        `Row ${rowNum}: Duplicate screening in batch for patient ${r.patientId} at ${date.toISOString()}`
      )
      continue
    }
    seenInBatch.add(batchKey)

    parsedRows.push({
      patientId: r.patientId,
      screeningType: r.screeningType,
      value: num.toFixed(2),
      unit: r.unit.trim(),
      screenedAt: date,
      externalReference: r.externalReference?.trim(),
    })
  }

  // 3. Verify patient consent / care assignment in this clinic tenant
  // "do not ingest unknown patient records without an approved consent workflow."
  const distinctPatientIds = Array.from(
    new Set(parsedRows.map((r) => r.patientId))
  )

  if (distinctPatientIds.length > 0) {
    // Check that patients belong to this tenant OR have active consent grant to this tenant
    const clinicPatients = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.tenantId, params.tenantId),
          inArray(patients.id, distinctPatientIds)
        )
      )

    const clinicPatientIdSet = new Set(clinicPatients.map((p) => p.id))

    // For any patient not directly in clinic tenant, check active consent to clinic tenant
    const missingPatientIds = distinctPatientIds.filter(
      (pid) => !clinicPatientIdSet.has(pid)
    )

    if (missingPatientIds.length > 0) {
      const consentedPatients = await db
        .select({ patientId: consentGrants.patientId })
        .from(consentGrants)
        .where(
          and(
            inArray(consentGrants.patientId, missingPatientIds),
            eq(consentGrants.granteeOrgId, params.tenantId),
            sql`${consentGrants.revokedAt} IS NULL`,
            sql`${consentGrants.expiresAt} > now()`
          )
        )

      const consentedIdSet = new Set(consentedPatients.map((c) => c.patientId))

      for (const missingId of missingPatientIds) {
        if (!consentedIdSet.has(missingId)) {
          errors.push(
            `Patient ${missingId} does not belong to clinic tenant and has no active consent`
          )
        }
      }
    }
  }

  // 4. Check for existing database duplicates
  for (const row of parsedRows) {
    const [existing] = await db
      .select({ id: screenings.id })
      .from(screenings)
      .where(
        and(
          eq(screenings.tenantId, params.tenantId),
          eq(screenings.patientId, row.patientId),
          eq(screenings.screeningType, row.screeningType),
          eq(screenings.screenedAt, row.screenedAt)
        )
      )
      .limit(1)

    if (existing) {
      errors.push(
        `Duplicate screening already exists in clinic database for patient ${row.patientId} (${row.screeningType}) at ${row.screenedAt.toISOString()}`
      )
    }
  }

  // 5. Handle Dry Run Review
  if (params.dryRun) {
    return {
      dryRun: true as const,
      totalRows: params.rows.length,
      validRows: errors.length === 0 ? parsedRows.length : 0,
      errors,
      canProceed: errors.length === 0,
    }
  }

  // 6. Fail completely on any error - NO partial silent success!
  if (errors.length > 0) {
    throw Object.assign(
      new Error(
        `Screening import rejected with ${errors.length} error(s):\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ""}`
      ),
      { code: "BAD_REQUEST", details: errors }
    )
  }

  // 7. Transactional insertion of screenings and observations
  const batchId = crypto.randomUUID()

  await db.transaction(async (tx) => {
    for (const row of parsedRows) {
      // Insert screening record
      await tx.insert(screenings).values({
        tenantId: params.tenantId,
        patientId: row.patientId,
        screenedByUserId: params.clinicianUserId,
        screeningType: row.screeningType,
        value: row.value,
        unit: row.unit,
        batchId,
        externalReference: row.externalReference,
        screenedAt: row.screenedAt,
      })

      // Also record corresponding observation with source: 'clinical'
      await tx.insert(observations).values({
        tenantId: params.tenantId,
        patientId: row.patientId,
        type: row.screeningType,
        numericValue: row.value,
        unit: row.unit,
        source: "clinical",
        observedAt: row.screenedAt,
        recordedByUserId: params.clinicianUserId,
        qualityFlags: ["clinic_screened", `batch:${batchId}`],
      })
    }

    // Record audit event
    await tx.insert(auditEvents).values({
      tenantId: params.tenantId,
      actorType: "user",
      actorId: params.clinicianUserId,
      action: "clinic.bulk_import",
      resourceType: "clinic",
      resourceId: params.tenantId,
      purpose: params.purpose.trim(),
      decision: "allow",
      requestId: params.requestId,
    })
  })

  return {
    dryRun: false as const,
    success: true,
    batchId,
    importedCount: parsedRows.length,
  }
}
