# Multi-stage build cho @atomic-me/api trong pnpm monorepo.
# Build context = repo root: docker build -f apps/api/Dockerfile .
#
# Luu y: dung node:20 (debian, glibc) cho deps + build de Prisma query engine
# khop libc voi runtime distroless-debian12. Alpine (musl) se khong tuong thich.

# ---------- Stage 1: deps ----------
FROM node:20-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl de Prisma engine detect dung libssl (distroless-debian12 dung openssl 3).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

# Chi copy manifest truoc de tan dung layer cache khi cai dependencies.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

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

# Build workspace deps truoc (db can prisma generate), roi build api.
RUN pnpm --filter @atomic-me/db build \
  && pnpm --filter @atomic-me/shared build \
  && pnpm --filter @atomic-me/api build

# Luu y: KHONG chay `pnpm prune --prod` o day vi no co the xoa thu muc
# generated `.prisma/client` (khong phai package pnpm track) -> vo hieu Prisma.
# Toi uu kich thuoc image (tach prod deps) de lai cho Phase sau.

# ---------- Stage 3: runtime ----------
# Luu y: copy ca workspace /repo (node_modules pnpm-linked + dist) thay vi `pnpm deploy`.
# Ly do: `pnpm deploy` tai dung node_modules tu store nen KHONG mang theo
# Prisma client da generate (sinh sau install vao virtual store) -> runtime se loi
# "@prisma/client did not initialize". Copy /repo giu nguyen client + query engine linux.
FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /repo/apps/api
ENV NODE_ENV=production

COPY --from=build /repo /repo

# distroless co san user nonroot (uid 65532), khong chay bang root.
USER nonroot
EXPOSE 3001

# Entrypoint cua image distroless da la `node`.
CMD ["dist/server.js"]
