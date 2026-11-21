# Server-only implementation boundary

No server logic is implemented yet. Use tRPC for application operations, Drizzle ORM with node-postgres for canonical data, and narrow HTTP handlers only for external integration boundaries.

```text
server/auth/          # Clerk actor, organization and permission resolution
server/trpc/          # Request context, protected procedures, root/domain routers
server/db/            # Drizzle schema, pg pool, authorized repositories
server/services/      # Use cases; ownership and consent enforced here
server/integrations/  # Sarvam, selected LLM, Neo4j adapters
server/safety/        # Reviewed deterministic pre/post AI policy
server/jobs/          # Outbox dispatch / graph projection, later reminders
```

Task prompt: use `import "server-only"` in server modules, lazy validated environment access, explicit dependency boundaries and sanitized typed errors. Server Components use a request-local tRPC caller (no HTTP loopback); procedures validate inputs, resolve the actor and call authorized services. Browser callers use tRPC + TanStack Query, not hand-written REST fetches. Enforce policies again inside services for jobs/internal calls. Use the Node runtime for pg/Drizzle/Neo4j; bound pool size, release connections, close graph sessions, parameterize queries and bound provider timeouts/retries. Do not connect to databases or require secrets while importing public UI/build modules. No in-memory fallback store for real health data.

Read `trpc/README.md` in this folder for router setup, `../trpc/README.md` for client/RSC integration, and `../drizzle/README.md` for migrations. These are guides, not installed integrations.
