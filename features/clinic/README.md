# Authorized clinic and health-worker follow-up

## Current state
Production-ready request-rendered clinic follow-up workspace under `/clinic` gated by server-assigned clinic organization roles (`role: "clinician"` in `memberships`), verified clinician credential profiles (`clinician_profiles`), and explicit patient-level care assignment (`care_assignments`). Non-clinicians, unverified clinicians, or client-supplied Clerk metadata cannot self-claim clinician authorization. Includes paginated/searchable follow-up worklist, auditable clinical follow-up actions with minimal audit logging, formula-injection-protected CSV and JSON summary exports, and bounded, duplicate-aware transactional bulk screening ingestion with dry-run review.

## Prerequisites
PostgreSQL database running with migration `0004_clinic_assignments.sql` applied. Verified clinic organization membership, clinician profile with `verificationStatus: 'verified'`, and active `care_assignments` to patients.

Read `../../PROMPTS.md`, `../../docs/architecture.md`, `../../docs/rendering.md`, `../../docs/data-model.md`, and `../../docs/security.md` before editing.

## Implementation prompt

> Implement a request-rendered clinic workspace gated by verified organization membership, server-assigned clinic roles and explicit patient-level assignment/consent. Do not treat any authenticated user or user-editable Clerk metadata as a clinician. Build paginated/searchable follow-up lists with shadcn Table, filters, accessible empty/error/loading states, minimal patient summaries and auditable follow-up actions. Bulk screening import must be file-size/row-count bounded, schema validated, dry-run reviewed, tenant-owned, duplicate-aware and transactional or chunk-idempotent; do not ingest unknown patient records without an approved consent workflow. Clinician export is an authorized summary with provenance and purpose, never a public document link or LLM diagnosis. Apply CSV formula-injection protections if CSV export is added.

## Acceptance checks
- [x] Unverified roles and cross-clinic/patient access denied in HTML/RSC/tRPC/export paths.
- [x] List/search/count endpoints cannot reveal unassigned patients.
- [x] Bulk import handles malformed/oversized/duplicate rows without partial silent success.
- [x] Follow-up action audit includes actor, time and purpose but no excess health content.
- [x] Private data never statically generated, indexed or shared-cached.

## Implemented architecture

1. **Database Schema & Constraints (`server/db/schema/clinic.ts` & `drizzle/0004_clinic_assignments.sql`)**:
   - `clinician_profiles`: `(tenant_id, user_id)` unique, verificationStatus (`unverified`, `verified`, `suspended`), license number, jurisdiction, and timestamps.
   - `care_assignments`: `(tenant_id, patient_id)` composite foreign key referencing `patients(tenant_id, id)` on delete cascade, `(tenant_id, patient_id, clinician_user_id, status)` unique, priority (`routine`, `urgent`), notes, timestamps.
   - `follow_up_actions`: `(tenant_id, patient_id)` composite FK, actionType (`phone_call`, `review`, `referral`, `message`, `in_person`), status, notes, timestamps.
   - `screenings`: `(tenant_id, patient_id)` composite FK, screeningType, numeric value, unit, batchId, screenedAt, unique `(tenant_id, patient_id, screening_type, screened_at)` for duplicate prevention.

2. **Repository Layer (`server/db/repositories/clinic.ts`)**:
   - `verifyClinicianMembership(clerkUserId, clinicTenantId?)`: Gating verification querying PostgreSQL `memberships` (`role = 'clinician'`, `status = 'active'`) + `tenants` (`kind = 'clinic'`, `status = 'active'`) + `clinician_profiles` (`verificationStatus = 'verified'`). Throws `FORBIDDEN` otherwise.
   - `listAssignedPatients(params)`: Queries strictly constrained to `care_assignments.clinicianUserId = clinician.id` and `care_assignments.tenantId = clinic.id`. Unassigned patients are structurally omitted from counts, searches, and results.
   - `recordFollowUpActionAtomic(params)`: Transactionally records action, updates assignment priority, and logs `audit_events` with actor, timestamp, purpose, and resource ID—never freeform clinical text in audit logs.
   - `exportPatientSummary(params)`: Authorized clinical summary with explicit purpose and provenance metadata. Includes formula-injection defense (`sanitizeCsvCell` prefixes dangerous spreadsheet formula execution characters `^[=+@\-\t\r]` with `'`).
   - `bulkImportScreeningsAtomic(params)`: Bounded to 500 rows, schema validated, duplicate-aware within batch and against database, verifies tenant ownership and consent for all patient IDs, supports non-destructive `dryRun: true`, and transactionally commits both screenings and clinical observations.

3. **tRPC Router (`server/trpc/routers/clinic.ts`)**:
   - `clinic.status`: Safe status query returning verification status and clinic name for UI display.
   - `clinic.worklist`: Paginated, priority-filtered, searchable worklist for assigned patients.
   - `clinic.patientHistory`: Audited history of follow-up actions for assigned patient.
   - `clinic.recordAction`: Mutation to log follow-up actions and update priority.
   - `clinic.exportSummary`: Generates audited CSV or JSON export summaries.
   - `clinic.bulkImport`: Transactional screening import with dry-run validation.

4. **UI & Routing (`app/(private)/clinic/page.tsx` & `features/clinic/components/clinic-dashboard.tsx`)**:
   - `app/(private)/clinic/page.tsx`: Server-rendered route (`export const dynamic = "force-dynamic"`) protected by Clerk auth and server-side clinician credential check. Unverified users see an accessible restricted notice explaining that clinician access cannot be self-claimed.
   - `ClinicDashboard`: Interactive workspace with shadcn `Table`, search input, priority filters (`all`, `routine`, `urgent`), empty/error/loading states, Log Action dialog, Action History dialog, Export Summary dialog with CSV download, and Bulk Screening Ingestion tab with dry-run review and sample roster loader.

## Verification results

```bash
# Vitest test suite execution
$ vitest run tests/clinic/clinic-router.test.ts
✓ tests/clinic/clinic-router.test.ts (16 tests) 1903ms
  ✓ Task 10: Authorized Clinic Follow-up Workspace (16)
    ✓ Acceptance Check 1: Role Verification & Cross-Tenant Access (4)
    ✓ Acceptance Check 2: Unassigned Patient Isolation (3)
    ✓ Acceptance Check 3: Bounded & Transactional Screening Ingestion (5)
    ✓ Acceptance Check 4: Follow-up Actions & Minimal Audit Trail (1)
    ✓ Acceptance Check 5: Authorized Summary Export & CSV Sanitization (3)
Test Files  1 passed (1)
     Tests  16 passed (16)

# Full test suite & build check
$ pnpm typecheck && pnpm test && pnpm build
✓ Finished TypeScript in 16.3s
✓ 14 test files passed, 99/99 tests passed
✓ Next.js production build succeeded with /clinic as dynamic (ƒ) and /preview as SSG (●)
```

## Status
COMPLETE. All acceptance criteria met and verified.
