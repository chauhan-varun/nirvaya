# Clerk identity and private routing

## Current state
Clerk Next.js SDK (`@clerk/nextjs` v7 / Core 3) is installed and configured with Next.js 16 `proxy.ts`, prebuilt sign-in/sign-up pages, and a private dynamic `/dashboard` shell. Public landing (`/`) and preview routes (`/preview/**`) remain statically generated without credentials.

## Implemented architecture

1. **Proxy route integration (`proxy.ts`)**:
   - Replaced legacy `middleware.ts` with Next.js 16 `proxy.ts`.
   - Uses bare `export default clerkMiddleware()` in accordance with Clerk Core 3 guidance (avoiding deprecated `createRouteMatcher`).
   - Matcher config excludes Next.js static assets and explicitly includes `/(api|trpc)(.*)` so `auth()` receives session context across all application endpoints.
   - Explicitly includes `/__clerk(.*)` so Clerk's automatic production proxy on `*.vercel.app` handles its JavaScript assets instead of skipping them as static files. Redeploy after changing the matcher; verify Clerk script requests return HTTP 200 in the browser Network tab.

2. **Resource-based route protection**:
   - Each protected resource enforces its own authentication:
     - `app/(private)/dashboard/page.tsx`: Enforces `await auth.protect()` directly in the Server Component with an adjacent `loading.tsx`.
     - `app/(private)/layout.tsx`: Evaluates `auth()` server-side and redirects unauthenticated or unconfigured requests before rendering.
     - `server/trpc/init.ts`: `protectedProcedure` verifies identity and enforces CSRF/Same-Origin checks.
     - `app/api/trpc/[trpc]/route.ts`: Sets `Cache-Control: private, no-store, max-age=0, must-revalidate`.

3. **Sign-in and sign-up (`app/(auth)/`)**:
   - Prebuilt `<SignIn />` and `<SignUp />` components with brand styling.
   - Includes English-first `LanguageSelector` in the header.
   - Includes truthful setup cards explaining unconfigured environment keys when testing without `.env.local`.

4. **Authenticated dashboard shell (`app/(private)/dashboard/`)**:
   - Dynamic SSR (`force-dynamic`).
   - Private layout validates authentication before rendering.
   - Calls the request-local tRPC server caller (`createCaller()`) to resolve the user's verified subject.
   - Renders an honest empty state with zero fabricated health records, scores, or mock data.

## Acceptance checks
- [x] Signed-out requests cannot read private HTML, RSC, tRPC procedures, server callers or external handlers.
- [x] Bare `clerkMiddleware()` used without deprecated `createRouteMatcher`.
- [x] Resource-based protection enforced at page (`await auth.protect()`), layout, and tRPC procedure boundaries.
- [x] Public landing and static preview build without auth secrets; private routes are request-time and never shared-cache health data.
- [x] Server caller enforces identical authentication checks as HTTP transport.
- [ ] Internal user/patient database record mapping (blocked on Drizzle foundation task).
- [ ] Clerk webhook signature deduplication and user deletion sync (blocked on database/events task).

## Test evidence
- `tests/auth/proxy.test.ts`: Automated tests verifying bare `clerkMiddleware()`, matcher configuration, Clerk proxy script/API matching, ordinary static-asset exclusions, and avoidance of deprecated `createRouteMatcher`.
