# Nirvaya implementation handoff

## Read first

This delivery is a professional interface/basic scaffold and documentation handoff, **not a working clinical product**. Documents describe proposed capabilities; they do not establish that authentication, persistence, integrations, clinical validation, monitoring, or scans exist. Never replace a missing integration with simulated success.

The inspected starter declares Next.js 16.4.6, React 19.3.1, Tailwind 4, pnpm, and shadcn `base-nova` using Base UI. Preserve existing components and unrelated work. Read root `AGENTS.md` and the installed Next.js guides before future code changes; do not assume older Next.js APIs apply.

## Index

| Document | Purpose |
| --- | --- |
| [Architecture](architecture.md) | Module boundaries, proposed folders, integration contracts, tRPC conventions |
| [Rendering](rendering.md) | Static public previews versus future private dynamic routes; localization and accessibility |
| [Data model](data-model.md) | Proposed relational constraints, ownership, consent, graph projection and outbox |
| [Security](security.md) | Authorization, device signing, clinical safety, privacy and two-scan evidence requirements |
| [Roadmap](roadmap.md) | A 22-hour scaffold sequence with atomic, paste-ready prompts and acceptance checks |
| [Validation](validation.md) | Actual scaffold checks, existing lint failures and unrun integrations |
| [Decisions](decisions.md) | Settled boundaries, unresolved decisions and release gates |

## Scope guardrails for the next model

- Default deliverable: polished public UI, explicitly synthetic preview data, nonfunctional integration boundaries, and documentation. No real business code, patient collection, database provisioning, provider calls, or live clinical workflow without a separate explicit implementation request.
- `/preview` and its children are deliberately public, static demonstrations. Never move real records into their fixtures. Future `/dashboard`, `/onboarding`, `/care-circle`, and `/clinic` are private dynamic surfaces, not aliases of public previews.
- Planned stack: Clerk identity; tRPC v11 + TanStack Query; Drizzle ORM + pg + PostgreSQL source of truth; Neo4j as a derived, eventually consistent graph; Sarvam behind an adapter; an unselected configurable LLM adapter. Redis is optional and deferred. An Express service is unnecessary for the MVP.
- English is primary/default. V1 implements English + India’s 22 Eighth Schedule language preferences through `lib/i18n/languages.ts`, a `useSyncExternalStore` preference hook (not context) and a shared shadcn `NativeSelect`; validated storage is client-only with cross-tab/event sync and an in-memory fallback. No translation dictionaries or language-selection network calls exist; all content remains English with explicit English fallback and no translation provider. Future translations require user request and per-locale clinical/consent/safety review; no automatic health-data translation. Voice support is verified separately (see [rendering](rendering.md#english-first-language-preferences)). Example readings, appointments, trends, and care activity must be marked synthetic. No diagnostic score, webcam-derived exercise claim, medication-dose advice, or emergency-response guarantee.
- No health data in static generation, shared caches, service workers, browser persistence, telemetry payloads, or third-party prompts by default. No raw webcam/video ingestion or storage.
- Do not claim HIPAA/GDPR/DPDP compliance, clinical validation, production readiness, or completed security scans. Record actual evidence and unresolved gates.

## How to use the prompts

Paste the shared preamble in [Roadmap](roadmap.md), then exactly one task. Check the task's acceptance criteria before continuing. Backend activation is a separate, gated workstream; contracts in these documents are design inputs, not permission to ship live care services.

## Folder-level setup prompts

Start at [PROMPTS.md](../PROMPTS.md). The tRPC router brief is [server/trpc/README.md](../server/trpc/README.md), RSC/client brief is [trpc/README.md](../trpc/README.md), and migration brief is [drizzle/README.md](../drizzle/README.md). Feature prompts live in [features/README.md](../features/README.md); hardware, tests and scan evidence have their own root folders. None of these briefs represents an installed runtime integration.
