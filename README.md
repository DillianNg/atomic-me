# atomic-me

AI-powered platform that transforms career documents into reusable "atoms" (skills, achievements, testimonials, projects, credentials) with evidence traceability. When applying to a new JD, the system reranks and recomposes atoms into tailored CVs and cover letters.

## Prerequisites

- **Node.js** >= 20.11 (see `.nvmrc`)
- **pnpm** >= 9 (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **Docker** (for Postgres + Redis in later phases)

## Quick Start

```bash
# Clone
git clone <repo-url> atomic-me
cd atomic-me

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Run development (when apps are implemented)
pnpm dev
```

## Project Structure

```
atomic-me/
├── apps/
│   ├── web/          # Frontend: Vite + React 18 + Tailwind v3 + Clerk
│   ├── api/          # Backend: Fastify + Prisma + Clerk
│   └── worker/       # Background jobs: BullMQ workers
├── packages/
│   ├── tsconfig/     # Shared TypeScript configs
│   ├── eslint-config/# Shared ESLint flat config presets
│   ├── db/           # Prisma schema + migrations (Phase 1+)
│   └── shared/       # Shared types, schemas, constants (Phase 1+)
├── docs/             # Architecture and design docs
├── turbo.json        # Turborepo task pipeline
└── pnpm-workspace.yaml
```

See [docs/architecture.md](docs/architecture.md) for detailed architecture overview.

## Authentication (Clerk) - dev setup

Phase 3 uses [Clerk](https://clerk.com) as the identity provider. To run auth locally:

1. **Create a Clerk application** (free dev instance) at the Clerk Dashboard.
2. **Copy the keys** into your env files:
   - Root `.env` (loaded by `apps/api`):
     ```
     CLERK_SECRET_KEY=sk_test_...
     CLERK_PUBLISHABLE_KEY=pk_test_...
     CLERK_JWT_ISSUER=https://<your-app>.clerk.accounts.dev   # = Frontend API URL
     CLERK_WEBHOOK_SECRET=whsec_...                            # filled in step 4
     ```
   - `apps/web/.env.local`:
     ```
     VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
     VITE_API_BASE_URL=http://localhost:3001
     ```
   See `.env.example`, `apps/api/.env.example`, and `apps/web/.env.example` for the full list.
   The API validates these on boot and exits if any are missing.
3. **Run the apps**: `pnpm dev` (api on `:3001`, web on `:5173`).
4. **Wire the webhook** so Clerk syncs users into the local DB:
   - Expose the API: `ngrok http 3001`.
   - In the Clerk Dashboard add a webhook endpoint `https://<ngrok-id>.ngrok.app/webhooks/clerk`
     subscribed to `user.created`, `user.updated`, `user.deleted`.
   - Copy the endpoint's **Signing Secret** into `CLERK_WEBHOOK_SECRET` and restart the API.
   - You can also fire test events from the Clerk Dashboard "Testing" tab.

Smoke test: sign up in the web app, get redirected to `/upload`, and the page calls the
protected `GET /me` endpoint with your Clerk JWT and shows your user record.

## Background worker (Phase 6+)

`apps/worker` is a separate Node process that consumes BullMQ jobs (currently
`parse-asset`). To run it locally:

```bash
# 1. Start Postgres + Redis (docker-compose ships both).
docker compose up -d

# 2. (One-time) apply Prisma migrations against local Postgres.
set -a && source .env && set +a
pnpm --filter @atomic-me/db exec prisma migrate deploy

# 3. Run the API and the worker in two terminals.
pnpm --filter @atomic-me/api dev      # terminal A: http://localhost:3001
pnpm --filter @atomic-me/worker dev   # terminal B: BullMQ consumer
```

End-to-end smoke test:

1. Sign in, drop a PDF on the `/upload` page in the web app.
2. The browser PUTs the file to R2 then calls `POST /assets/confirm` which
   transitions the asset to `UPLOADED` and enqueues `parse-asset`.
3. The worker logs `Worker ready`, pulls the job, downloads the PDF, parses
   it via `unpdf`, and writes `parsedText` + `status = PARSED`.
4. Query `pnpm --filter @atomic-me/db db:studio` to inspect the `Asset` row.

Inspect Redis directly:

```bash
docker exec -it atomic-me-redis redis-cli
> KEYS bull:parse-asset:*
> LLEN bull:parse-asset:failed
```

## Available Scripts

| Script              | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start all apps in development mode      |
| `pnpm build`        | Build all packages and apps             |
| `pnpm lint`         | Lint all packages with ESLint           |
| `pnpm typecheck`    | Run TypeScript type checking            |
| `pnpm test`         | Run all tests                           |
| `pnpm format`       | Format code with Prettier               |
| `pnpm format:check` | Check formatting without writing        |
| `pnpm clean`        | Remove build artifacts and node_modules |

## Contribution Flow

1. Create a feature branch from `main`
2. Make changes following existing conventions
3. Run `pnpm lint && pnpm typecheck && pnpm build` locally
4. Open a PR targeting `main`
5. CI will run lint, typecheck, build, and test automatically
6. Get review, merge

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, etc.
