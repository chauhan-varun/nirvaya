# Security, privacy and clinical safety handoff

Status: requirements and test plan, not a security certification or compliance statement. No actual ArgosX execution or clinical validation is evidenced by these documents.

## Identity and data-layer access

- Use Clerk only for identity/session verification. Do not build bcrypt/password flows, custom JWT issuance, token refresh, or a parallel authentication system. Device HMAC is a distinct machine authentication mechanism, not a substitute human login system.
- Next.js 16 uses `proxy.ts`. Future `clerkMiddleware()` integration needs explicit route protection; installing it does not protect everything. Maintain a route inventory and test direct URLs, nested routes, tRPC procedures, server callers, batched operations and external HTTP handlers.
- Every server service evaluates verified identity, active tenant membership, resource ownership or verified delegation/clinical assignment, required action scope, current consent purpose/recipient/expiry/revocation and relevant policy version. Deny by default. Never trust browser-provided actor, role or tenant claims.
- A clinician role cannot read every patient. An owner cannot silently consent on behalf of an unrelated adult. A care-circle invitation is not a grant until verified acceptance and the approved consent workflow complete.
- Revocation is checked against canonical PostgreSQL, not session claims, process memory or Neo4j. Background jobs re-evaluate authorization and data-processing consent at execution and before external dispatch. Do not retain PHI in queued payloads when a resource ID can be resolved safely at execution.
- Consider recent authentication/MFA for sensitive sharing and administrative actions when Clerk policy is chosen. Webhook signature verification, event replay deduplication, account suspension/deletion and session revocation must have explicit operational tests.
- Apply origin/CSRF defenses to cookie-authenticated mutations; verify installed Next.js behavior rather than assuming Server Actions secure every domain operation automatically. Validate input at every untrusted boundary, parameterize SQL/Cypher and constrain URLs to prevent SSRF.

## Device HMAC protocol — proposed, not hardware-ready

Finalize byte-level encoding with the real hardware owner before accepting readings. No fabricated firmware compatibility claims.

Required signed metadata: device ID, key version, UTC timestamp, cryptographically random nonce, HTTP method, canonical path (and a defined query policy), SHA-256 digest of the exact request body. Define an unambiguous newline-delimited UTF-8 or length-prefixed canonical representation, permitted character set, digest/signature encoding and protocol version; reject ambiguous encodings. Sign with HMAC-SHA-256 using a unique per-device key.

Verification order:

1. Require TLS, bounded content length and supported content type; reject unknown protocol versions and unexpected query parameters. No device secret in URLs, browser bundles or logs.
2. Look up an active registered device and key version; require its current tenant/patient binding. Do not trust a patient ID merely because it appears in a signed body.
3. Verify timestamp within an explicitly configured maximum-age/future-skew window, then compute body digest/signature from raw bytes and compare in constant time. Do not parse/reserialize JSON before hashing.
4. Within a transaction insert a nonce unique to `(deviceId,keyVersion,nonce)` and an idempotency record, validate the payload and commit the observation/audit/outbox together. Concurrent identical submissions must not create two records. An accepted nonce cannot be reused for a different request. Exact retries may return the previously accepted safe result only after authenticating and matching its request hash; all other replay attempts fail.
5. Keep nonce and deduplication state for at least the accepted timestamp window plus clock skew; document how expired retries behave. Invalid signatures must not consume arbitrary valid nonces or create observations. Rate-limit failures and successful ingestion separately.
6. Validate observation type/unit, bounded numeric precision, future/old reading rules, device calibration/status and quality flags. A correct signature establishes sender integrity, not medical accuracy.

Plan provisioning, encrypted secret storage, rotation overlap, key compromise revocation, factory reset, stolen-device disablement and clock recovery. Postgres can enforce replay uniqueness initially; Redis is optional, never the only durable replay evidence without a reviewed failure model. Document whether processing fails closed when nonce storage is unavailable (required default: yes).

No raw webcam/video collection, upload, retention or webcam-derived exercise/diagnostic claims. Audio for explicitly consented speech is a separate minimized transient path, not permission to activate a camera.

## Clinical safety and generative boundaries

- Position the interface as a support tool, not a diagnosis, prescription, continuously monitored service or emergency response channel. A disclaimer does not replace safe product behavior.
- Deterministic escalation rules must be authored/approved by qualified clinical governance for the supported population/geography and versioned with tests. Evaluate approved triggers before any LLM call. Do not invent symptom thresholds or emergency numbers in engineering tasks.
- For a recognized urgent trigger, display the approved immediate-help guidance and human-contact pathway without waiting on AI. If external notification is not configured or unconfirmed, say so; distinguish displayed guidance, attempted notification and confirmed delivery. No false “your doctor has been alerted.”
- LLM content must not recommend medication initiation, discontinuation, substitutions or dose adjustments; refer to an appropriate clinician/pharmacist. Restrict intended tasks, minimize context, validate structured output and reject unsafe output. An unavailable model gets an honest safe fallback, not made-up medical advice.
- Treat patient text, retrieved content and graph data as untrusted input, not instructions. No autonomous tool calls, consent changes, chart writes or device commands from generated text. Separate trusted policy from user content; test prompt injection and indirect injection.
- Do not compute a proprietary “risk formula.” Any future score requires a **named validated instrument**, version, license, validated language/population, intended screening/monitoring scope, exact published scoring rules, missing-answer behavior and qualified clinical review. Validation for one use/population does not establish diagnostic validity for another. No instrument selected means no numerical diagnostic/risk score.
- English is primary/default. The implemented v1 English + 22 Eighth Schedule selector records preferences only. Its `useSyncExternalStore` hook (not context) validates client-only locale storage, synchronizes cross-tab/custom events and falls back to memory if storage is blocked. This non-sensitive preference is not health data and must stay separate from it; no translation dictionaries or language-selection network calls exist. Preferences do not authorize processing: all content remains English with an explicit fallback notice, no translation provider and no automatic health-data translation. Future translations require an explicit user request and qualified per-locale review of clinical, consent and safety/crisis copy before use; missing or unreviewed translations fall back visibly to English. UI language availability does not establish speech support; verify STT and TTS separately for each requested language. Locale and user location are not interchangeable. Unknown geography cannot silently default to a possibly wrong emergency service.

## Privacy and operations

Minimize collected identifiers and health fields. Protect transport and at-rest data with deployment-appropriate controls and managed secret/key rotation. Do not put health content in logs, URLs, analytics, error trackers, request traces, screenshots, support tickets, shared caches or build artifacts. Audit access with structured actor/action/resource/purpose/decision metadata, restricted access and an approved retention policy.

No PHI service-worker/PWA cache, localStorage/IndexedDB persistence or offline sync. Test logout, account switching, browser back/forward and consent revocation for stale UI. Use generic private-page titles and safe errors. A tenant-specific cache key is not permission to cache PHI in shared infrastructure.

Before external speech/LLM processing: decide supported geography, purpose-specific consent, data-processing terms, retention/training policy, regional routing, deletion obligations, subprocessor access, cost and failure behavior. Never send a full patient chart by default. Consent to care-circle sharing is not consent to external AI processing.

Maintain tested backup/restore, access review, incident response, breach assessment and deletion/retention procedures before production. No claim of HIPAA/GDPR/DPDP compliance follows from using Clerk, encryption or a vulnerability scan; applicable obligations need jurisdiction-specific review.

## Required negative tests for later implementation

| Case | Expected result |
| --- | --- |
| Missing session / forged actor or tenant | Deny; no service read or write |
| Valid session, wrong tenant / unrelated patient | Concealed/denied consistently; no metadata leakage |
| Expired/revoked grant or inactive clinician assignment | Deny immediately from canonical policy; no graph fallback |
| Concurrent revoke and protected mutation | Defined transaction ordering; no write authorized after revocation cutoff |
| Duplicate key, changed body / duplicate device nonce | Conflict/replay rejection; no second observation/outbox event |
| Invalid signature, skew, disabled device or forged unit | Reject; no health record committed |
| Queue duplication / old grant after newer revocation | Idempotent projection; revocation stays effective |
| LLM timeout, unsafe dose request, prompt injection | Safe unavailable/refusal path; no autonomous write or dose advice |
| Private URL build/prefetch/cache/logout/account switch | No static/shared/offline disclosure or previous-user state |

## Two actual ArgosX scans: evidence protocol

**Current evidence status: scan 1 NOT RUN; scan 2 NOT RUN.** The available invocation, access and scan type must be discovered from the actual ArgosX environment or obtained from its owner. No ArgosX CLI command is prescribed here because none has been verified. Do not substitute another scanner and label it ArgosX.

1. **Scan 1 — baseline:** before changing the future implementation/scaffold, run an actual authorized ArgosX scan on the current scoped project/target. Save its unmodified report or access-controlled artifact link and execution metadata. Review findings before writing fixes.
2. **Scan 2 — final:** after changes and local validation, run ArgosX again against the final target using comparable scope. Save a separate actual report; compare finding identifiers and dispositions. Reusing the first report or relabeling static analysis is not a second run.

For each scan record: actual tool identity/version if available, exact supported invocation or UI workflow, scan/run ID, start/end time with timezone, target and scope, git commit plus dirty-worktree manifest or source fingerprint, tool configuration and exclusions, exit/status, artifact path/link, severity summary, limitations, reviewer, and follow-up owner. Reports must not expose secrets or real health records; retain restricted originals and a redacted summary as appropriate.

If access is unavailable, authentication fails, the scan times out or an artifact is missing: record **blocked/incomplete**, the actual error, owner and retry requirement. Do not write invented run IDs, commands, “0 findings” or “passed.” A timeboxed roadmap task cannot waive either actual scan; unfinished evidence remains a release blocker.

Use future `docs/evidence/` only when real artifacts exist and are safe to store; do not create placeholder reports that resemble executed scans. Track each real finding as confirmed/false-positive/accepted-risk/remediated with rationale, evidence, owner and expiry where appropriate. Re-run relevant verification after remediation. Two scans do not establish clinical safety or compliance.

## Paste-ready security review

> Review the implemented scope against this document. Start by inventorying actual routes, data flows, caches, provider calls and auth boundaries; distinguish implemented controls from planned ones. Discover the authorized ArgosX invocation, run and preserve the required baseline/final evidence at the appropriate phases, and report blockers honestly. Do not invent scanner commands, scores, clinical thresholds, regulations or results. Acceptance: findings reference actual files/flows, negative tests have real outcomes, no real health data enters a public preview, and unresolved release gates remain visible.
