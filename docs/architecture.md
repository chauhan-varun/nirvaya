# Architecture and module handoff

Status: proposed architecture. This documentation does not install or implement any backend dependency.

## 1. Runtime boundary

Use a modular Next.js monolith. Application queries and mutations use **tRPC v11** with TanStack Query, not REST resources. Server Components use a request-local server caller; browser interactions use the tRPC fetch transport. Procedures call the same authorized services and **Drizzle ORM + node-postgres** repositories. Do not make Server Components call their own HTTP endpoints or add a parallel Server Actions CRUD layer. Do not add Express, microservices, a second identity store, or a generic repository framework for the MVP.

Flow: browser → tRPC transport → per-procedure Clerk context + Zod validation → service + authorization → Drizzle repository → PostgreSQL. SSR enters through a request-local tRPC caller, not HTTP. In the same database transaction, append relevant outbox and audit records. A separately scheduled worker from the same codebase delivers approved projections to Neo4j or external adapters. Deployment must support that worker; request completion is not a durable job runner.

Clerk verifies identity only. Internal membership, tenant, patient ownership, delegation, care-team assignment, and consent determine access. Clerk organization IDs or client-provided roles do not by themselves authorize a patient record.

## 2. Proposed folders and ownership

These are **future paths** unless explicitly marked implemented; the language registry, preference hook and selector below are implemented. Preserve the starter's root-level `app`, `components`, `hooks`, and `lib` convention.

| Proposed folder | Responsibility and dependency rule |
| --- | --- |
| `app/page.tsx` | Existing static landing; no session reads or patient services; no move required |
| `app/preview/` | Public synthetic experience with persistent demonstration disclosure |
| `app/(private)/dashboard/`, `onboarding/`, `care-circle/`, `clinic/` | Future authenticated entry points; route groups do not enforce access |
| `app/api/trpc/[trpc]/route.ts` | Future thin Node fetch adapter for typed tRPC operations |
| `app/api/webhooks/clerk/`, `app/api/devices/events/` | Future verified external protocols only, not parallel REST CRUD |
| `server/trpc/` | Request-local context, protected procedures and domain routers |
| `trpc/` | Client provider, query-client factory and request-local RSC caller/hydration |
| `components/ui/` | Existing shadcn/Base UI primitives; avoid replacing them with another kit |
| `components/marketing/`, `components/preview/`, `components/shell/` | Composed interface, not authorization or persistence |
| `lib/demo/` | Deterministic typed fictional fixtures; no production service imports |
| `lib/i18n/` | Implemented `languages.ts`: 23 choices, `Locale`, default `en`, validation and `getContentLocale` → `en`. `use-language-preference.ts`: `useSyncExternalStore`, not context; client-only validated storage, cross-tab/custom-event sync and in-memory fallback if blocked. Preferences only; no translation dictionaries/provider/network calls |
| `components/shell/language-selector.tsx` | Implemented shadcn `NativeSelect` on home, preview shell, prompts and auth/private headers; English custom UI and explicit fallback; `html lang="en"` unchanged |
| `lib/contracts/` | Serializable DTO and error shapes; no secrets or ORM exports |
| `server/auth/` | Clerk-to-internal-user mapping and explicit policy checks |
| `server/services/` | Cohesive services, validation, repositories and policy tests |
| `server/db/` | Future pg Pool, Drizzle pg-core schema/repositories and transaction helpers, server-only |
| `server/integrations/` | Vendor isolation, timeouts, redaction and test doubles |
| `server/jobs/` | Outbox claims, projection delivery, retry/reconciliation |
| `drizzle/` | Migration implementation brief now; future reviewed SQL and Kit metadata |
| `drizzle.config.ts` | Future root Kit configuration; not created before ORM implementation |
| `tests/` | Future unit, integration, access-isolation and browser tests |
| `docs/` | Source of truth for handoff, decisions and evidence links |

Mark secret-bearing modules server-only when implemented. Client components receive minimum necessary DTOs, never ORM rows, provider clients, consent internals, or device secrets. Keep client JavaScript to interaction islands rather than making entire pages client components.

Language behavior follows [the rendering contract](rendering.md#english-first-language-preferences). Preference reads remain client-only with an English server snapshot; public SSG and private dynamic rendering are unchanged (passing implementation build reported by the implementer). Future translations are user-requested only and require per-locale qualified clinical, consent and safety review; never automatically translate health data.

## 3. Module contracts

- **Identity/authorization:** resolve verified Clerk subject → internal user; require active tenant membership; authorize subject, action, resource, purpose, care assignment and current scoped consent. Deny on missing context. Recheck at every service entry, including jobs.
- **Patients/consent:** canonical patient ownership and delegation; append consent history; revocation immediately blocks subsequent application reads and writes. Do not authorize from a stale graph edge.
- **Observations:** accept typed values with units, provenance and quality flags; reject inconsistent or unsupported measurements. A mock sensor is not a calibrated medical device.
- **Care:** appointments, reviewed care tasks and clinician-authored plans are separate concepts. Completing a demonstration task does not notify a real clinician.
- **Safety:** deterministic, clinically approved escalation policy precedes any generative response. Log policy version and decision metadata without putting health content in general logs.
- **Speech:** `transcribe({audio, language, requestId, consentContext})` and `synthesize({text, language, requestId, consentContext})`; use a Sarvam adapter only after STT and TTS support are each verified per requested language independently of the UI registry, and retention, transfer and credentials are reviewed. A UI selection does not enable speech. Audio is transient, size/duration bounded, and not stored by default. No browser-exposed provider key.
- **LLM:** `generate({task, locale, minimizedContext, policyVersion, requestId})` → structured result with provider/model metadata, or typed unavailable/timeout/refusal. Provider/model selection is server configuration, allowlisted and unresolved. No autonomous diagnosis, tool execution, dose changes or emergency triage delegation.
- **Graph:** project committed relational events and return advisory relationship views only. PostgreSQL remains authoritative for authorization and all patient-facing canonical records.

All adapters have explicit timeouts, bounded retries for retryable operations, cost/size limits, cancellation, and a safe unavailable state. Never retry a non-idempotent operation blindly. A stub must return `not_configured`/`unavailable`, not fabricated provider output.

## 4. Proposed tRPC contract

No working procedures or transport are implemented. These are future procedure names, not REST endpoints.

| Procedure | Kind | Policy / behavior |
| --- | --- | --- |
| `profile.me` | query | Verified session; minimal owned profile DTO |
| `journal.list` | query | Tenant + ownership/assignment + scoped consent; bounded cursor pagination |
| `journal.create` | mutation | Explicit units and provenance; transactionally idempotent |
| `consent.invite` / `consent.grant` | mutation | Owner/verified delegate; exact recipient, scope, purpose and expiry |
| `consent.revoke` | mutation | Authorized grantor/delegate; immediate canonical denial + audit/outbox |
| `assessment.summary` | query | Owned/scoped result; named validated instrument before numeric scoring |
| `coaching.request` | mutation | Authorized minimized context, explicit AI-processing consent, cost limits and reviewed safety |
| `graph.insights` | query | Canonical authorization before bounded derived graph retrieval |
| `clinic.followUps` | query | Verified role, tenant membership, patient assignment and consent |
| `devices.status` | query | Human-owned device context; no credential disclosure |

External exceptions: `POST /api/webhooks/clerk` verifies provider signatures and deduplicates events; `POST /api/devices/events` verifies per-device HMAC, timestamps and nonces. The browser uses tRPC, not these routes for application CRUD. Bounded media transfer may use a dedicated HTTP handler only if verified provider/browser requirements justify it; no public health-file URLs.

### Procedure conventions

- Use compatible stable `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query` v11 packages, TanStack Query and Zod. Use `drizzle-orm/node-postgres`, `pg` and compatible stable Drizzle Kit; do not copy RC-only APIs blindly.
- Derive identity from Clerk, not input `userId`/`ownerId`. Resolve tenant selection against active internal membership. Every protected procedure independently authorizes its resource, including each item in a batch. Services recheck policy for jobs and internal callers.
- Validate input/output schemas; infer client types from `AppRouter`. Do not wrap results in a homemade REST `ApiResult`. Use `TRPCError` with safe codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BAD_REQUEST`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE`) and a sanitized formatter with `requestId`; never expose stack traces, raw SQL, transcripts or provider dumps.
- Reading DTO: patient identifier, type, decimal value string, explicit unit, ISO UTC observation time, source, optional device identifier and quality flags. Server owns tenant, actor, received time and verified provenance. Preserve original units/values if conversion is required; do not silently clamp or diagnose.
- Mutation input includes an opaque `idempotencyKey` for create/ingest actions. Persist principal + tenant + procedure + key, request hash and safe result reference transactionally. Identical replay returns the same result; different input with the same key raises `CONFLICT`. A header alone is ambiguous for batched mutations; scope the key per operation.
- Use TLS, same-origin/CSRF checks and explicit origin policy for cookie-authenticated transport. Sensitive tRPC query input must use POST (verify v11 link/adapter method override support), not GET query strings. Restrict batches, body bytes, date windows, collection lengths and quotas per principal/operation. Disable verbose payload logging.
- Private tRPC responses are `private, no-store`; never shared-cache query results. Each SSR request has its own actor/context and QueryClient, and the browser clears private state on account/tenant changes and revocation. No persisted query cache for health records. Hydrate minimal authorized DTOs only.
- Server Components use the server caller directly. Hooks/providers belong to small interactive client boundaries. Do not install tRPC providers in the static preview or make the root layout read sessions.

Read [router setup](../server/trpc/README.md), [RSC/client setup](../trpc/README.md), and [Drizzle setup](../drizzle/README.md) before activation.

## 5. Handoff prompts

> **Boundary task:** Inspect existing folders and these docs. Propose only typed DTOs and server-only adapter interfaces for the approved modules. Do not install SDKs or create functioning auth/data/device endpoints. Produce a dependency map and list any missing provider decisions. Acceptance: client imports contain no server credentials or ORM types; stubs are visibly unavailable; no network calls occur.

> **Future activation task — separate authorization required:** Implement one vertical slice, manual observations, using Clerk identity, a tRPC journal mutation and a scoped transactional Drizzle/PostgreSQL service. First finalize the schema, consent policy and units. Add negative tests for cross-tenant access, revoked consent, invalid units and duplicate submissions. Do not activate graph or AI as a prerequisite. Acceptance: all direct service calls enforce policy; transaction writes observation + audit + outbox atomically; production credentials never enter fixtures.
