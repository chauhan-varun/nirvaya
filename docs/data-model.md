# Proposed data model and consistency contracts

Status: design only. No Drizzle schema, migration, application database access, seed or graph integration is implemented by this handoff. Do not collect real records while decisions remain open.

## Relational source of truth

Use PostgreSQL with Drizzle planned as the typed access layer. UUID/opaque IDs are identifiers, never authorization. Unless specified otherwise, tenant-owned records have `id`, `tenantId`, UTC `createdAt`/`updatedAt` and a revision for concurrency. Model deletion/retention explicitly; a `deletedAt` flag alone does not revoke consent or erase downstream copies.

| Entity | Proposed key fields | Essential constraints / meaning |
| --- | --- | --- |
| `User` | `id`, `clerkSubject`, status, preferredLocale | Globally unique Clerk subject; no passwords, password hashes or application-issued auth tokens |
| `Tenant` | `id`, kind, status | Explicit care boundary, not an inferred email domain; suspension denies access |
| `Membership` | tenant, user, role, status | Unique `(tenantId,userId)`; role allowlist; active state checked on every request |
| `Patient` | tenant, ownerUserId, minimal demographic fields | Owner must have valid tenant relationship; minimize sensitive fields; do not assume one account always equals one patient |
| `PatientDelegation` | tenant, patient, delegateUserId, authorityType, verifiedBy, validity, status | Verified legal/delegated authority; not granted by ordinary membership; unique active relationships enforced with reviewed constraints |
| `ClinicianProfile` | tenant, user, verificationStatus, jurisdiction references | Unique tenant/user; verification and jurisdiction are not inferred from a UI badge |
| `CareAssignment` | tenant, patient, clinicianUserId/team, status, startsAt, endsAt | Assignment alone is insufficient without applicable consent/policy; valid period and active membership required |
| `ConsentGrant` | tenant, patient, grantor, granteeUserId or granteeOrgId, scopes, purpose, policyVersion, grantedAt, expiresAt, revokedAt | Exactly one grantee kind; explicit scope allowlist; expiry after grant; grantor authority verified; no blanket indefinite consent by default |
| `ConsentEvent` | tenant, consentId, actorId, eventType, occurredAt, policyVersion | Append-only grant/change/revoke evidence; no silent widening of an existing grant; replacement requires new authorization |
| `Device` | tenant, patient, externalId, model, protocolVersion, status, keyVersion/secretRef | Unique registered identity; keys live in secret storage, not plaintext rows; binding changes audited |
| `Observation` | tenant, patient, type, decimal value, unit, observedAt, receivedAt, source, deviceId?, recordedBy?, qualityFlags | Required type/unit pair; finite bounded precision; source allowlist; device/human provenance consistent; never fabricate missing values |
| `AssessmentDefinition` | instrumentName, version, language, population, licenseRef, scoringSpecRef | Optional future capability; clinical approval required; immutable published version, not an invented weighted score |
| `AssessmentResponse` | tenant, patient, definitionId, answers, completionStatus, scoringVersion?, result? | No result until required answers and approved instrument scope pass; never treat absent answers as zero |
| `CarePlan` / `CareTask` | tenant, patient, authorClinicianId, version, reviewedAt, status; task planId, dueAt, completion | Plan authorship/review explicit; completion is self-reported unless verified; no automatically generated medication-dose changes |
| `Appointment` | tenant, patient, clinicianId, startsAt, endsAt, timezone, status | End after start; reviewed conflict policy; no implication of booking without confirmed backend transaction |
| `SafetyEvent` | tenant, patient, triggerType, policyVersion, disposition, acknowledgement metadata | Restricted clinical record; minimal structured evidence; distinguish displayed advice, attempted dispatch and confirmed delivery |
| `AuditEvent` | tenant?, actor type/id, action, resource type/id, purpose, decision, occurredAt, requestId | Append-only, access-restricted; no full medical payloads, tokens, audio or provider prompts; fixed retention policy pending |
| `OutboxEvent` | id, tenant, aggregateType/id, aggregateVersion, eventType, schemaVersion, payload, occurredAt, status, attempts, nextAttemptAt | Written with canonical mutation in same transaction; minimal payload; durable delivery state and bounded retention |
| `ProjectionReceipt` | consumer, eventId, aggregateId, appliedVersion, appliedAt | Unique `(consumer,eventId)` and monotonic aggregate version; safe at-least-once consumption |
| `IdempotencyRecord` | tenant, principal, operation, key, requestHash, responseRef, state, expiresAt | Unique scope+key; concurrent duplicates converge; no raw sensitive response unless separately justified/encrypted |
| `DeviceNonce` | deviceId, keyVersion, nonce, signedTimestamp, acceptedAt, expiresAt | Unique device/key/nonce; retained through the full replay acceptance horizon including skew |

Optional provider-interaction records require explicit retention approval; do not add a permanent conversation/audio table simply because the UI contains an assistant.

## Database integrity and authorization

1. Add unique `(tenantId,id)` targets and composite foreign keys for every tenant-owned reference. A valid patient ID from another tenant must fail even if the application makes a mistake. Define actual composite SQL foreign keys in Drizzle pg-core; relation helpers do not create foreign-key constraints. Use reviewed SQL migrations for constraints not expressible in the selected stable Drizzle version.
2. Use check constraints for time ordering, recipient exclusivity, value/source consistency and enum vocabulary. Index common access paths such as `(tenantId,patientId,observedAt,id)`, active grants and due outbox events. Do not over-index sensitive free text.
3. Decide whether consent scopes are normalized rows or constrained arrays before migration. Scope + purpose + recipient + patient + expiry + revocation must all be evaluated, not merely “a consent row exists.”
4. Owner self-access, lawful-delegate actions and clinician sharing have distinct explicit policies. Membership does not imply patient ownership. A patient-facing consent control must not permit self-assigning a clinician role.
5. Services query tenant and patient authorization together and return minimum DTOs. Optional PostgreSQL row-level security is defense in depth only after pooled-connection/session isolation is proven; it does not replace service policies.
6. Use optimistic revision checks for updates; return tRPC `CONFLICT` for stale writes. Database transactions coordinate consent revocation, audit and outbox. Recheck active grants at the protected operation's transaction boundary; define consistent locking/serialization where needed to prevent revocation races.
7. Revocation denies subsequent access immediately in the canonical service. In-flight operations and already disclosed data cannot be magically recalled: define the transaction cutoff, cancel pending jobs where feasible, notify recipients where required, and record the limitation in consent copy.

## Graph projection: directions and meaning

Neo4j is optional derived infrastructure, not a second patient master. Keep IDs pseudonymous and carry `tenantId`, source aggregate version and projection time. Do not send transcripts, audio, raw video, medical free text or detailed measurements by default.

| Directed relationship | Meaning |
| --- | --- |
| `(User)-[:MEMBER_OF]->(Tenant)` | Derived membership context, not an authorization grant |
| `(User)-[:OWNS]->(Patient)` | Canonical ownership projection |
| `(User)-[:DELEGATE_FOR]->(Patient)` | Verified delegation projection |
| `(Clinician)-[:ASSIGNED_TO]->(Patient)` | Active relational assignment projection |
| `(Patient)-[:HAS_CONSENT]->(Consent)` | Patient whose data is covered |
| `(User)-[:GRANTED]->(Consent)` | Authorized grantor identity |
| `(Consent)-[:GRANTS_TO]->(User or Organization)` | One named recipient; scopes/purpose/expiry on consent |
| `(Device)-[:BOUND_TO]->(Patient)` | Current registered binding; history handled explicitly |
| `(Patient)-[:HAS_PLAN]->(CarePlan)` | Clinician-reviewed plan reference |

Directions are fixed; document any new traversal. Never use “connected within two hops” as permission, a risk formula or evidence of disease. All graph queries include tenant predicates; approved graph results are re-authorized and hydrated from PostgreSQL before disclosure. Shared user identities must not create cross-tenant traversals.

## Outbox, revocation and reconciliation

1. Commit the canonical row, audit event and minimal outbox event atomically. Never dual-write PostgreSQL then Neo4j inside a request and assume both succeeded.
2. Worker claims pending events with a bounded lease/transactional locking; recover abandoned leases. Authenticate worker and authorize projection purpose. Use immutable event IDs and per-aggregate versions.
3. Deliver at least once. Consumer deduplicates by event ID, applies only newer versions, and tolerates duplicates, gaps and out-of-order arrival. A later revocation/tombstone must not be undone by an older grant event.
4. Acknowledge delivery only after the graph transaction succeeds. Retry transient failures with bounded exponential backoff/jitter. Quarantine exhausted events for reviewed replay; alerts expose identifiers/metadata, not health payloads.
5. Revocations and deletions are high-priority projection events, but graph delay never delays canonical denial. Until a projection's consent/removal state is known safe, do not disclose it. Apply retention/deletion to providers and backups according to approved policy; do not promise instantaneous backup erasure.
6. Periodically reconcile relational aggregate versions against graph versions; repair missing/stale nodes and edges. Rebuild from authorized canonical data with a versioned checkpoint. Monitor queue age, failure count, removal lag and reconciliation drift; targets remain pending deployment/privacy decisions.

## Model handoff prompt

> Review this model without implementing persistence. Produce a relation/constraint checklist and example synthetic DTOs for one patient, clinician assignment, scoped consent, observation, revocation event and outbox receipt. Include failing examples for cross-tenant references, expired/revoked consent, invalid type/unit pairs, duplicate device nonces and out-of-order graph events. Flag undefined clinical/legal policy instead of inventing it. Acceptance: every tenant reference has an integrity strategy; graph edges have explicit directions; source-of-truth and authorization never depend on Neo4j freshness.
