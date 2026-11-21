# tRPC application boundary

Current state: Runtime foundation implemented with tRPC v11 (`@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`), TanStack Query v5, and Zod v4.

## Implemented architecture

```text
server/trpc/context.ts       # Request-local Clerk actor (userId, sessionId, orgId, requestId, origin, host)
server/trpc/init.ts          # tRPC initialization, error sanitization, CSRF/Same-Origin middleware, protectedProcedure
server/trpc/routers/_app.ts  # Composed AppRouter + type export
server/trpc/routers/auth.ts  # Minimal protected identity procedure ('auth.me')
app/api/trpc/[trpc]/route.ts # Fetch adapter with private no-store transport headers
```

## Security & procedure policies

- **Identity resolution**: Derived directly from Clerk (`auth()`) within request context. Unauthenticated callers are rejected with `UNAUTHORIZED`.
- **CSRF / Origin validation**: `enforceSameOrigin` middleware verifies browser `Origin` matches the incoming `Host` or `NEXT_PUBLIC_APP_URL`. Mismatched origins throw `FORBIDDEN`.
- **Sanitized error formatting**: `errorFormatter` strips internal `stack` traces while retaining `requestId` and safe field errors.
- **Transport headers**: Every response from `/api/trpc` explicitly sets `Cache-Control: private, no-store, max-age=0, must-revalidate`.
- **Minimal scope**: Only `auth.me` returning `{ subject, sessionId, orgId }` is exposed. No health records, diagnosis, or clinical data.

## Acceptance checks
- [x] Unauthenticated procedure denied with `UNAUTHORIZED`.
- [x] Cross-origin cookie/session request denied with `FORBIDDEN`.
- [x] Server caller and HTTP transport enforce identical authentication middleware.
- [x] Sensitive stack traces absent from client error payloads.
- [x] `Cache-Control: private, no-store` enforced on transport responses.
- [ ] Domain routers (`journal`, `assessment`, `consent`, `coaching`, `clinic`) (deferred to feature tasks).

## Test evidence
- `tests/trpc/auth-router.test.ts`: 4 tests for unauthenticated rejection, valid session return, cross-origin rejection, and valid origin acceptance.
- `tests/trpc/server-caller.test.ts`: 2 tests for context isolation and middleware enforcement.
- `tests/trpc/route-handler.test.ts`: 2 tests for `private, no-store` response headers and sanitized error payloads.
