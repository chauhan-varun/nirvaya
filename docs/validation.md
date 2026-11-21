# Scaffold validation record

These results cover the interface/handoff scaffold, not working product integrations.

| Check | Actual result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS; `/`, `/preview`, `/prompts` static, six `/preview/[section]` routes SSG |
| ESLint scoped to changed app, shell, preview, contracts and demo files | PASS |
| Prettier check scoped to changed TS/TSX, CSS, Compose and workflow | PASS |
| `git diff --check` | PASS |
| Local Markdown link check | PASS; 28 Markdown files checked before this record was added |
| Compose config with non-secret temporary validation password environment values | PASS; config only, no containers started |
| `pnpm lint` (whole repository) | FAIL; existing `react-hooks/set-state-in-effect` errors in `components/ui/carousel.tsx:98` and `hooks/use-mobile.ts:14` |

The two existing generated-component lint findings were left untouched to preserve user work. The added CI workflow deliberately runs the full lint command and will remain red until those findings are separately resolved; they are not suppressed or excluded.

## Language preference implementation update

The implementer reports a passing build after adding the 23-choice registry, `useSyncExternalStore` preference hook (not context) and shared shadcn `NativeSelect`: public SSG is preserved and private dynamic rendering is unchanged. Source inspection for this documentation update confirms the registry/validation/English content fallback, client-only validated storage with cross-tab/custom-event sync and blocked-storage in-memory fallback, selector mounts on home/preview/prompts/auth/private headers, and `html lang="en"`. No translation dictionaries/provider or language-selection network calls are implemented. This docs-only update did not rerun the build or verify browser interaction, cross-tab behavior, blocked-storage behavior or accessibility manually. Earlier results above remain historical, not new validation of unrelated integrations.

Not run: database startup/health/migrations, tRPC/Drizzle integration (not installed), Clerk sign-in, Sarvam/LLM calls, real hardware, automated browser/screenshots, manual mobile/accessibility review, E2E tests, deployment, ArgosX scan 1 or scan 2. No claim of security/clinical/production readiness.
