# Interface implementation brief

Read `../PROMPTS.md` and `../docs/rendering.md`. Preserve the warm neutral / forest-green design tokens, generous spacing, responsive care-workspace shell, visible preview labels and accessible English-first text. `ui/` contains installed shadcn **Base UI** primitives: inspect their API before using them. Buttons may use `render`, not Radix `asChild`; use Next Link with buttonVariants for simple navigation. Do not replace primitives with custom modal/select/calendar implementations.

## Task prompt

> Build the real feature UI using existing Card, Field/Label/Input, Select, Dialog, Alert, Skeleton, Table, Tabs, Progress and Chart components where appropriate. Add React Hook Form + Zod when implementing actual forms. Keep server data reads outside client components; pass minimal serializable view models. Put recording state, form state and Recharts inside small client islands. Add route loading/error boundaries alongside real routes. Never use a whole-page client boundary just for one button. Retain the synthetic `/preview` experience and do not enable its inert controls.

Reuse the implemented `shell/language-selector.tsx` shadcn `NativeSelect`, mounted on home, preview shell, prompts and auth/private headers. It reads `lib/i18n/use-language-preference.ts` (`useSyncExternalStore`, not context); validated client-only storage syncs across tabs/custom events and falls back to memory if blocked. `lib/i18n/languages.ts` supplies 23 choices, default `en`, validation and `getContentLocale` → `en`. All visible custom UI and `html lang="en"` remain English; no translation dictionaries or language-selection network calls exist. Preserve public SSG and private dynamic rendering.

Language controls must follow `../docs/rendering.md`: English-default preferences only, all content English, explicit English fallback for non-English selections, no translation provider or automatic health-data translation. UI language options do not establish translation or voice availability. Future requested translations need per-locale clinical/consent/safety review.

Acceptance: keyboard/focus tested, 360px mobile and desktop checked, explicit labels and units, meaningful empty/unavailable states, no false provider-live indication, no hydration warnings. No browser screenshot validation has yet been performed for this scaffold.
