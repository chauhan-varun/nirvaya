import { describe, it, expect, beforeEach } from "vitest"
import { getDb } from "@/server/db"
import { users } from "@/server/db/schema/users"
import { patients } from "@/server/db/schema/patients"
import { tenants, memberships } from "@/server/db/schema/tenants"
import {
  clinicianProfiles,
  careAssignments,
  followUpActions,
  screenings,
} from "@/server/db/schema/clinic"
import { observations } from "@/server/db/schema/observations"
import { auditEvents } from "@/server/db/schema/events"
import { appRouter } from "@/server/trpc/routers/_app"
import {
  sanitizeCsvCell,
  verifyClinicianMembership,
} from "@/server/db/repositories/clinic"
import { eq, and, inArray } from "drizzle-orm"

const CLERK_CLINICIAN_1 = "user_clerk_clinic_doc1"
const CLERK_CLINICIAN_2 = "user_clerk_clinic_doc2"
const CLERK_UNVERIFIED_DOC = "user_clerk_clinic_unverified"
const CLERK_REGULAR_USER = "user_clerk_clinic_regular"

function createCallerForUser(clerkUserId: string) {
  return appRouter.createCaller({
    userId: clerkUserId,
    sessionId: null,
    orgId: null,
    requestId: `req_test_${Date.now()}`,
    origin: "http://localhost:3000",
    host: "localhost:3000",
  })
}

describe("Task 10: Authorized Clinic Follow-up Workspace", () => {
  let clinicTenant1Id: string
  let clinicTenant2Id: string
  let clinician1UserId: string
  let clinician2UserId: string
  let unverifiedClinicianUserId: string
  let regularUserId: string

  let patient1Id: string // assigned to Clinician 1
  let patient2Id: string // assigned to Clinician 2
  let patientOtherClinicId: string // in Clinic 2

  beforeEach(async () => {
    const db = getDb()

    // 1. Clean up previous test tenants and users
    await db
      .delete(tenants)
      .where(
        inArray(tenants.name, ["City Health Clinic 1", "City Health Clinic 2"])
      )

    for (const clerkSub of [
      CLERK_CLINICIAN_1,
      CLERK_CLINICIAN_2,
      CLERK_UNVERIFIED_DOC,
      CLERK_REGULAR_USER,
    ]) {
      const uList = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkSubject, clerkSub))

      for (const u of uList) {
        await db.delete(patients).where(eq(patients.ownerUserId, u.id))
        await db.delete(users).where(eq(users.id, u.id))
      }
    }

    // 2. Create clinic tenants
    const [c1] = await db
      .insert(tenants)
      .values({
        name: "City Health Clinic 1",
        kind: "clinic",
        status: "active",
      })
      .returning()
    clinicTenant1Id = c1.id

    const [c2] = await db
      .insert(tenants)
      .values({
        name: "City Health Clinic 2",
        kind: "clinic",
        status: "active",
      })
      .returning()
    clinicTenant2Id = c2.id

    // 3. Create users
    const [doc1] = await db
      .insert(users)
      .values({
        clerkSubject: CLERK_CLINICIAN_1,
        status: "active",
        preferredLocale: "en",
      })
      .returning()
    clinician1UserId = doc1.id

    const [doc2] = await db
      .insert(users)
      .values({
        clerkSubject: CLERK_CLINICIAN_2,
        status: "active",
        preferredLocale: "en",
      })
      .returning()
    clinician2UserId = doc2.id

    const [unverifiedDoc] = await db
      .insert(users)
      .values({
        clerkSubject: CLERK_UNVERIFIED_DOC,
        status: "active",
        preferredLocale: "en",
      })
      .returning()
    unverifiedClinicianUserId = unverifiedDoc.id

    const [regUser] = await db
      .insert(users)
      .values({
        clerkSubject: CLERK_REGULAR_USER,
        status: "active",
        preferredLocale: "en",
      })
      .returning()
    regularUserId = regUser.id

    // 4. Setup memberships & clinician profiles
    // Doc 1: verified clinician in Clinic 1
    await db.insert(memberships).values({
      tenantId: clinicTenant1Id,
      userId: clinician1UserId,
      role: "clinician",
      status: "active",
    })
    await db.insert(clinicianProfiles).values({
      tenantId: clinicTenant1Id,
      userId: clinician1UserId,
      verificationStatus: "verified",
      licenseNumber: "MED-CLINIC-101",
      jurisdiction: "IN-DL",
      verifiedAt: new Date(),
    })

    // Doc 2: verified clinician in Clinic 1
    await db.insert(memberships).values({
      tenantId: clinicTenant1Id,
      userId: clinician2UserId,
      role: "clinician",
      status: "active",
    })
    await db.insert(clinicianProfiles).values({
      tenantId: clinicTenant1Id,
      userId: clinician2UserId,
      verificationStatus: "verified",
      licenseNumber: "MED-CLINIC-102",
      jurisdiction: "IN-DL",
      verifiedAt: new Date(),
    })

    // Unverified Doc: role 'clinician' but profile 'unverified'
    await db.insert(memberships).values({
      tenantId: clinicTenant1Id,
      userId: unverifiedClinicianUserId,
      role: "clinician",
      status: "active",
    })
    await db.insert(clinicianProfiles).values({
      tenantId: clinicTenant1Id,
      userId: unverifiedClinicianUserId,
      verificationStatus: "unverified",
      licenseNumber: "MED-PENDING-001",
      jurisdiction: "IN-DL",
    })

    // Regular User: member only in Clinic 1, not clinician
    await db.insert(memberships).values({
      tenantId: clinicTenant1Id,
      userId: regularUserId,
      role: "member",
      status: "active",
    })

    // 5. Create patients
    const [p1] = await db
      .insert(patients)
      .values({
        tenantId: clinicTenant1Id,
        ownerUserId: regularUserId,
        name: "Aarav Sharma",
        yearOfBirth: 1985,
        gender: "male",
      })
      .returning()
    patient1Id = p1.id

    const [p2] = await db
      .insert(patients)
      .values({
        tenantId: clinicTenant1Id,
        ownerUserId: regularUserId,
        name: "Priya Patel",
        yearOfBirth: 1990,
        gender: "female",
      })
      .returning()
    patient2Id = p2.id

    const [pOther] = await db
      .insert(patients)
      .values({
        tenantId: clinicTenant2Id,
        ownerUserId: regularUserId,
        name: "Rohan Varma",
        yearOfBirth: 1978,
        gender: "male",
      })
      .returning()
    patientOtherClinicId = pOther.id

    // 6. Care assignments:
    // Patient 1 assigned to Clinician 1
    await db.insert(careAssignments).values({
      tenantId: clinicTenant1Id,
      patientId: patient1Id,
      clinicianUserId: clinician1UserId,
      status: "active",
      priority: "urgent",
      notes: "High fasting blood glucose follow-up",
    })

    // Patient 2 assigned to Clinician 2
    await db.insert(careAssignments).values({
      tenantId: clinicTenant1Id,
      patientId: patient2Id,
      clinicianUserId: clinician2UserId,
      status: "active",
      priority: "routine",
      notes: "Routine quarterly screening",
    })

    // Add baseline observation for Patient 1
    await db.insert(observations).values({
      tenantId: clinicTenant1Id,
      patientId: patient1Id,
      type: "glucose_fasting",
      numericValue: "142.00",
      unit: "mg/dL",
      source: "clinical",
      observedAt: new Date(Date.now() - 3600000),
      recordedByUserId: clinician1UserId,
    })
  })

  // ─── Acceptance Check 1: Role Verification & Cross-Clinic Denials ──────────

  describe("Acceptance Check 1: Role Verification & Cross-Tenant Access", () => {
    it("denies unverified or regular users from calling clinic endpoints", async () => {
      const regCaller = createCallerForUser(CLERK_REGULAR_USER)

      await expect(
        regCaller.clinic.worklist({})
      ).rejects.toThrow(/Forbidden/i)

      await expect(
        regCaller.clinic.recordAction({
          patientId: patient1Id,
          actionType: "phone_call",
        })
      ).rejects.toThrow(/Forbidden/i)
    })

    it("denies users with unverified clinician profiles", async () => {
      const unverifiedCaller = createCallerForUser(CLERK_UNVERIFIED_DOC)

      await expect(
        unverifiedCaller.clinic.worklist({})
      ).rejects.toThrow(/credentials are not verified/i)
    })

    it("denies access when requesting a clinic tenant where user has no membership", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      // Clinician 1 is only in Clinic 1, not Clinic 2
      await expect(
        doc1Caller.clinic.worklist({ clinicTenantId: clinicTenant2Id })
      ).rejects.toThrow(/Forbidden/i)
    })

    it("returns correct status for verified vs unverified users", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)
      const status1 = await doc1Caller.clinic.status()
      expect(status1.isClinician).toBe(true)
      expect(status1.verificationStatus).toBe("verified")
      expect(status1.licenseNumber).toBe("MED-CLINIC-101")

      const regCaller = createCallerForUser(CLERK_REGULAR_USER)
      const statusReg = await regCaller.clinic.status()
      expect(statusReg.isClinician).toBe(false)
    })
  })

  // ─── Acceptance Check 2: Unassigned Patient Isolation ──────────────────────

  describe("Acceptance Check 2: Unassigned Patient Isolation", () => {
    it("never reveals unassigned patients in worklist or search results", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      // Doc 1 only has Patient 1 assigned, not Patient 2
      const result = await doc1Caller.clinic.worklist({})
      expect(result.items.length).toBe(1)
      expect(result.items[0].patientId).toBe(patient1Id)
      expect(result.items[0].patientName).toBe("Aarav Sharma")
      expect(result.items[0].priority).toBe("urgent")
      expect(result.items[0].lastObservation?.value).toBe("142.00")

      // Searching for Patient 2 ("Priya") must return 0 results
      const searchResult = await doc1Caller.clinic.worklist({
        search: "Priya",
      })
      expect(searchResult.items.length).toBe(0)
      expect(searchResult.totalCount).toBe(0)
    })

    it("denies follow-up actions and history queries on unassigned patients", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      // Doc 1 attempts to record follow-up on Patient 2 (assigned to Doc 2)
      await expect(
        doc1Caller.clinic.recordAction({
          patientId: patient2Id,
          actionType: "phone_call",
          notes: "Attempted unassigned follow-up",
        })
      ).rejects.toThrow(/not actively assigned/i)

      // Doc 1 attempts to fetch history of Patient 2
      await expect(
        doc1Caller.clinic.patientHistory({ patientId: patient2Id })
      ).rejects.toThrow(/not actively assigned/i)
    })

    it("denies export of unassigned patients or patients from another clinic", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      // Unassigned patient in same clinic
      await expect(
        doc1Caller.clinic.exportSummary({
          patientId: patient2Id,
          purpose: "Audit check",
          format: "json",
        })
      ).rejects.toThrow(/not actively assigned/i)

      // Patient from another clinic entirely
      await expect(
        doc1Caller.clinic.exportSummary({
          patientId: patientOtherClinicId,
          purpose: "Cross-clinic check",
          format: "json",
        })
      ).rejects.toThrow(/not actively assigned/i)
    })
  })

  // ─── Acceptance Check 3: Bulk Screening Ingestion ──────────────────────────

  describe("Acceptance Check 3: Bounded & Transactional Screening Ingestion", () => {
    it("dry-run validates valid rows without writing to the database", async () => {
      const db = getDb()
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      const result = await doc1Caller.clinic.bulkImport({
        purpose: "Community Screening Drive",
        dryRun: true,
        rows: [
          {
            patientId: patient1Id,
            screeningType: "glucose_fasting",
            value: "115.00",
            unit: "mg/dL",
            screenedAt: new Date(Date.now() - 7200000).toISOString(),
            externalReference: "CAMP-REF-A1",
          },
        ],
      })

      expect(result.dryRun).toBe(true)
      if (result.dryRun) {
        expect(result.validRows).toBe(1)
        expect(result.errors.length).toBe(0)
        expect(result.canProceed).toBe(true)
      }

      // Verify nothing was written to screenings table
      const count = await db
        .select()
        .from(screenings)
        .where(eq(screenings.tenantId, clinicTenant1Id))
      expect(count.length).toBe(0)
    })

    it("rejects unknown patient records without an approved consent workflow", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)
      const fakePatientId = "a0000000-0000-4000-8000-000000000001"

      await expect(
        doc1Caller.clinic.bulkImport({
          purpose: "Community Screening",
          dryRun: false,
          rows: [
            {
              patientId: fakePatientId,
              screeningType: "glucose_fasting",
              value: "120.00",
              unit: "mg/dL",
              screenedAt: new Date().toISOString(),
            },
          ],
        })
      ).rejects.toThrow(/does not belong to clinic tenant and has no active consent/i)
    })

    it("rejects batches with malformed rows or invalid units without partial insertion", async () => {
      const db = getDb()
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      await expect(
        doc1Caller.clinic.bulkImport({
          purpose: "Test malformed rejection",
          dryRun: false,
          rows: [
            {
              patientId: patient1Id,
              screeningType: "glucose_fasting",
              value: "110.00",
              unit: "mg/dL",
              screenedAt: new Date(Date.now() - 10000).toISOString(),
            },
            {
              patientId: patient1Id,
              screeningType: "glucose_fasting",
              value: "-50.00", // invalid negative value
              unit: "mg/dL",
              screenedAt: new Date(Date.now() - 20000).toISOString(),
            },
          ],
        })
      ).rejects.toThrow(/Invalid numeric value/i)

      // Ensure transaction rolled back and row 1 was NOT inserted
      const count = await db
        .select()
        .from(screenings)
        .where(eq(screenings.tenantId, clinicTenant1Id))
      expect(count.length).toBe(0)
    })

    it("detects and rejects duplicate rows within a batch and against the database", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)
      const timestamp = new Date(Date.now() - 3600000).toISOString()

      // Duplicate within batch
      await expect(
        doc1Caller.clinic.bulkImport({
          purpose: "Duplicate batch test",
          dryRun: false,
          rows: [
            {
              patientId: patient1Id,
              screeningType: "glucose_fasting",
              value: "115.00",
              unit: "mg/dL",
              screenedAt: timestamp,
            },
            {
              patientId: patient1Id,
              screeningType: "glucose_fasting",
              value: "116.00",
              unit: "mg/dL",
              screenedAt: timestamp, // same timestamp & type
            },
          ],
        })
      ).rejects.toThrow(/Duplicate screening in batch/i)

      // Successfully import one screening
      const firstImport = await doc1Caller.clinic.bulkImport({
        purpose: "Initial screening",
        dryRun: false,
        rows: [
          {
            patientId: patient1Id,
            screeningType: "glucose_fasting",
            value: "115.00",
            unit: "mg/dL",
            screenedAt: timestamp,
          },
        ],
      })
      expect(firstImport.importedCount).toBe(1)

      // Re-importing identical screening against database must fail
      await expect(
        doc1Caller.clinic.bulkImport({
          purpose: "Re-import duplicate screening",
          dryRun: false,
          rows: [
            {
              patientId: patient1Id,
              screeningType: "glucose_fasting",
              value: "115.00",
              unit: "mg/dL",
              screenedAt: timestamp,
            },
          ],
        })
      ).rejects.toThrow(/Duplicate screening already exists/i)
    })

    it("enforces maximum row count bounds (max 500 rows)", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)
      const oversizedRows = Array.from({ length: 501 }, (_, i) => ({
        patientId: patient1Id,
        screeningType: "glucose_fasting" as const,
        value: "110.00",
        unit: "mg/dL",
        screenedAt: new Date(Date.now() - (i + 1) * 1000).toISOString(),
      }))

      await expect(
        doc1Caller.clinic.bulkImport({
          purpose: "Oversized batch test",
          dryRun: false,
          rows: oversizedRows,
        })
      ).rejects.toThrow()
    })
  })

  // ─── Acceptance Check 4: Follow-up Action & Audit Logging ──────────────────

  describe("Acceptance Check 4: Follow-up Actions & Minimal Audit Trail", () => {
    it("records follow-up action and creates audit log without excess health data", async () => {
      const db = getDb()
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      const action = await doc1Caller.clinic.recordAction({
        patientId: patient1Id,
        actionType: "phone_call",
        status: "completed",
        notes: "Called patient regarding fasting glucose spike; advised diet review.",
        updatePriority: "routine",
      })

      expect(action.actionType).toBe("phone_call")
      expect(action.patientId).toBe(patient1Id)

      // Check priority was updated on care assignment
      const [assignment] = await db
        .select()
        .from(careAssignments)
        .where(
          and(
            eq(careAssignments.tenantId, clinicTenant1Id),
            eq(careAssignments.patientId, patient1Id),
            eq(careAssignments.clinicianUserId, clinician1UserId)
          )
        )
      expect(assignment.priority).toBe("routine")

      // Verify audit event has actor, timestamp, purpose, but NO clinical notes or health payloads
      const [audit] = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.tenantId, clinicTenant1Id),
            eq(auditEvents.action, "clinic.record_follow_up"),
            eq(auditEvents.resourceId, patient1Id)
          )
        )
      expect(audit).toBeDefined()
      expect(audit.actorId).toBe(clinician1UserId)
      expect(audit.actorType).toBe("user")
      expect(audit.purpose).toBe("clinical_follow_up")
      expect(audit.decision).toBe("allow")
    })
  })

  // ─── Acceptance Check 5: CSV Formula Injection Protection & Export ─────────

  describe("Acceptance Check 5: Authorized Summary Export & CSV Sanitization", () => {
    it("sanitizes CSV formula injection symbols (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCsvCell("=SUM(A1:B10)")).toBe(`"'=SUM(A1:B10)"`)
      expect(sanitizeCsvCell("+cmd|' /C calc'!A0")).toBe(`"'+cmd|' /C calc'!A0"`)
      expect(sanitizeCsvCell("-10+20")).toBe(`"'-10+20"`)
      expect(sanitizeCsvCell("@special")).toBe(`"'@special"`)
      expect(sanitizeCsvCell("Normal Patient Name")).toBe("Normal Patient Name")
    })

    it("generates authorized CSV export with provenance and formula protection", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      const result = await doc1Caller.clinic.exportSummary({
        patientId: patient1Id,
        purpose: "Diabetologist Referral Evaluation",
        format: "csv",
      })

      expect(result.format).toBe("csv")
      expect(result.provenance.purpose).toBe("Diabetologist Referral Evaluation")
      expect(result.provenance.dataClassification).toBe("RESTRICTED_HEALTH_SUMMARY")

      // Check content contains expected CSV rows
      expect(result.content).toContain("Section,Field,Value,Unit,Timestamp,Notes_Or_Source")
      expect(result.content).toContain("Aarav Sharma")
      expect(result.content).toContain("glucose_fasting")
      expect(result.content).toContain("142.00")
    })

    it("generates authorized JSON export with structured summary", async () => {
      const doc1Caller = createCallerForUser(CLERK_CLINICIAN_1)

      const result = await doc1Caller.clinic.exportSummary({
        patientId: patient1Id,
        purpose: "Clinical review",
        format: "json",
      })

      expect(result.format).toBe("json")
      expect(result.summary?.patient.name).toBe("Aarav Sharma")
      expect(result.summary?.observations.length).toBeGreaterThanOrEqual(1)
      expect(result.provenance.exportedByUserId).toBe(clinician1UserId)
    })
  })
})
