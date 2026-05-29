# Multi-stage build cho @atomic-me/worker trong pnpm monorepo.
# Build context = repo root:  docker build -f apps/worker/Dockerfile .
#
# Stack: node:20-slim + pnpm 9.15.4.
# Runtime: distroless-debian12 (giong apps/api) -> glibc khop voi Prisma engine.

# ---------- Stage 1: deps ----------
FROM node:20-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/worker/package.json apps/worker/

RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:20-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

COPY --from=deps /repo ./
COPY . .

# Build workspace deps (db can prisma generate, shared can build dist) roi worker.
RUN pnpm --filter @atomic-me/db build \
  && pnpm --filter @atomic-me/shared build \
  && pnpm --filter @atomic-me/worker build

# ---------- Stage 3: runtime ----------
# Copy ca workspace /repo de giu nguyen Prisma client + pnpm-linked node_modules.
FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /repo/apps/worker
ENV NODE_ENV=production

COPY --from=build /repo /repo

# distroless co user 'nonroot' (uid 65532). Khong chay bang root.
USER nonroot

# Worker khong listen HTTP -> khong EXPOSE port.
CMD ["dist/index.js"]
