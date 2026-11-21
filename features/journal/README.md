# Daily logs and trends

## Current state
IMPLEMENTED.
- Real private daily health journal and observations engine integrated in `app/(private)/dashboard/page.tsx` via `features/journal/components/journal-dashboard.tsx`.
- All six core log types supported with exact validation:
  1. **Glucose**: Validated physiological bounds (`20–600 mg/dL` or `1.1–33.3 mmol/L`), measurement context (`fasting`, `postprandial`, `random`), optional context notes, and deterministic pure unit conversion (`convertGlucose`).
  2. **Meals**: Description, meal category (`breakfast`, `lunch`, `dinner`, `snack`), and carbohydrate estimation.
  3. **Activity**: Category (`walking`, `running`, `cycling`, `yoga`, `strength`, `other`), duration in minutes (1–720 min), notes. Camera presence is never counted as exercise.
  4. **Sleep**: Duration in hours (`0.5–24h`), quality tags (`restful`, `interrupted`, `light`), notes.
  5. **Hydration**: Volume in mL (`50–5000 mL`), without generic medical targets.
  6. **Prescribed Medication**: Adherence logging for doctor-prescribed medicine with dose and schedule; strict clinical boundary prohibiting dose calculation or adjustment.
- **Idempotent Mutations**: Optional `idempotencyKey` supported across all logging procedures via PostgreSQL `idempotency_records` table, preventing accidental duplicate clinical entries.
- **Transactional Outbox & Audit**: Every observation write records canonical observation, audit event, and outbox event in a single PostgreSQL transaction (`recordObservationAtomic`).
- **Owner-scoped Access**: All procedures resolve patient ownership and tenant boundary before query or write.

## Acceptance checks
- [x] tRPC create/read/update authorization and invalid input tests for all six log types.
- [x] Duplicate submission cannot create duplicate clinical entries (idempotency key verification).
- [x] Timezone/day boundary and glucose unit conversion test cases (`convertGlucose` tests).
- [x] No medication adjustment suggestions or generic body-water targets.
- [x] Private dashboard SSR, no shared PHI caches, accessible chart labels and table alternative.

## Test evidence
- `tests/journal/journal-router.test.ts`:
  - Unauthenticated access rejection for all procedures.
  - Precondition check for un-onboarded actors.
  - Plausible physiological glucose range rejection (<20, >600 mg/dL; <1.1, >33.3 mmol/L).
  - Anti-timestamp-fraud check (rejects future timestamps >15m).
  - Exact decimal precision storage (`numeric(8,2)`) in PostgreSQL.
  - Idempotent duplicate submission handling.
  - Pure unit conversion tests (`mg/dL` <-> `mmol/L`).
  - Meal, activity, sleep, hydration, and prescribed medication validation.
  - Descending chronological listing and pagination.

## Next task
Task 7: [Care circle](features/care-circle/README.md) - Scoped revocable caregiver and family consent grants.
