# Rendering, route and interface contract

Status: implementation guidance, not evidence of existing routes. Public preview UI may be built without auth or persistence. Private product routes must remain absent or fail closed until identity and authorization are implemented.

## Route policy

| Route | Rendering | Data / protection |
| --- | --- | --- |
| `/` and future marketing pages | SSG, public | Editorial content only; no session-dependent layout or patient imports |
| `/preview` and `/preview/*` | SSG, explicitly public | Deterministic synthetic fixtures; English-first demo; no Clerk requirement |
| `/dashboard` | Future dynamic SSR | Current authorized patient's data; authenticated and private/no-store |
| `/onboarding` | Future dynamic SSR | Authenticated account setup; no public health-data forms |
| `/care-circle` | Future dynamic SSR | Scoped sharing and revocation; current grants checked in service |
| `/clinic` | Future dynamic SSR | Active clinician membership, patient assignment, consent and action scope |
| `/api/trpc/*` | Future request-time tRPC transport | Explicit auth per procedure, including each item in a batch; health responses private/no-store |
| `/api/webhooks/clerk`, `/api/devices/events` | Future narrow HTTP integrations | Signature verification and replay checks; not browser-facing REST resources |

Route groups such as `(private)` do not alter URLs or protect routes. Public preview navigation must stay in `/preview/*`; an “Open dashboard preview” action must not imply access to `/dashboard`. Do not relabel synthetic preview cards as connected devices, live monitoring, active appointments, or delivered care.

## Next.js 16 constraints

Read installed `node_modules/next/dist/docs/` before implementation. The inspected configuration is empty; Cache Components are not explicitly enabled. Do not enable them as an incidental optimization.

- Use root `proxy.ts` for Next.js 16 interception rather than copying older `middleware.ts` examples.
- When Clerk is later installed, `clerkMiddleware()` supplies integration context; it **does not protect every route by default**. Define explicit protected route matching and protection, including private nested URLs. Verify current Clerk SDK syntax against its selected version before coding.
- Proxy is an early navigation/session check, not the authorization boundary. Handlers, Server Actions and services independently authenticate and authorize; a protected layout alone is insufficient.
- Private pages use request-time rendering supported by the installed version. Without Cache Components, explicit dynamic route configuration and uncached data access can enforce this. If that feature is later enabled, re-review compatible request-time APIs instead of blindly retaining incompatible route flags.
- Set health response headers to `Cache-Control: private, no-store`; use uncached health fetches, no static parameter generation for private resources, and no shared `use cache`, persistent memoization or revalidation cache around health services.
- Public marketing and preview can be statically generated precisely because they import only public content. Do not read cookies or Clerk sessions in the root layout if doing so makes all public pages dynamic; isolate private concerns.
- Keep streaming fallbacks and error boundaries generic: no patient names in public shells, page metadata, document titles, error URLs or prefetch payloads. Do not prefetch private data into public pages.

## Cache and browser persistence policy

Never put PHI (protected/personal health information) in a CDN/shared cache, PWA runtime cache, service-worker precache, localStorage, IndexedDB, persisted query cache, or offline background-sync queue. A manifest or install affordance does not make offline clinical access safe. No service worker is required for the scaffold.

If an offline shell is separately approved, allowlist versioned public assets only. Explicitly bypass private routes, API responses, navigation fallbacks containing patient data, audio, and authenticated payloads. On logout/account switch/revocation, clear any in-memory patient UI and re-fetch under the new identity; never show another account's previous screen. `no-store` is necessary but not sufficient: test browser back navigation, client router state, logout and account switching. Persist only non-sensitive locale/theme preferences, never health form drafts by default.

## Interface specification

- Preserve shadcn `base-nova`, Base UI composition, Tailwind 4 tokens, typography hierarchy and coherent spacing. Do not introduce a second component library or unsupported primitive assumptions.
- Marketing: credible purpose, clear limits, product preview CTA, accessibility and privacy narrative. No invented clinical endorsements, accuracy percentages, certifications, partner logos, efficacy metrics or compliance badges.
- Preview shell: visible “Synthetic demonstration — not connected to care” disclosure; mobile-friendly navigation; patient overview, manually described sample readings, care-circle, clinic and onboarding examples. Do not show apparently real contact information or real clinic availability.
- Provide empty, loading, unavailable, error and populated examples. Buttons may open a local explanatory dialog or navigate a preview; do not fake a successful save, signed consent, appointment booking, alert delivery or provider response.
- Charts require text summaries, units, timestamps/timezones and synthetic labels. Trends are not diagnoses. Avoid a single red/yellow/green “risk score” unless a named validated instrument and approved scope are documented.
- No webcam request, video capture, inferred exercise count, camera-based diagnosis or implied motion verification. An exercise card may show a generic illustrative routine with a clinician-review disclaimer, not individualized prescription.
- Avoid session replay, analytics collection, external embeds and remote image calls that expose sensitive route context. Marketing analytics require a separate reviewed configuration.

## English-first language preferences

English is the primary/default language. The regional-language direction targets all Indian languages over time, but **v1 is explicitly English + India’s 22 Eighth Schedule languages**, not all of India’s hundreds of languages. The exact selector registry is:

| Code | Language |
| --- | --- |
| `en` | English (default) |
| `as` | Assamese |
| `bn` | Bengali |
| `brx` | Bodo |
| `doi` | Dogri |
| `gu` | Gujarati |
| `hi` | Hindi |
| `kn` | Kannada |
| `ks` | Kashmiri |
| `kok` | Konkani |
| `mai` | Maithili |
| `ml` | Malayalam |
| `mni` | Manipuri (Meitei) |
| `mr` | Marathi |
| `ne` | Nepali |
| `or` | Odia |
| `pa` | Punjabi |
| `sa` | Sanskrit |
| `sat` | Santali |
| `sd` | Sindhi |
| `ta` | Tamil |
| `te` | Telugu |
| `ur` | Urdu |

**Implemented: selector preferences only, not translations.**

- `lib/i18n/languages.ts` exports the 23 choices above, `Locale`, `defaultLocale = "en"`, `isLocale`, `resolveLocale` and `getContentLocale`. Invalid/unsupported stored preferences resolve to `en`; `getContentLocale` explicitly returns `en` for every supported preference.
- `lib/i18n/use-language-preference.ts` implements `useLanguagePreference` with `useSyncExternalStore`, **not a context provider**. Only the validated locale is stored client-side under `carebridge.language`. Browser `storage` events synchronize tabs and `carebridge:language-change` events synchronize same-page consumers; blocked/unavailable storage has an in-memory fallback. The server snapshot is English and does not read browser storage, cookies or sessions.
- `components/shell/language-selector.tsx` uses the existing shadcn `NativeSelect` and is mounted on home, the preview shell, prompts, and auth/private headers. Non-English choices display “{Language} selected. Translation is not connected; content remains English.” All visible custom UI remains English and the document stays `html lang="en"`.
- No translation dictionaries, translation provider or language-selection network calls exist. Selecting a language records a preference, **not** a translation request, provider authorization or speech activation. Preference state remains separate from medical data; persist only this non-sensitive preference, never health data.
- Public SSG is preserved and private dynamic rendering is unchanged, per the passing implementation build reported by the implementer. This documentation update does not claim to rerun that build.

**Future translation gate:** translate only on explicit user request, and only where reviewed locale content is available. Clinical terms, units, medication information, consent and safety/emergency copy require qualified human review for each locale before use. Missing, unavailable or unreviewed translations must show an explicit English fallback; never imply all options are translated. Never translate health data automatically or send it to an external provider because a language was selected; any later requested health-data processing needs separate purpose-specific consent and privacy approval.

Use accessible selector labels and script-appropriate font fallbacks. Language attributes and direction must describe the content actually rendered: English fallback stays `lang="en"` and left-to-right even when the preferred locale differs. Future reviewed translations need locale/script-appropriate direction, including RTL where applicable; do not enable RTL merely from a preference while showing English. Format dates and numbers only where implemented and tested, keep storage canonical, and preserve explicit clinical units.

**Voice is a separate capability gate.** Verify STT and TTS independently for each requested language, model, script/variant and audio format, alongside quality, consent, retention and transfer requirements. UI registry membership is not evidence of Sarvam or any provider’s speech support. Keep unsupported/unconfigured voice unavailable with a keyboard path; do not claim all-language speech is active.

## Acceptance and paste-ready task

> Build only the public route family described above with deterministic synthetic fixtures and existing UI primitives. Use English-first content and persistent demo disclosure. Reuse the implemented registry, `useSyncExternalStore` preference hook and shared `NativeSelect` selector above; do not replace it with a context provider. Keep all content English with explicit fallback and no translation provider; do not imply translations or speech are active. Do not create functioning private product routes, providers, APIs or health storage. Add accessible keyboard navigation, focus states, chart summaries, reduced-motion support and responsive layouts. Controls must explain unavailable backend actions rather than simulate real success.
>
> Verify: public pages work without environment secrets; `/preview` needs no login; no fixture contains real identifiers; narrow screens have no horizontal overflow; dialogs restore focus; every icon-only control has a label; contrast does not rely on color alone; production build output confirms intended public static rendering. Check direct private URLs are absent/fail closed, and no root session read makes marketing dynamic. Report tests actually run and any manual checks still needed.

## tRPC and SSR boundary

Use tRPC v11 with the TanStack React Query integration when implementing real application queries and mutations. Server Components use a request-local server caller rather than HTTP loopback. Small interactive client islands use typed query/mutation options, and only necessary authorized data is hydrated. Never instantiate a global server QueryClient or store Clerk actor context across requests. The private layout can mount client providers without turning every page into a Client Component. Clear and replace browser query state on logout/account/tenant changes; revalidate consent on every protected read. No persisted query cache, CDN cache, or cross-user query hydration for health records. Batching does not authorize all operations: each procedure checks its own resource and current scopes.
