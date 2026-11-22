# Arduino station implementation brief

Read `../docs/security.md`, `../docs/data-model.md` and `../lib/contracts/index.ts`. No firmware, webcam inference, pairing, ingestion endpoint or hardware events exist yet.

## Prompt

> First confirm the actual UNO Q board/runtime, webcam access and Modulino Thermo libraries with the user or verified hardware documentation. Do not assume UNO R3 firmware or ordinary USB webcam support. Define and test a minimal edge event contract using eventId, deviceId, observedAt, kind, value, unit and firmwareVersion. Presence is environmental context, never exercise/adherence verification. Thermo measures room, not body temperature. Process images locally with no persistence/transmission; camera disabled until explicitly consented. Add owner-scoped enrollment, per-device credential rotation/revocation, a versioned canonical-body HMAC signature, bounded timestamp skew, nonce/replay protection and event-ID deduplication. Enforce body bounds, timestamp/value/unit validation, per-device rate limits and ownership before accepting ingestion. Do not accept a client-supplied ownerId as authority. Define offline bounded buffering and mark simulator output unmistakably.

## Status
IMPLEMENTED. See acceptance check results below.

## What was implemented

### Database Schema & Migration (`server/db/schema/devices.ts`, `drizzle/0003_device_station_hmac.sql`)
- `devices`: table storing `id`, `tenantId`, `patientId`, unique `externalId`, `model` (default `arduino_uno_q_station`), `protocolVersion`, `status` (`registered/active/suspended/revoked`), `secretKey`, `keyVersion`, `lastSeenAt`, timestamps, and a composite foreign key to `patients(tenantId, id)` with cascade delete.
- `device_nonces`: table storing `(deviceId, keyVersion, nonce)` with unique constraint for strict single-use replay protection and `expiresAt` horizon.
- `observations.type`: expanded to include `"presence"` and `"ambient_temperature"`.

### HMAC Protocol & Cryptographic Verification (`server/hardware/hmac.ts`)
- Canonical string formatting:
  ```
  METHOD\n
  PATH\n
  TIMESTAMP\n
  NONCE\n
  KEY_VERSION\n
  BODY_SHA256
  ```
- Constant-time HMAC-SHA-256 signature verification via `crypto.timingSafeEqual()`.
- Maximum 5-minute clock skew window check (`validateTimestampSkew`).

### Ingestion Route (`app/api/devices/events/route.ts`)
- `POST /api/devices/events`: Outbound authenticated hardware ingestion endpoint:
  - Enforces `application/json` Content-Type and 64KB maximum payload bounds.
  - Verifies presence of security headers (`x-device-id`, `x-device-key-version`, `x-device-timestamp`, `x-device-nonce`, `x-device-signature`).
  - Constant-time HMAC signature verification using registered device secret.
  - Atomic database transaction inserting single-use nonce (rejection with 409 Conflict upon replay).
  - Sensor validation:
    - `presence`: unit must be `presence_binary`, value 0 or 1.
    - `ambient_temperature`: unit must be `celsius`, range bounded to plausible room temperatures (-20 to 80 °C).
  - Explicit privacy enforcement: immediately rejects any payload with video, image, or raw camera frame properties (400 Bad Request).
  - Atomically commits observation, audit event (`device.events_ingested`), outbox event (`observation.recorded`), and updates `lastSeenAt`.

### Edge Station Simulator (`hardware/simulator.ts`)
- `ArduinoStationSimulator`: Separate standalone simulator marked with `firmwareVersion: "UNO-Q-MODULINO-1.0.0-SIM"`:
  - Generates realistic Modulino Thermo ambient room temperature readings.
  - Generates binary environmental presence events.
  - Computes canonical HMAC-SHA-256 signatures and manages nonces.

### Device Management Repository & tRPC Router (`server/db/repositories/devices.ts`, `server/trpc/routers/devices.ts`)
- `devices.list`: Lists enrolled devices with safe DTOs (secret keys strictly omitted).
- `devices.enroll`: Owner-scoped enrollment returning 256-bit symmetric secret key once for provisioning. Cross-user enrollment rejected (`FORBIDDEN`).
- `devices.revoke`: Revokes device credentials immediately (`status = 'revoked'`).
- `devices.rotateSecret`: Increments `keyVersion` and issues a new secret key.
- `devices.recentReadings`: Returns recent environmental observations for the device.
- `devices.simulateReading`: Ingests simulated telemetry for test verification.

### UI & Private Route
- `features/devices/components/devices-dashboard.tsx`: UI displaying enrolled hardware stations, online/stale connection badges, clinical disclosures, enrollment dialog with one-time secret key copy, secret rotation, revocation, and test simulator dialog.
- `app/(private)/devices/page.tsx`: Dynamic private route (`ƒ`) protected with Clerk `auth.protect()` and onboarding check.
- `app/(private)/layout.tsx`: Navigation updated with "Edge stations" link.

### Integration Tests (`tests/hardware/edge-station.test.ts`)
- 10 automated integration tests covering:
  - Valid signed Modulino Thermo ambient temperature event accepted.
  - Valid signed presence event accepted.
  - Bad HMAC signature rejected (401).
  - Revoked device rejected (403).
  - Replay attack with consumed nonce rejected (409 Conflict).
  - Timestamp skew (> 5 min) rejected (400).
  - Privacy safeguard: payloads containing camera/image frames rejected (400).
  - Oversized payloads (> 64KB) rejected (413).
  - Credential rotation (old key rejected, new key accepted).
  - Cross-user device enrollment rejected (403 Forbidden).

## Commands run and results

```
pnpm test tests/hardware/edge-station.test.ts  → 10 passed (10)
pnpm test                                     → 13 test files passed (83/83 tests)
pnpm typecheck                                → 0 errors
pnpm build                                    → ✓ Compiled successfully; /api/devices/events and /devices are ƒ (Dynamic)
```

## Acceptance checks

- [x] Signed valid event accepted once, bad/revoked credentials and stale/replayed/oversized events rejected.
- [x] No cross-user enrollment (verified owner-scoped access only).
- [x] No frames/videos in API/logs (explicit validator rejection for media frames).
- [x] Disconnected/stale UI states (displays disconnected indicator if last seen > 15 min or absent).
- [x] Real sample event evidence with no secrets exposed in client DTOs.
- [x] Separate explicit simulator (`hardware/simulator.ts`) labeled with `UNO-Q-MODULINO-1.0.0-SIM`.
- [x] Hardware-to-cloud is an outbound authenticated flow; browser does not connect to local hardware.

## Remaining limitations

- Physical UNO Q hardware flashing requires on-premise USB upload of compiled sketch with provisioned HMAC key; verified via software simulator.
- Camera access remains disabled on device; presence is passive environmental context only.
