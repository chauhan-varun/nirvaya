# Domain implementation briefs

Each domain README is a bounded prompt for the next model—not a claim of implementation. Start at `../PROMPTS.md`. Read shared architecture, rendering, data and security decisions before working on a feature. Keep UI and server implementations separate; no provider credentials or ORM clients inside client-importable features. Prefer installed shadcn components and purpose-built libraries over custom primitives.

- `auth/` — Clerk, private routes, actor resolution
- `onboarding/` — English-first intake, consent, corrected profile; optional separately verified voice
- `risk/` — validated instrument and explainable factors
- `coaching/` — safe, grounded English-first guidance; reviewed regional translations only on request
- `journal/` — logs, units, timezone, trends
- `care-circle/` — invitations and revocable scoped consent
- `graph/` — Neo4j projections, outbox, bounded retrieval
- `clinic/` — verified clinic workflows
- `../hardware/` — signed privacy-safe edge events

Follow `../docs/rendering.md` for the implemented v1 English + 22 Eighth Schedule language registry, `useSyncExternalStore` preference hook (not context) and shared shadcn `NativeSelect`. Reuse these; client-only validated storage includes cross-tab/event sync and blocked-storage memory fallback. No translation dictionaries or language-selection network calls exist; all content English, explicit English fallback, no translation provider or automatic health-data translation. Future user-requested translations need per-locale clinical/consent/safety review; voice support is verified separately.

No feature is implemented yet. Tests and evidence are mandatory when moving a task to complete.
