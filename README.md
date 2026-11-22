# Nirvaya

**Learn → Understand → Take daily steps → Connect with loved ones.**

English-first metabolic-health companion for prevention, prediabetes support, and daily diabetes care. This repository currently contains a **professional UI scaffold and model-ready implementation guides**, not a functioning medical product.

## Run the interface

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. No API keys or databases are needed to view the scaffold.

| Route | Current behavior |
| --- | --- |
| `/` | Public, statically rendered English landing page with language preferences |
| `/preview` | Public static dashboard with synthetic data |
| `/preview/onboarding` | Inactive voice and text intake UI |
| `/preview/risk` | Example explanations, **no risk score** |
| `/preview/daily-log` | Six inactive journal forms |
| `/preview/care-circle` | Consent-oriented empty state |
| `/preview/devices` | Disconnected hardware state |
| `/preview/clinic` | Empty care-team workspace |
| `/prompts` | Public developer-handoff overview |

All six section routes are pre-generated with `generateStaticParams`. Pages and layouts are Server Components; interactive shadcn primitives retain their own client boundaries. There are **no private routes yet**. Do not put real health data under `/preview`.

## Language direction

English is the primary/default language. The v1 language preference selector targets **English + India’s 22 Eighth Schedule languages**, not all of India’s hundreds of languages. See [the language contract](docs/rendering.md#english-first-language-preferences) for the exact locale registry.

Language preferences are **implemented, not translations**. `lib/i18n/languages.ts` exports 23 choices, the `Locale` type, default `en`, validation and `getContentLocale` (always English). `lib/i18n/use-language-preference.ts` uses `useSyncExternalStore`, not a context provider: validated locale storage is client-only, with cross-tab/custom-event synchronization and an in-memory fallback if storage is blocked. The shadcn `NativeSelect` in `components/shell/language-selector.tsx` is mounted on home, the preview shell, prompts, and auth/private headers. All visible custom UI remains English, `html lang="en"`, with an explicit English-fallback notice for non-English selections. No translation dictionaries, translation provider or language-selection network calls exist. Public SSG is preserved and private dynamic rendering is unchanged (passing implementation build reported by the implementer). Selection does not mean translated content or speech is available. Future translations require an explicit user request and per-locale qualified review of clinical, consent and safety copy; never translate health data automatically. Verify STT and TTS capabilities separately from UI language options.

## Start local databases

Requirements: Docker Engine with Compose v2, pnpm 12.21.0, and a supported Node.js version (Node 24 LTS recommended).

```sh
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and NEO4J_PASSWORD before continuing.
# Also update DATABASE_URL when implementing Drizzle (URL-encode its password).
pnpm db:up
pnpm db:status
```

- PostgreSQL 17: `localhost:5432`, database/user `sugarguard`.
- Neo4j 5.26 Community: Browser `http://localhost:7474`, Bolt `bolt://localhost:7687`, user `neo4j`.
- Both services have health checks, named volumes, and **loopback-only published ports**. They are not production deployment definitions.
- The app does **not** connect to these services yet. No migrations or patient seeds exist.
- `pnpm db:down` stops services while preserving data. `docker compose down --volumes` permanently destroys local data—only use intentionally.
- Password variables initialize new volumes; changing `.env` does not rotate passwords on existing databases. Rotate through the database's supported flow.
- Neo4j may need a minute or more for first startup. Allow roughly 2–3 GB of available RAM for the local stack.
- Compose reads `.env`, not `.env.local`; if you use the latter, pass `docker compose --env-file .env.local ...` explicitly. Never commit either file.

## Planned stack

**Existing:** Next.js 16 App Router · React 19 · TypeScript · Tailwind 4 · shadcn/ui (Base UI / `base-nova`) · Lucide · Recharts.

**Implementation targets, not connected:** Clerk identity · Drizzle + PostgreSQL · Neo4j driver · Sarvam STT/TTS · provider-selected LLM · Arduino edge events. Use tRPC v11 procedures and server modules for application operations instead of REST resources or a second Express server. Narrow HTTP handlers remain only for tRPC transport, verified webhooks and external hardware/media integration boundaries. Redis/queues, PWA, Sentry, and hosted deployment are later, gated integrations. No custom passwords or JWT issuer alongside Clerk.

Prefer installed libraries. Add Zod + React Hook Form for validated forms, Clerk’s official Next.js SDK, tRPC v11 + TanStack Query, Drizzle ORM + node-postgres (`pg`) + Drizzle Kit, and the Neo4j driver when the corresponding implementation task starts. See [architecture](docs/architecture.md) for library decisions.

## Repository map

```text
app/                     # Public landing, /prompts and static /preview routes
components/
  ui/                    # Existing generated shadcn primitives; reuse these
  shell/                 # Brand and public preview workspace
  preview/               # Presentational feature screens
features/<domain>/       # README task briefs; future domain UI/schemas
lib/contracts/           # TypeScript interface boundaries only
lib/demo/                # Explicitly public synthetic fixtures
server/                  # Future server-only auth, tRPC routers, data and integrations
trpc/                    # RSC caller/client-provider implementation guide
drizzle/                 # SQL migration implementation brief; no schema yet
hardware/                # Edge privacy and ingestion implementation brief
security/                # Two-scan/remediation evidence templates
tests/                  # Validation task brief (no automated tests yet)
docs/                    # Architecture, model, rendering, security, roadmap
compose.yaml             # Local PostgreSQL + Neo4j only
PROMPTS.md               # Start here when handing off to another model
```

## Next model: start here

Read [PROMPTS.md](PROMPTS.md), [docs/README.md](docs/README.md), and the relevant feature's README. Execute one bounded task, preserve the public preview, and update the task status with actual test evidence. See [open decisions](docs/decisions.md) before selecting an LLM, provisioning Clerk, or making clinical claims.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm build
```

There are no API integration/E2E tests yet. CI runs the above scaffold checks without secrets or databases. Full lint currently reports two pre-existing generated-component errors; see [validation results](docs/validation.md). Database definitions can be validated locally with `docker compose config --quiet` after setting local passwords.

## Safety and privacy boundaries

No real screening, medical recommendations, diagnosis, medication changes, emergency monitoring, authentication, notifications, recordings, graph inference, or hardware verification is active. Never interpret presence as exercise or ambient temperature as body temperature. Future health routes require server-side identity, ownership, clinical-role and scoped-consent checks. No PHI in shared caches, logs, service-worker storage, or public demo fixtures.

ArgosX scans have **not** been run. This scaffold makes no regulatory, clinical-validation, or production-security compliance claims.
