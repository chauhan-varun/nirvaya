# PostgreSQL / Drizzle ORM implementation

Current state: Fully implemented with compatible stable `drizzle-orm` (0.45.4), `drizzle-kit` (0.31.11), and `pg` (8.23.1). PostgreSQL 17 running in Docker.

## Implemented architecture

```text
server/db/schema/index.ts         # Re-exports all tables, relations, and inferred types
server/db/schema/users.ts         # User entity mapping unique Clerk subject ID
server/db/schema/tenants.ts       # Tenant and membership boundaries
server/db/schema/patients.ts      # Patient records and delegations with composite keys
server/db/schema/consent.ts       # Consent grants and append-only consent events
server/db/schema/observations.ts  # Observations with numeric(8,2) precision & composite FK
server/db/schema/events.ts        # Audit events, transactional outbox events, idempotency records
server/db/index.ts                # Lazy server-only pg Pool & Drizzle instance (no eager connect on build)
server/db/repositories/           # Typed scoped repository functions for users, patients, observations
drizzle.config.ts                 # Drizzle Kit configuration (PostgreSQL dialect)
drizzle/0000_stale_manta.sql      # Generated SQL migration with foreign keys and unique constraints
```

## Database commands

```sh
pnpm db:generate   # drizzle-kit generate (generates SQL migrations from schema)
pnpm db:migrate    # drizzle-kit migrate (applies pending migrations)
pnpm db:studio     # drizzle-kit studio (local database browser)
```

## Security & consistency contracts

- **Clerk subject mapping**: `users.clerk_subject` carries a globally unique constraint. No passwords or custom JWT credentials exist in PostgreSQL.
- **Cross-tenant isolation**: Composite foreign keys link `(tenant_id, patient_id)` directly to `patients(tenant_id, id)`. Inserting or querying mismatched tenant and patient combinations fails at the database level.
- **Numeric medical precision**: Observations use `numeric(8, 2)` instead of floating point, preventing rounding errors for glucose and vitals.
- **Transactional outbox & audit**: `recordObservationAtomic` commits the canonical observation, an immutable audit record, and an outbox projection event in a single atomic database transaction.
- **Lazy connection**: The pool and Drizzle binding are lazy proxies that do not open connections during module load, ensuring public static pages (`next build`) compile cleanly without database credentials.

## Acceptance checks
- [x] Fresh-volume migration succeeds with `pnpm db:migrate`.
- [x] Repeat migration is idempotent and safe.
- [x] Real composite foreign keys enforced on tenant-patient references.
- [x] Outbox + audit + observation commit atomically in a transaction.
- [x] Public Next.js production build succeeds without eager database connections.
- [x] Tested against real PostgreSQL 17 in Docker (not SQLite).

## Test evidence
- `tests/db/schema.test.ts`: 5 tests verifying schema column definitions, constraints, and precision.
- `tests/db/repositories.test.ts`: 3 integration tests verifying idempotent Clerk user upsert, atomic transaction writes, and composite foreign-key rejection of cross-tenant observation attempts.
