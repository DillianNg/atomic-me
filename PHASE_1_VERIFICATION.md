# Phase 1 Verification Report

Database & Shared Schema. Scope touched only `packages/db`, `packages/shared`, `docs/`, and root `docker-compose.yml` / `.env.example`. No `apps/*` files were modified.

## Tool Versions

- **pnpm**: 9.15.4
- **Node.js**: v21.5.0 (local; `.nvmrc` pins 20.11.0 for CI)
- **Turborepo**: 2.9.14
- **TypeScript**: 5.7.3 (resolved 5.9.x)
- **Prisma**: 5.22.0
- **Zod**: 3.24.x
- **Postgres**: 16 + pgvector (image `pgvector/pgvector:pg16`, run via Podman 4.9.5 / QEMU)

## Acceptance Criteria

| #   | Criterion                                               | Result                                 |
| --- | ------------------------------------------------------- | -------------------------------------- |
| 1   | `pnpm install` clean                                    | PASS                                   |
| 2   | `db:generate` creates Prisma client                     | PASS                                   |
| 3   | `db:migrate` applies (extension + HNSW index), no drift | PASS                                   |
| 4   | `db:seed` >= 50 skills, idempotent on rerun             | PASS (76 skills, stable across 2 runs) |
| 5   | `db:studio` opens, 10 tables visible                    | PASS (HTTP 200, 10 model tables)       |
| 6   | `@atomic-me/shared` builds (tsc emit)                   | PASS                                   |
| 7   | Zod schema tests (>= 3 cases per main schema)           | PASS (19 tests)                        |
| 8   | TSDoc on main exports                                   | PASS                                   |
| 9   | `pnpm lint` clean                                       | PASS                                   |
| 10  | No `apps/*` touched                                     | PASS                                   |

## Key Command Output

### db:migrate (extension + index confirmation)

```
Datasource "db": PostgreSQL database "atomic_me", schema "public" at "localhost:5432"
Applying migration `20260526164748_init`
Database schema is up to date!
```

Migration head includes:

```
CREATE EXTENSION IF NOT EXISTS "vector";
"embedding" vector(1024),
```

Migration tail (manually added, Prisma does not manage indexes on `Unsupported` columns):

```
CREATE INDEX "Atom_embedding_idx" ON "Atom" USING hnsw ("embedding" vector_cosine_ops);
```

Verified live: `Atom_embedding_idx` exists as `USING hnsw (embedding vector_cosine_ops)`.

### db:seed

```
Seed done. 76 skills upserted. Total canonical skills in DB: 76
```

Second run: total stays 76 (idempotent via upsert on unique `name`).
Per category: TECHNICAL 15, TOOL 16, FRAMEWORK 15, DOMAIN 12, SOFT 10, LANGUAGE 8.

### Tests

```
Test Files  1 passed (1)
     Tests  19 passed (19)
```

### 10 model tables (Prisma Studio / DB)

Asset, Atom, AuditLog, CanonicalSkill, CreditBalance, CreditTransaction, Generation, JD, Referral, User.

## Deviations from Spec

1. **cuid vs cuid2 for DB IDs**: Spec requested cuid2. Prisma 5.22 does not accept `@default(cuid(2))` (the `cuid()` function takes no argument until Prisma 6). The spec also pinned "Prisma 5", so I kept Prisma 5 and used `@default(cuid())` (cuid v1) for DB-generated IDs. App-side ID generation in `@atomic-me/shared` (`generateAtomId`) uses real cuid2 via `@paralleldrive/cuid2`. Both are collision-resistant; only the DB default differs.

2. **`Atom.embedding` is nullable**: Declared `Unsupported("vector(1024)")?`. A required `Unsupported` column makes the model uncreatable through Prisma Client (you would be forced into raw SQL for every insert). Embeddings are populated asynchronously by the worker after extraction (per architecture), so an atom legitimately exists before it has an embedding. The HNSW index skips nulls.

3. **`@paralleldrive/cuid2` added to `packages/shared` deps**: Required by the spec's `utils/atom-id.ts` (cuid2 wrapper). Spec listed only `zod` as a dep, so this is an explicit, spec-driven addition.

4. **`vitest` added to `packages/shared` devDeps**: Required to satisfy acceptance criterion 7 (Zod schema tests). Test-only, not shipped.

5. **Container runtime is Podman 4.9.5, not Docker**: This machine is macOS 12.6.1 (Monterey) with no Homebrew and no Docker. Current Docker Desktop dropped Monterey support. Podman 4.9.x is Docker-compatible, its macOS installer bundles QEMU (no Homebrew needed), and 4.x still supports QEMU on Monterey. The committed `docker-compose.yml` is unchanged and correct for any developer who does have Docker. The VM was set to rootful to give the image unpack a valid uid/gid range.

6. **A few `Json` fields are nullable** (`JD.parsedRequirements`, `AuditLog.metadata`): these are populated after row creation, so nullable matches reality. `Atom.evidenceSpan` is kept non-nullable to enforce the anti-hallucination invariant.

7. **`User.credits` relation**: modeled as two relations, `creditBalance` (1:1) and `creditTransactions` (1:many), to cover both the running balance and the ledger.

## Module / Build Notes

- `tsconfig` packages use `module: ESNext` + `moduleResolution: Bundler` for the `tsc` emit to be valid (the bundler resolver pairs with esnext modules). Downstream apps bundle, so extensionless ESM imports are fine.
- `@atomic-me/db#build` runs `prisma generate` (writes into `node_modules`), so Turbo prints a harmless "no output files found" cache warning. Not an error.

## Defer to Next Phase

- `apps/api`, `apps/web`, `apps/worker` implementation.
- Repository layer with pgvector `$queryRaw` similarity search.
- `packages/db` connection pooling tuning for serverless (PgBouncer / `directUrl` split).
- Clerk, R2, BullMQ integration.
