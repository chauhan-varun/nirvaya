# Drizzle data boundary

Future location for `schema/`, lazy `pg` pool/Drizzle binding and scoped repositories. No database code is present. Follow `../../drizzle/README.md` and `../../docs/data-model.md`. Only server-only services/routers/jobs may import database code; clients receive minimal DTOs or inferred tRPC outputs, never table rows or driver clients. Keep SQL migration output in root `drizzle/` and configuration in root `drizzle.config.ts` when implemented.
