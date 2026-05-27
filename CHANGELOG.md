# Changelog

All notable changes to this project are documented here. Phases map to the
build plan; each is shipped behind a git tag for easy rollback.

## Phase 3 - Authentication (Clerk)

### Backend (`apps/api`)

- **Auth plugin** (`plugins/auth.ts`): verifies Clerk session JWTs via
  `@clerk/backend` `verifyToken` (with a manual issuer check), decorates
  `request.user` and a `fastify.authenticate` preHandler. Lazy-creates the local
  user from the Clerk profile when the webhook has not synced yet.
- **Clerk webhook** (`routes/webhooks/clerk.ts`): `POST /webhooks/clerk`, signature
  verified with `svix`. Handles `user.created` / `user.updated` / `user.deleted`
  idempotently; deletions are soft (sets `deletedAt`, keeps related rows).
- **User repository** (`repositories/user.repo.ts`): pure Prisma access.
- **Provisioning service** (`services/user.service.ts`): creates the user plus an
  initial `CreditBalance` (signup bonus) and matching `CreditTransaction`, then
  writes an audit log, all in one transaction. Shared by the webhook and the
  auth lazy-create path.
- **Audit service** (`services/audit.service.ts`): minimal `logAudit` mapped onto
  the existing `AuditLog` model (`action`/`entityType`/`entityId`). Never throws.
- **Protected route** `GET /me` returns the authenticated user.
- **Env**: added required `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`,
  `CLERK_WEBHOOK_SECRET`, `CLERK_JWT_ISSUER` (fail-fast validation).
- **Tests**: 19 new tests covering repo, audit service, `/me` (401/200/expired),
  and the webhook (missing header 400, bad signature 401, `user.created`,
  idempotent retry, `user.deleted`). 45 tests total.

### Frontend (`apps/web`)

- New Vite + React 18 + TypeScript app with Tailwind v3, React Router v6, and
  TanStack Query.
- `ClerkProvider` shell, `/sign-in` and `/sign-up` (Clerk path routing),
  `ProtectedRoute` (redirects to `/sign-in` when signed out), and a protected
  `/upload` placeholder that calls `GET /me`.
- `lib/api-client.ts`: fetch wrapper that attaches the Clerk bearer token and
  normalizes backend error envelopes into a typed `ApiClientError`.
- `lib/query-client.ts`: TanStack Query client that does not retry 401/403.
- Auth hooks (`useUser`, `useSession`, `useApiClient`) wrap Clerk so the rest of
  the app does not depend on Clerk-specific shapes directly.

### Notes

- `AuditLog` is written via field mapping (`action`/`entityType`/`entityId`); no
  schema change was made.
- Signup grants both a `CreditBalance` and a `CreditTransaction` for ledger
  consistency.
- Live verification (real Clerk keys, ngrok webhook, browser flow) is performed
  separately; automated tests use mocked Clerk verification and real `svix`
  signing.

## Phase 2 - API skeleton

- Fastify v5 backend (`apps/api`): env validation, Pino logger, AppError
  hierarchy + error handler, Prisma db plugin, `/health` and `/ready` routes,
  vitest tests, multi-stage distroless Dockerfile.

## Phase 1 - Database and shared schema

- `packages/db`: Prisma 5 + pgvector schema (10 models, 8 enums), seed, client
  singleton.
- `packages/shared`: Zod schemas, constants, utils.
- Docs: `atom-schema.md`, `credit-system.md`.

## Phase 0 - Monorepo bootstrap

- pnpm 9 + Turborepo 2 skeleton, shared `tsconfig` / `eslint-config`, CI
  workflow, docs.
