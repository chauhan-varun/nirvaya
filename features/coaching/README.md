# Safe English-first plans and conversational guidance

## Current state
No AI SDK, LLM provider, prompt pipeline, generated guidance or clinical safety policy is active.

## Prerequisites
LLM provider decision, reviewed sources and safety policy, consent and owned input data; graph retrieval only after projection ACLs are verified.

Read `../../PROMPTS.md`, `../../docs/architecture.md`, `../../docs/rendering.md`, `../../docs/data-model.md`, and `../../docs/security.md` before editing.

## Implementation prompt

> Ask the user to select an LLM provider and approve health-data sharing/region before installation or live calls. Create a server-only timeout-bounded provider adapter with Zod-validated structured output and minimum necessary input. Use reviewed education sources and provenance, English-default summaries with explicit English fallback for regional preferences (v1 selector preferences only, no translation provider; translate only on user request after per-locale clinical/consent/safety review, never automatically translate health data; verify voice separately), achievable non-clinical habit suggestions and user preference constraints. Put clinician-reviewed deterministic safety checks before and after the model: serious symptoms route to urgent help rather than ordinary coaching, no medication initiation/stop/dose changes, no diagnosis, unsupported certainty, or universal hydration/exercise prescription. Do not invent numeric emergency thresholds. Treat transcripts, user messages and graph strings as untrusted data rather than instructions. GraphRAG must authorize retrieval, bound context and cite actual sources. Provide a safe unavailable response without fabricated model success.

## Acceptance checks
- [ ] Provider key never in browser; strict request/output validation and rate/cost limits.
- [ ] Prompt injection and prohibited diagnosis/dose advice cases tested.
- [ ] Safety escalation works even when the model times out or is unavailable.
- [ ] Guidance records model/prompt/policy/source versions without storing excess sensitive context.
- [ ] User can see what is advice vs recorded fact; no claimed emergency monitoring.

## Expected write scope

`features/coaching/` for domain UI/schemas, the appropriate real private route under `app/`, and narrowly scoped server modules/tests. Coordinate changes to shared contracts, auth and database migrations rather than editing them concurrently. Do not modify `/preview` to use real data. Update this file with completed behavior, actual commands/results and remaining limitations after implementation.

## Status
NOT IMPLEMENTED. All acceptance checks above are future work.
