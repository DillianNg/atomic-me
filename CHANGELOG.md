# Changelog

All notable changes to this project are documented here. Phases map to the
build plan; each is shipped behind a git tag for easy rollback.

## Phase 5 - Upload pipeline (Cloudflare R2)

### Backend (`apps/api`)

- **Storage plugin** (`plugins/storage.ts`): R2 S3-compatible client via AWS SDK v3
  + `presignPut` and `presignGet` helpers (private bucket, 5 minute TTL). Exposes
  `sanitizeFilename` and `buildStorageKey` (`users/{userId}/assets/{assetId}/{file}`).
- **Rate-limit plugin** (`plugins/rate-limit.ts`): in-memory per-user sliding
  window (20 req / minute / user keyed by `request.user.id`, IP fallback). Runs
  as preHandler after `authenticate`. Throws `RateLimitError` (429 RATE_LIMITED).
- **Asset routes** (`routes/assets/{schema,handlers,index}.ts`):
  - `POST /assets/upload-url`: validates size + MIME, derives `AssetType` from
    MIME, creates `Asset` (status `PENDING`), returns presigned PUT URL.
  - `POST /assets/confirm`: scoped to `userId` from JWT, transitions PENDING ->
    UPLOADED, writes audit log (`ASSET_UPLOADED`). Idempotent.
- **Asset repo + service** (`repositories/asset.repo.ts`,
  `services/asset.service.ts`): pure Prisma layer + validation/orchestration.
- **AuditAction** union extended with `ASSET_UPLOADED`.
- **Env**: added required `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (fail-fast on boot).
- **Tests**: 26 new (storage helpers, asset.service validation, route
  integration including 401/400/429/404 + audit). 71 tests total, all green.

### Frontend (`apps/web`)

- New `features/upload/` slice:
  - `api.ts`: orchestration helpers (`requestUploadUrl`, `putToR2` via XHR for
    upload progress, `confirmUpload`).
  - `hooks/useUploadAsset.ts`: state machine (idle / requesting / uploading /
    confirming / done / error) plus client-side size + MIME guard.
  - `hooks/usePresignedUrl.ts`: TanStack Query mutation for the first leg.
  - `components/UploadDropzone.tsx`: click + drag-drop input.
  - `components/FilePreview.tsx`: name, size, MIME card.
  - `components/ParseProgress.tsx`: progress bar with stage label (Phase 6 hook
    in place for parse status).
- `pages/upload.tsx`: replaces the Phase 4 placeholder with the full feature.
- README at `features/upload/README.md` documents the manual E2E test against
  real R2 (bucket + CORS + env setup).

### Schema / shared

- Migration `20260528000000_asset_pending_status`: adds `PENDING` to the
  `AssetStatus` enum (before `UPLOADED`) and changes `Asset.status` default to
  `PENDING`. Lowest-risk add (kept `EXTRACTING` / `COMPLETED` for later phases).
- `packages/shared/src/schemas/asset.ts`: Zod schemas for upload-url and confirm
  (request + response) as the single source of truth for FE/BE.

### Notes

- `MAX_FILE_SIZE_MB` kept at 25 (per user decision, spec said 10).
- Bucket is private; only signed URLs reach R2. FE PUTs directly, never proxied.
- Rate limit is per-process for Phase 5 (one API instance behind Cloudflare).
  Multi-instance deployments will need a shared store (Redis).
- R2 CORS for PUT from the FE origin is a Cloudflare-dashboard step, documented
  in `apps/web/src/features/upload/README.md`.

## Phase 4 - Frontend shell + layout

- Layout (`Sidebar`, `TopBar`, `PageContainer`, `AppLayout`) with collapse
  persisted via Zustand and a route-derived TopBar title + user-menu dropdown.
- shadcn-style UI primitives over Radix: `button`, `dialog`, `dropdown-menu`,
  `tooltip`, `toast` + `toaster` + `use-toast`, `input`, `card`, `skeleton`.
- Feedback components: `EmptyState`, `ErrorBoundary` (class + retry),
  `LoadingSkeleton` (card / list / text variants).
- Theme + dark mode: HSL CSS variables on `:root` and `.dark`; Tailwind v3
  `darkMode: 'class'` mapping; inline boot script in `index.html` to avoid FOUC.
- Zustand UI store (`stores/ui.ts`) persisted to localStorage under
  `atomic-me-ui` (`sidebarCollapsed`, `theme`).
- Routing: protected routes wrapped in `ProtectedRoute` + `AppLayout`. Eight
  placeholder pages with `// TODO: Phase X` markers.
- `@/` path alias in tsconfig + vite.config; `lib/query-client` updated (queries
  retry 1, mutations 0); `lib/utils` gains `formatDate` + `truncate`.

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
