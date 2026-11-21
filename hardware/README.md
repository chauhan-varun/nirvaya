# Arduino station implementation brief

Read `../docs/security.md`, `../docs/data-model.md` and `../lib/contracts/index.ts`. No firmware, webcam inference, pairing, ingestion endpoint or hardware events exist yet.

## Prompt

> First confirm the actual UNO Q board/runtime, webcam access and Modulino Thermo libraries with the user or verified hardware documentation. Do not assume UNO R3 firmware or ordinary USB webcam support. Define and test a minimal edge event contract using eventId, deviceId, observedAt, kind, value, unit and firmwareVersion. Presence is environmental context, never exercise/adherence verification. Thermo measures room, not body temperature. Process images locally with no persistence/transmission; camera disabled until explicitly consented. Add owner-scoped enrollment, per-device credential rotation/revocation, a versioned canonical-body HMAC signature, bounded timestamp skew, nonce/replay protection and event-ID deduplication. Enforce body bounds, timestamp/value/unit validation, per-device rate limits and ownership before accepting ingestion. Do not accept a client-supplied ownerId as authority. Define offline bounded buffering and mark simulator output unmistakably.

Acceptance: signed valid event accepted once, bad/revoked credentials and stale/replayed/oversized events rejected, no cross-user enrollment, no frames/videos in API/logs, disconnected/stale UI states, real sample event evidence with no secrets. If hardware is unavailable, implement a **separate explicit simulator**, never call it real sensor verification. Hardware-to-cloud is an outbound authenticated flow; the browser does not connect to arbitrary local hardware.
