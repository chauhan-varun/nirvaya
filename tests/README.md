# Validation handoff

There is no automated unit, API, browser or hardware test suite yet. Existing scaffold checks are TypeScript, ESLint and production build. Never describe those as clinical or integration validation.

## Prompt

> Add Vitest for pure schemas/safety/consent logic and Playwright with axe-core for browser flows when real features land; use @clerk/testing only after auth is configured. Use real isolated PostgreSQL/Neo4j integration databases for repository/projector behavior. Keep any destructive test reset impossible against production URLs. Mock provider adapters explicitly for deterministic unit tests, plus opt-in credentialed smoke tests without storing transcripts or secrets. Test authentication absence, horizontal access, cross-tenant access, expired/revoked consent, stale invitation, device replay, duplicate events, provider timeout, prompt injection, and unit/timezone conversion. Add CI test scripts only when they run real tests.

Browser acceptance: public home and all seven preview screens render, links work, unknown preview slug returns 404, mobile 360px has no horizontal page overflow, keyboard focus/labels/contrast are checked, disabled preview inputs never record or submit. Private pages cannot leak data via HTML/RSC/prefetch/cache; caregiver revoke invalidates subsequent reads. No successful build is evidence of a live Sarvam/Clerk/Neo4j/hardware integration.
