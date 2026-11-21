# Decision register

Status terminology: **direction** is an agreed design constraint, not implemented behavior; **pending** blocks the affected production capability. Update this document with dated evidence, accountable owner and consequences when a decision changes.

## Direction: retain

| ID | Decision | Reason / consequence |
| --- | --- | --- |
| D01 | Modular Next.js monolith; no Express for MVP | tRPC procedures + server services avoid duplicate deployment/auth boundaries; worker remains a separately scheduled execution mode |
| D02 | Clerk for identity only | No homegrown password hashing, bcrypt account store, JWT issuance or refresh-token system; application authorization stays internal |
| D03 | User-selected Drizzle ORM + PostgreSQL | Canonical transactions, constraints, ownership, consent and durable outbox; not installed/implemented by these docs |
| D04 | Neo4j is derived and eventually consistent | Never a source for access control or authoritative medical facts; rebuildable from approved relational data |
| D05 | Sarvam adapter; LLM provider not chosen | Speech and generation isolated from domain logic; privacy/cost review before activation |
| D06 | Optional Redis deferred | PostgreSQL can initially handle durable idempotency, outbox and replay nonce uniqueness; revisit only with measured scale |
| D07 | Static public marketing and `/preview`; dynamic private product | Synthetic demonstrations are safe to share; real health data is never statically generated or shared-cached |
| D08 | English primary/default; v1 English + 22 Eighth Schedule language preferences | Implemented `lib/i18n/languages.ts` registry (23 choices, default `en`, validation, `getContentLocale` → `en`), `useSyncExternalStore` preference hook (not context; client-only validated storage, cross-tab/event sync, memory fallback) and shared shadcn `NativeSelect` on home/preview/prompts/auth/private headers. All custom UI English, `html lang="en"`, explicit fallback; no translation dictionaries/provider/network calls. Public SSG/private dynamic rendering preserved per reported passing implementation build. Future translations require user request and per-locale clinical/consent/safety review; no automatic health-data translation. Verify voice separately; see [language contract](rendering.md#english-first-language-preferences) |
| D09 | No diagnostic score, inferred webcam exercise or dose advice | Clinical claims and clinical automation require separate validation/governance; raw webcam/video is out of scope |
| D10 | No compliance or completed-scan claims without evidence | Security testing and design intent are not certification, legal compliance or clinical validation |

| D11 | User-selected tRPC for application operations | tRPC v11 + TanStack Query for typed queries/mutations; narrow HTTP only for tRPC transport, verified Clerk webhooks and signed hardware/media integration boundaries |

## Pending decisions and activation gates

| ID | Open decision | Required evidence / accountable role | Safe behavior while unresolved |
| --- | --- | --- | --- |
| P01 | LLM provider/model, region and fallback | Product + security: data-processing terms, retention/training policy, English quality and separately reviewed requested-locale quality, transfer regions, cost ceilings, safety evaluation, structured response support | Assistant unavailable; synthetic example copy explicitly labeled, no live prompts |
| P02 | Deployment platform, region, worker and database hosting | Engineering + security: runtime support, job scheduling, private networking, backup/restore drill, secret rotation, data residency, rate limits and observability | Public static demo only; do not imply background processing works |
| P03 | Supported geography, population and clinical governance | Clinical lead + appropriate legal/privacy reviewer: intended use, age/delegation rules, clinician licensing, emergency pathways, retention and privacy obligations | No location-specific emergency-number assumptions, diagnostic claims or real patient intake |
| P04 | Real hardware protocol and device assurance | Device engineer + security + clinical reviewer: firmware identity, enrollment, key storage, canonical signed bytes, clock behavior, unit mappings, calibration and recall handling | Synthetic readings only; no claim of certified/connected hardware |
| P05 | Clerk configuration | Identity owner: application/environment separation, allowed origins/redirects, session settings, MFA policy, webhook verification, account deletion mapping, tenant membership source | No functioning private routes; never silently bypass auth when keys are absent |
| P06 | Named assessment instrument and permitted scoring scope | Clinical lead: instrument/version, license, population/language validation, formula, missing-answer handling, interpretation and review pathway | No numeric diagnostic/risk scoring or invented weighting |
| P07 | Consent lifecycle and lawful delegation | Privacy + clinical owner: purpose/scope vocabulary, guardian verification, expiry, emergency-access policy if any, withdrawal semantics and required retention | Deny sharing and external processing; do not implement automatic emergency access |
| P08 | Sarvam services and audio handling | Engineering + privacy: exact APIs, independently verified per-language STT/TTS capabilities (not inferred from UI options), language variants, data location/retention, consent, provider deletion options and failure/cost behavior | Speech unavailable; no browser credential or audio retention |
| P09 | Graph necessity and operational SLOs | Engineering + privacy: justified queries, minimal projection, revocation/removal lag target and tested reconciliation procedure | No graph deployment; canonical reads remain relational |
| P10 | ArgosX execution access | Security owner: identify actual tool/service, supported scope and invocation, authorization, artifact destination and remediation workflow | Mark scans not run/blocked; never invent a CLI or results |
| P11 | Retention, encryption and deletion schedule | Privacy + infrastructure: per-entity retention, audit access, key management, backup expiry and legal-hold requirements | No real health collection; do not promise immediate deletion from immutable backups |

## Implementation readiness checklist

Before any live private vertical slice: P02, P03, P05, P07 and P11 must be resolved for that slice; explicit separate implementation authorization is required. Device, AI, speech, graph and scoring additionally require their corresponding gates. A UI prototype does not implicitly approve them.

Before release: test tenant isolation, consent revocation, account switch, cache behavior, request replay, outbox recovery and clinical fallback; run both actual ArgosX scans as defined in [Security](security.md); resolve or explicitly risk-accept findings with owner and expiry. A clean scan alone is not release authorization.

## Decision update prompt

> Resolve only decision Pxx. Inspect current code and obtain missing owner input rather than making up policy. Present feasible options, recommended choice, data-flow/privacy/cost impact, migration and rollback needs, and acceptance evidence. Record dated owner approval or mark it pending. Do not implement the dependent capability until explicitly authorized. Preserve all unrelated settled decisions.
