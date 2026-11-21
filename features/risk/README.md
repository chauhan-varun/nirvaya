# Explainable screening and risk factors

## Current state
Illustrative factor cards only. No formula, score, diagnosis or personalized plan is implemented.

## Prerequisites
Clinical owner must select/approve the instrument and interpretation; owned profile plus consent. Until then implement only an honest unassessed state.

Read `../../PROMPTS.md`, `../../docs/architecture.md`, `../../docs/rendering.md`, `../../docs/data-model.md`, and `../../docs/security.md` before editing.

## Implementation prompt

> First obtain a named validated screening instrument, version, intended adult population and permission/license, with clinically reviewed interpretation and missing-data policy. Do not invent weighted risk points or treat lifestyle context as validated score inputs. Implement deterministic pure scoring only for valid complete inputs, preserve provenance/instrument version, distinguish not-assessed/incomplete/requires-review/completed, and present factor explanations in English by default. Follow the v1 selector-preferences-only contract: no translation provider, no automatic health-data translation, explicit English fallback for regional preferences. Translate only on user request after per-locale clinical/consent/safety review; UI language options do not establish instrument validation or voice support. Separate screening from diagnosis and screening populations from already diagnosed diabetes care. Use graph context only as supporting provenance, never as automatic evidence of causation. Any LLM may rephrase grounded results, not calculate or change the score. Show clear screening limitations and clinician follow-up, with no prediction accuracy claims.

## Acceptance checks
- [ ] Clinically reviewed reference cases reproduce exactly and instrument version is stored.
- [ ] Missing/conflicting inputs cannot produce a fabricated complete score.
- [ ] Diagnosed-user pathway does not misuse a prevention instrument.
- [ ] Factor provenance, modifiability and limitations are understandable in English; any future requested translation is reviewed per locale with explicit English fallback when unavailable.
- [ ] Unauthorized records denied; scoring snapshot immutable/auditable; no diagnostic or dosing output.

## Expected write scope

`features/risk/` for domain UI/schemas, the appropriate real private route under `app/`, and narrowly scoped server modules/tests. Coordinate changes to shared contracts, auth and database migrations rather than editing them concurrently. Do not modify `/preview` to use real data. Update this file with completed behavior, actual commands/results and remaining limitations after implementation.

## Status
NOT IMPLEMENTED. All acceptance checks above are future work.
