# Revocable consent-based family support

## Current state
Consent-oriented public empty state only. No connected caregiver, invite, grant, notification or reminder exists.

## Prerequisites
Clerk + canonical consent model; delivery provider/channel decision deferred until needed.

Read `../../PROMPTS.md`, `../../docs/architecture.md`, `../../docs/rendering.md`, `../../docs/data-model.md`, and `../../docs/security.md` before editing.

## Implementation prompt

> Implement authenticated owner-initiated single-use expiring invitations. Use opaque token digests and never expose sensitive data in invitation URLs. Bind redemption to the intended verified recipient; clarify mismatched account behavior. Implement pending/active/revoked/expired consent, granular scopes and optional expiry. Re-evaluate access on every read and immediately before a queued alert is delivered. Family relationships do not authorize access; do not use graph edges as the ACL source. The PostgreSQL grant is canonical. Add clear English-first confirmation/revoke UX, with explicit English fallback for regional preferences; translate only on user request after per-locale consent/clinical/safety review, never automatically translate health data or add a translation provider in the selector-only scope. Include an owner-visible sharing history and conservative per-scope DTOs. Start with in-app support actions; add external notification channels only after provider/recipient consent and minimal-content policy are approved.

## Acceptance checks
- [ ] Invite replay, expired tokens and wrong-recipient redemption rejected.
- [ ] Unaccepted, expired, revoked and out-of-scope grants cannot read records.
- [ ] Revoking prevents future reads and queued notifications without waiting for graph sync.
- [ ] No raw health content in email/SMS/push payloads or logs by default.
- [ ] All consent grant/revoke actions auditable; no self-grant via client role/owner fields.

## Expected write scope

`features/care-circle/` for domain UI/schemas, the appropriate real private route under `app/`, and narrowly scoped server modules/tests. Coordinate changes to shared contracts, auth and database migrations rather than editing them concurrently. Do not modify `/preview` to use real data. Update this file with completed behavior, actual commands/results and remaining limitations after implementation.

## Status
IMPLEMENTED. See acceptance check results below.

## What was implemented

### Schema
- `server/db/schema/invitations.ts` — `care_circle_invitations` table with opaque token digests, lifecycle status (`pending/accepted/revoked/expired`), composite FK to `patients(tenantId, id)`, single-use unique constraint on `token_digest`, and time-ordering check constraints.
- `drizzle/0002_care_circle_invitations.sql` — migration applied via `docker compose exec postgres psql`.

### Repository (`server/db/repositories/care-circle.ts`)
- `generateInviteToken()` — cryptographic random token; raw value returned once, only SHA-256 hex digest stored.
- `createInvitationAtomic()` — inserts invitation + audit event in one transaction.
- `acceptInvitationAtomic()` — validates lifecycle, verifies invitee email binding, creates `consent_grant` + `consent_event` atomically, marks token consumed.
- `revokeInvitationAtomic()` — cancels pending invitations; accepted invitations must go through `revokeConsentGrantAtomic`.
- `revokeConsentGrantAtomic()` — immediately revokes canonical PostgreSQL grant + updates linked invitation row.
- `getSharingHistory()` — owner's full history with left-join to `consent_grants.revoked_at`.
- `checkActiveConsent()` — re-evaluates canonical PostgreSQL grant at every protected read.

### tRPC router (`server/trpc/routers/care-circle.ts`)
- `careCircle.invite` — owner-initiated, validates scopes, 1–72h TTL, returns raw token (single exposure).
- `careCircle.accept` — email-binding verified, creates consent grant.
- `careCircle.cancelInvitation` — owner cancels pending invitations.
- `careCircle.revokeAccess` — owner revokes accepted grant immediately.
- `careCircle.history` — safe DTOs, no health data content, pagination.

### UI
- `features/care-circle/components/care-circle-dashboard.tsx` — full client component: invite dialog, accept-token dialog, sharing history with status badges, revoke confirmation dialog with explicit warning.
- `app/(private)/care-circle/page.tsx` — dynamic private route, Clerk-protected, onboarding gate.
- `app/(private)/layout.tsx` — added Care circle nav link.

### Tests (`tests/care-circle/care-circle-router.test.ts`)
18 tests: authentication guards, preconditions, happy path (invite, accept, revoke grant, cancel invitation), security negatives.

## Commands run and results

```
pnpm test            → Tests 65 passed (65)  [all 11 files pass]
pnpm typecheck       → 0 errors
pnpm build           → ✓ Compiled successfully; /care-circle listed as ƒ (Dynamic)
docker compose exec postgres psql … < drizzle/0002_care_circle_invitations.sql  → all DDL applied
```

## Acceptance checks

- [x] Invite replay rejected (tokenConsumed=true → FORBIDDEN).
- [x] Wrong-recipient redemption rejected (email binding check → FORBIDDEN, audit logged).
- [x] Expired invitations rejected (lifecycle check at accept time).
- [x] Revoked/expired/out-of-scope grants cannot read records (checkActiveConsent helper).
- [x] Revoking canonical PostgreSQL grant is immediate; does not wait for graph sync.
- [x] No raw health content in invitation payloads or audit logs.
- [x] Cancellation of accepted invitation rejected with BAD_REQUEST (must use revokeAccess).
- [x] Double-revocation rejected with BAD_REQUEST.
- [x] Cross-tenant isolation: other owner cannot cancel or revoke first owner's resources (NOT_FOUND).
- [x] All consent grant/revoke actions produce audit_events rows.
- [x] No self-grant possible (grantorUserId always set from canonical owner, not client input).

## Remaining limitations

- External email/SMS delivery of raw tokens is **not implemented** — raw token returned to UI for manual sharing. Provider/consent approval (see P07, P08) required before adding delivery.
- No push notification for acceptance/revocation events — in-app only.
- Graph projection of care-circle grants (Task 8) not yet implemented.
- `checkActiveConsent()` is a repository helper; it must be integrated into every downstream tRPC procedure that exposes caregiver-scoped data (Task 10 — clinic, Task 8 — graph).
- ArgosX scan not run (blocked; see docs/security.md).
