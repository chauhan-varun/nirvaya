# 22-hour interface and handoff sequence

This is a timeboxed **professional interface/basic-scaffolding** plan, not a promise to implement a clinical backend in 22 hours. All durations are budgets, not reported work. Real integrations require a separate implementation request and the gates in [Decisions](decisions.md). Missing scan access or human clinical/legal decisions remain blockers after the timebox.

## Shared preamble — paste before every task

> Work in the existing Nirvaya Next.js 16.4.6 / React 19 / Tailwind 4 / pnpm / shadcn base-nova project. Read AGENTS.md, the installed Next.js guide relevant to the task, docs/README.md and the named task document. Inspect actual files before editing and preserve unrelated user work. Deliver only the requested interface, fixtures, types or documentation. No real patient data, provider calls, database, production auth bypass, homegrown bcrypt/JWT, diagnostic scoring, webcam inference or dose advice. Marketing and /preview are public synthetic static pages; future /dashboard, /onboarding, /care-circle and /clinic are private dynamic routes and must not be activated without real authorization. Do not add Express, Redis or an SDK speculatively. Use existing primitives and dependencies. State actual checks run, blockers and changed files; do not fabricate success, scan evidence or clinical validation. Complete one atomic task and stop for acceptance.

This schedule describes the scaffold workstream, not the status of completed tasks. Root PROMPTS.md and folder-level briefs define the next implementation workstream. Preserve the public interface; do not rebuild it just because a historical task below describes its creation.

## Schedule

| Task | Budget | Elapsed | Deliverable |
| --- | --- | --- | --- |
| 01 | 0.5 h | 0–0.5 | Inventory and scope lock |
| 02 | 1.5 h | 0.5–2 | Actual ArgosX baseline scan + triage |
| 03 | 2 h | 2–4 | Design tokens and accessible shell |
| 04 | 2 h | 4–6 | Static marketing interface |
| 05 | 2 h | 6–8 | Public English-first synthetic preview shell |
| 06 | 2 h | 8–10 | Overview and readings previews |
| 07 | 2 h | 10–12 | Onboarding and care-circle previews |
| 08 | 2 h | 12–14 | Clinic and support/speech previews |
| 09 | 2 h | 14–16 | Typed contracts and integration documentation |
| 10 | 1 h | 16–17 | Private route, consent and cache threat review |
| 11 | 2 h | 17–19 | Validation, accessibility and build review |
| 12 | 3 h | 19–22 | Actual ArgosX final scan, bounded remediation and handoff |

Total: **22 hours**. If external scans take longer, stop claiming schedule completion; record actual progress and remaining blocker. Never replace required scanning with fabricated artifacts to meet the budget.

## 01 — Inventory and scope lock (0.5 h)

> Read package.json, components.json, AGENTS.md, current routes, styles and docs/decisions.md. Inventory what actually exists versus what is planned. Record package-manager scripts, uncommitted user work and any conflicting requirements in a concise handoff note. Do not change application code, install packages, choose providers or activate data collection.

Acceptance: versions/configuration verified; public/private route map agreed; synthetic-only boundary stated; all pending P01–P11 decisions retained. Existing UI changes owned by another contributor are not overwritten.

## 02 — Actual ArgosX scan 1 (1.5 h)

> Follow docs/security.md's evidence protocol. Discover the real authorized ArgosX tool/service and supported invocation from the environment or owner. Execute one baseline scan of the approved current target and save real evidence with source fingerprint and scope. Triage actual findings; do not fix unrelated business logic or expand scope. If access is unavailable, record the actual blocker and escalate; never invent a CLI, command output, run ID or clean result.

Acceptance: actual scan report/run reference and metadata exist, or status is explicitly blocked (not complete). Sensitive artifacts are restricted/redacted. A remediation list distinguishes relevant findings from unrelated pre-existing issues. The final scan is still required independently.

## 03 — Design tokens and accessible shell (2 h)

> Inspect existing globals, layout and shadcn primitives. Compose a restrained professional visual system with readable English-first typography and script-appropriate language-option labels, consistent spacing, neutral surfaces, a deliberate accent and accessible status treatments. Build only reusable public header/footer/navigation, disclosure and shell pieces. Use Base UI semantics rather than copying another primitive library's API. No session reads in the public root shell.

Acceptance: keyboard focus is visible; controls have names; no color-only state; mobile navigation works; reduced-motion is respected; existing tokens/components are reused; no backend or dependency churn.

## 04 — Static marketing (2 h)

> Build the public marketing page using docs/rendering.md. Explain the intended care-support experience, privacy boundaries and product limitations, with clear links into /preview. Use credible editorial hierarchy and responsive sections. Do not invent certifications, testimonials, partner logos, clinical outcomes, accuracy claims or live service availability.

Acceptance: public route builds statically without secrets, provider calls or session data; CTA says preview rather than implying a live account; no unsupported clinical/compliance copy; mobile reading order and heading hierarchy work.

## 05 — Public English-first preview shell (2 h)

> Build /preview and only its public child routes with persistent synthetic-demo disclosure. Use English as primary/default. Reuse the implemented lib/i18n/languages.ts registry (23 choices, Locale, default en, validation and getContentLocale → en), lib/i18n/use-language-preference.ts hook and components/shell/language-selector.tsx shadcn NativeSelect, using the exact codes in docs/rendering.md. The hook uses useSyncExternalStore, not context; validated storage is client-only with cross-tab/custom-event sync and an in-memory fallback if blocked. The selector is already mounted on home, preview shell, prompts and auth/private headers. Preserve these mounts, public SSG and unchanged private dynamic rendering; the implementer reports a passing build. All content stays English; show explicit English fallback for other selections. No translation dictionaries/provider or language-selection network calls exist; do not add or imply them. Future translation is only on user request after per-locale clinical/consent/safety review; never translate health data automatically. Verify speech independently of UI options. Add responsive overview/readings/care-circle/clinic/onboarding preview navigation. Keep all links within the preview route family; no production-route aliases or login requirement.

Acceptance: deterministic local fixtures only; selector defaults to English and exposes all 23 documented options; selection does not submit, translate or persist health data; non-English/unsupported choices visibly fall back to English; accessible script-appropriate option labels fit controls; rendered English retains English language attributes and LTR direction; refresh/direct navigation works; public build does not depend on Clerk.

## 06 — Overview and readings previews (2 h)

> Create a synthetic patient overview and sample readings view with explicit units, timestamps/timezones, provenance labels and text alternatives for charts. Add local demonstrations of empty/loading/unavailable/populated states. Include a “how this would work” explanation for disconnected hardware. Do not derive risk/diagnostic scores, medical recommendations or webcam exercise metrics.

Acceptance: every apparently clinical value is clearly synthetic; no random/hydration-dependent fixtures; type/unit shape matches docs/architecture.md; no claim of live monitoring or calibrated device accuracy; no sensitive input/storage/network requests.

## 07 — Onboarding and care-circle previews (2 h)

> Under /preview only, create an onboarding walkthrough and scoped-consent/care-circle interface using fictional people. Explain owner/delegate roles, recipient, purpose, scope, expiry and revocation. Actions may open explanatory dialogs or visibly local demo states, but must never claim real consent, invitations, saved profiles or delivered notifications. Do not collect actual health/identity information.

Acceptance: preview state resets and is explicitly demonstrative; revoked/expired/unavailable examples exist; no blanket default sharing; forms are labeled and accessible; /onboarding and /care-circle are not exposed as unsecured product routes.

## 08 — Clinic, support and speech previews (2 h)

> Under /preview only, show an appropriately scoped fictional clinician worklist and care-plan/appointment examples. Add a clearly illustrative support/speech card describing planned Sarvam and configurable-LLM adapters. Do not call providers, request microphone/camera access, generate advice, change doses or imply that a clinician has reviewed a real patient. Use disabled/unavailable states with concise explanations.

Acceptance: no real appointments or successful-booking toast; no autonomous safety triage or made-up emergency contact; visible limits for support; no webcam/video handling; synthetic example text is not presented as a provider response.

## 09 — Typed contracts and integration handoff (2 h)

> Use docs/architecture.md and docs/data-model.md to document or scaffold minimal serializable UI DTOs and adapter interfaces only. Separate demo fixtures from future server-only boundaries. Explain tenant ownership, revocable consent, units, idempotency, sanitized tRPC errors, signed device ingestion and outbox ordering. Do not install tRPC, Drizzle, Clerk, Neo4j, Sarvam or an LLM SDK; do not create working data APIs or migrations. Any adapter stub must explicitly return unavailable/not-configured.

Acceptance: no secrets or ORM types in client imports; no fake successful persistence; relational constraints and graph directions are documented; procedure examples carry no real identifiers; all backend activation gates remain pending.

## 10 — Private-route and privacy threat review (1 h)

> Review actual routes/build behavior against docs/rendering.md and docs/security.md. Confirm no private health surface has accidentally been implemented as a public preview or static page. Record the future Next.js 16 proxy.ts + explicit Clerk protection design and data-layer checks without installing auth. Check for service workers, caches, browser storage, analytics and third-party media requests. Remove only task-introduced unsafe demo behavior; document unrelated findings.

Acceptance: private product URLs are absent or safely unavailable; no mocked login silently authorizes access; no PHI in fixtures/metadata/URLs/logs/cache; route groups/layouts are not described as access control; Clerk middleware is not described as protective by default.

## 11 — Build, accessibility and behavior validation (2 h)

> Run the project's actual supported checks, starting with targeted changes and then pnpm lint, pnpm typecheck and pnpm build where available. Review public/static output and inspect routes manually or using an already available browser harness. Check narrow/wide screens, keyboard navigation, focus restoration, English-default preferences, all 23 implemented selector options and validated preference storage/sync/blocked-storage fallback, explicit English fallback, no automatic health-data translation, chart summaries, empty/error states and honest nonfunctional actions. Do not install a testing framework without a justified request or report unrun manual checks as passed.

Acceptance: actual command outcomes and relevant errors recorded; regressions introduced by this work fixed within scope; unrelated failures documented, not hidden; build output confirms intended rendering; any manual checks not performed remain explicitly unverified. A successful build alone is not an accessibility/security audit.

## 12 — Actual ArgosX scan 2 and final handoff (3 h)

> Run a second actual ArgosX scan on the final scoped target using docs/security.md's evidence format. Compare with baseline by finding ID and scope. Fix relevant issues within the authorized scope/timebox, rerun affected checks, and scan/reverify changed security-sensitive work as needed. Preserve both original reports and actual final outcomes. Finish a concise handoff with changed files, screenshots only if safe/available, test commands/results, two real scan references, pending decisions, unresolved findings and next authorized task.

Acceptance: two distinct actual scan runs with evidence, or honest incomplete/blocked status; no fabricated results; no claim of production readiness, compliance or clinical validation; unimplemented integrations explicitly listed; no unrelated writes reverted. If a final scan precedes a later fix, record the changed fingerprint and additional verification rather than pretending the report covers unscanned code.

## Separate future backend activation sequence (not in the 22 hours)

Only after explicit authorization and relevant pending decisions are resolved:

1. Configure Clerk and internal membership/policy mapping; protect private routes and all entry points; test direct service denial. Missing keys fail closed.
2. Configure tRPC request context/server caller and Drizzle pg-core schema/SQL migrations; implement one manual-observation tRPC vertical slice with unit validation, scoped consent, audit, idempotency and outbox transaction.
3. Implement grant/revoke lifecycle and concurrency tests; prove immediate canonical denial and job cancellation/dispatch checks.
4. Add outbox worker/reconciliation and minimal Neo4j projection only if justified; test duplicates, reordering and revocation lag.
5. Integrate real hardware only after HMAC canonicalization, enrollment, key lifecycle, replay and calibration gates are agreed.
6. Add reviewed Sarvam speech and selected LLM adapter independently; evaluate privacy, English quality and independently verified per-language STT/TTS and requested-locale generation quality, refusals, deterministic escalation and provider failures. No scoring without an approved named instrument.
7. Complete deployment, recovery, incident response, governance and release evidence. Re-run security review/scans for newly implemented scope; scaffold-era scans do not certify future backend code.
