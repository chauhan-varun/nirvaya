# SugarGuard CareBridge — model handoff

## Scope and current truth

The current deliverable is UI + infrastructure configuration + implementation briefs. No business logic, Clerk integration, database schema, scoring, voice, graph queries, hardware ingestion, or notifications is implemented. `/preview/**` is **public, synthetic and static**. Its disabled controls are intentional, not bugs to silently enable. Preserve it as the evaluator-friendly demo while adding real private routes separately.

## Paste this at the start of each model session

> Work in this repository on exactly the task I name. First read AGENTS.md, README.md, docs/architecture.md, docs/rendering.md, docs/security.md, docs/decisions.md, and the README in the relevant feature folder. Inspect package.json and the installed Next.js documentation; this is Next 16 with breaking changes. Summarize your intended write set, prerequisites and acceptance checks before editing. Use the existing shadcn Base UI components (render composition, not assumed Radix asChild APIs), Lucide, Tailwind tokens and established layout. Use Server Components by default and small client islands only where needed. For private routes, implement request-time server rendering and enforce Clerk identity plus ownership/organization/consent at the data boundary; a protected layout or hidden button alone is insufficient. Never shared-cache PHI. Use tRPC for application queries/mutations and Drizzle ORM with pg for PostgreSQL, not REST resources or another ORM. Do not introduce a separate backend, password store, risk formula, emergency threshold, provider, or global state library without justification. Do not read or print secret env files. Ask only for genuinely unavailable product/clinical/provider decisions; otherwise inspect the repo and proceed. Do not build unrelated features. Replace mocks only inside the task scope, preserve synthetic previews, and never pretend a service is live. Add focused tests, run typecheck/lint/build and relevant tests, update documentation, and report actual results and remaining limitations. Never fabricate scans, test evidence, measurements, or medical validation.

## Task order

Use [docs/roadmap.md](docs/roadmap.md) for time boxes and acceptance criteria. The folder briefs below define implementation boundaries; read prerequisite briefs before changing shared contracts.

| Order | Task / folder | Blocking input |
| --- | --- | --- |
| 1 | [Identity](features/auth/README.md) | User-approved Clerk application/setup |
| 2 | [Postgres foundation](drizzle/README.md) + [tRPC foundation](server/trpc/README.md) | Clerk ID/organization mapping |
| 3 | [Onboarding](features/onboarding/README.md) | Consent, locale, Sarvam credentials |
| 4 | [Risk explanation](features/risk/README.md) | Named validated screening method / clinical reviewer |
| 5 | [Coaching](features/coaching/README.md) | LLM provider and reviewed safety policy |
| 6 | [Daily journal](features/journal/README.md) | Units, timezone, ownership schema |
| 7 | [Care circle](features/care-circle/README.md) | Revocable scopes, invitation UX |
| 8 | [Neo4j graph](features/graph/README.md) | Durable canonical events and graph projection rules |
| 9 | [Edge station](hardware/README.md) | Hardware capabilities and signed-event protocol |
| 10 | [Clinic follow-up](features/clinic/README.md) | Verified role and patient access model |
| 11 | [Validation](tests/README.md) + [Security](security/README.md) | Working vertical slices; real ArgosX access |
| 12 | Deployment / optional expansion | Chosen host, region, secrets and data policy |

Independent UI/test tasks can run in parallel with disjoint write sets. Design shared contracts centrally; never have multiple agents edit Drizzle migrations, package manifests, consent policies, or auth boundaries simultaneously.

## Reusable bounded-task prompt

> Implement **[task name]** from **[folder/README.md]** only. Prerequisites already completed: **[actual list]**. Allowed write scope: **[paths]**; stop and explain if a shared contract needs a breaking change. Required outcomes: **[acceptance checks copied from brief]**. Do not connect unrelated services. Keep `/preview` public and synthetic; create private routes in the planned authenticated route group. For unsupported or unavailable external services show truthful unavailable/empty states, not fabricated success. End with changed paths, commands run and results, security/clinical considerations, and the exact next blocker.

## Definition of done for a real feature

- Input validated server-side; data access authorized on every entry point.
- Accessible English-first interface, mobile layout and keyboard path. Follow the v1 English + 22 Eighth Schedule language preference contract in `docs/rendering.md`: reuse the implemented `lib/i18n/languages.ts` registry, `useLanguagePreference` external-store hook (`useSyncExternalStore`, not context) and shared `LanguageSelector`; preferences only, all custom UI English with `html lang="en"`, explicit English fallback, no translation dictionaries/provider/network calls or automatic health-data translation. Future translations require a user request and per-locale clinical/consent/safety review; verify voice separately.
- Honest loading, empty, error, retry, permission-denied and provider-unavailable states.
- Unit/integration tests for success **and** negative ownership/consent/tenant cases.
- No secrets/health content in client bundles, logs, analytics, URLs, public caches or demo fixtures.
- Changes documented, validation actually run, and remaining assumptions explicit.
- No diagnosis, dosing instruction, exercise verification, autonomous emergency monitoring, or clinical accuracy claim unless separately reviewed and supported.

## Status

- [x] Landing + synthetic workspace shell and six feature previews (English-first; no translation-readiness claim)
- [x] 23-choice language registry, client-only validated preference external store and shared selector on home, preview, prompts and auth/private headers; English fallback only, no translations. Public SSG preserved and private dynamic rendering unchanged per the reported passing implementation build.
- [x] Docker Compose definitions for PostgreSQL and Neo4j
- [x] Shared interface-only contracts and per-folder implementation briefs
- [x] tRPC + Drizzle architecture and folder-level setup prompts (not runtime integration)
- [ ] All real integrations and product behavior
- [ ] Clinical review and validated risk instrument
- [ ] ArgosX scan 1, remediation, scan 2, deployed URL
