# Shared modules

`contracts/index.ts` defines integration **interfaces**, not Zod validation or database schema. `demo/preview.ts` is public synthetic content only. `utils.ts` is the existing shadcn utility. Do not put secrets, provider SDK clients, ORM clients or health records in shared modules.

Task prompt: add server-validated Zod schemas when the corresponding feature is implemented, derive DTOs where practical, and ensure input schemas do not allow client-controlled owner/tenant/role/consent grants. Document units, timestamps, nullability and migration impact. Keep public DTOs minimal and never export server-only clients through a shared barrel. Adapt contract changes deliberately across producers/consumers with focused tests.
