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
│   ├── web/          # Frontend: Vite + React 18 + Tailwind v4
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
