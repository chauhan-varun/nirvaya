# Authorized clinic and health-worker follow-up

## Current state
Public empty metrics and no patient records. No clinic organization, staff role, screening list or bulk workflow exists.

## Prerequisites
Organization/role/patient-access policy confirmed by user; Clerk + canonical assignment/consent model.

Read `../../PROMPTS.md`, `../../docs/architecture.md`, `../../docs/rendering.md`, `../../docs/data-model.md`, and `../../docs/security.md` before editing.

## Implementation prompt

> Implement a request-rendered clinic workspace gated by verified organization membership, server-assigned clinic roles and explicit patient-level assignment/consent. Do not treat any authenticated user or user-editable Clerk metadata as a clinician. Build paginated/searchable follow-up lists with shadcn Table, filters, accessible empty/error/loading states, minimal patient summaries and auditable follow-up actions. Bulk screening import must be file-size/row-count bounded, schema validated, dry-run reviewed, tenant-owned, duplicate-aware and transactional or chunk-idempotent; do not ingest unknown patient records without an approved consent workflow. Clinician export is an authorized summary with provenance and purpose, never a public document link or LLM diagnosis. Apply CSV formula-injection protections if CSV export is added.

## Acceptance checks
- [ ] Unverified roles and cross-clinic/patient access denied in HTML/RSC/tRPC/export paths.
- [ ] List/search/count endpoints cannot reveal unassigned patients.
- [ ] Bulk import handles malformed/oversized/duplicate rows without partial silent success.
- [ ] Follow-up action audit includes actor, time and purpose but no excess health content.
- [ ] Private data never statically generated, indexed or shared-cached.

## Expected write scope

`features/clinic/` for domain UI/schemas, the appropriate real private route under `app/`, and narrowly scoped server modules/tests. Coordinate changes to shared contracts, auth and database migrations rather than editing them concurrently. Do not modify `/preview` to use real data. Update this file with completed behavior, actual commands/results and remaining limitations after implementation.

## Status
NOT IMPLEMENTED. All acceptance checks above are future work.
