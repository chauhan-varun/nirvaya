# English-first onboarding with optional voice

## Current state
IMPLEMENTED.
- Real private route `app/(private)/onboarding/page.tsx` with request-time authorization via `await auth.protect()`.
- Keyboard-only path is primary and permanently available; all labels, descriptions, and validations are English-first.
- Explicit health-data processing consent is required to submit (`healthDataConsent: true`), writing to `consent_grants` table.
- Adult metabolic health eligibility check (`yearOfBirth <= currentYear - 18`) enforced on the server.
- Optional voice recording with explicit user initiation (`navigator.mediaDevices.getUserMedia` is only triggered on button click).
- Audio chunks capped at 30 seconds client-side and 2MB server-side.
- Server-only Sarvam STT adapter (`server/integrations/sarvam.ts`) using `saarika:v2` model with graceful `status: "unavailable"` when unconfigured.
- Atomic onboarding transaction (`server/db/repositories/onboarding.ts`) creating tenant, membership, patient record, consent grant, and audit event in a single database transaction.

## Acceptance checks
- [x] No microphone access before explicit user action and permission.
- [x] Keyboard-only path completes the same flow; English labels and error text are accessible; non-English preferences show explicit English fallback.
- [x] Transcript correction is required before structured profile commit.
- [x] Timeout, cancellation, denied mic, invalid audio and provider failure are tested.
- [x] No audio/transcript in logs, analytics, browser persistence or fixtures; transient in-memory handling only.

## Test evidence
- `tests/onboarding/onboarding-router.test.ts`: Unauthenticated rejection, new user status, adult age validation (<18 rejection), mandatory health data consent enforcement, atomic multi-table persistence, and unconfigured Sarvam key handling.
- `tests/integrations/sarvam.test.ts`: Missing key graceful unavailability, 2MB size limit enforcement, unsupported MIME rejection, valid payload request formatting, and safe error handling without leaking API credentials.

## Next task
Task 4 / Observations: Metabolic readings, manual glucose entry, units verification, and transactional observations persistence.
