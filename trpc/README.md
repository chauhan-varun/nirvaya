# tRPC client and React Server Component integration

Current state: Implemented client provider, query-client factory, and server-only request caller.

## Implemented files

- `trpc/query-client.ts`: Factory creating fresh `QueryClient` instances per request/client lifecycle. Never a shared global server client.
- `trpc/client.tsx`: `"use client"` provider wrapping children with `QueryClientProvider` and `TRPCProvider`. Mounted exclusively in `app/(private)/layout.tsx`.
- `trpc/server.ts`: `"server-only"` request-local caller (`createCaller`) creating an authorized in-process caller with zero HTTP loopback.

## Acceptance checks
- [x] Public routes remain SSG; private pages render per request.
- [x] Providers isolated to private route tree (`app/(private)/layout.tsx`); root layout unaffected.
- [x] No shared server QueryClient across requests.
- [x] Direct SSR execution via `createCaller()` without network overhead.
- [ ] Hydration boundary for interactive client islands (deferred to client feature tasks).
