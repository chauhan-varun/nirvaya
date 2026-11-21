<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SugarGuard scaffold rules

Read `PROMPTS.md`, `docs/architecture.md`, `docs/rendering.md`, and the target folder's README before implementation. Keep `/preview/**` public, static and synthetic. Real health routes need request-time rendering and data-layer Clerk identity/ownership/consent checks. Reuse installed shadcn Base UI components; do not assume Radix APIs. Do not add diagnosis, dose advice, invented risk scores or unverified hardware claims. Never expose PHI in caches, URLs or logs. Current scope is interface and implementation handoff only.

## Language rules

English is primary/default. V1 targets English + India’s 22 Eighth Schedule languages, not every Indian language; use the exact locale list in `docs/rendering.md`. Preferences are implemented in `lib/i18n/languages.ts` (23 choices, `Locale`, default `en`, validation, `getContentLocale` → `en`) and `lib/i18n/use-language-preference.ts` (`useSyncExternalStore`, not context; client-only validated storage, cross-tab/custom-event sync, in-memory fallback if blocked). Reuse `components/shell/language-selector.tsx` (shadcn `NativeSelect`) on home, preview, prompts and auth/private headers; do not rebuild it or add a context provider. Preserve public SSG and private dynamic rendering. Preferences only: all content remains English, non-English choices show an explicit English-fallback notice, and `html lang="en"` stays unchanged. No translation dictionaries/provider or language-selection network calls exist. Do not infer translations exist. Translate only on explicit user request after per-locale qualified review of clinical, consent and safety copy; never translate health data automatically. Verify STT/TTS support per language separately from UI options; no all-language speech claim.

User-selected application stack: tRPC v11 + TanStack Query, Drizzle ORM + pg + PostgreSQL, Clerk, and derived Neo4j. Do not add REST resource endpoints or a second ORM. HTTP handlers are limited to tRPC transport and verified external integration boundaries. Read `server/trpc/README.md`, `trpc/README.md`, and `drizzle/README.md` before implementation.
