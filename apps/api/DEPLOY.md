# Deploy `@atomic-me/api` to Fly.io

Step-by-step runbook for the first production deploy of the Fastify API
to Fly.io, paired with a Neon Postgres instance for `pgvector` support.
All commands run from the repo root unless noted.

## 0. Prerequisites

- Fly CLI installed (`brew install flyctl` or curl install per Fly docs)
- Fly account + payment method (free hobby tier still requires card)
- A Cloudflare R2 bucket and API token (Phase 5)
- A Clerk app (Phase 3)
- A Postgres database with `pgvector`. Recommended: **Neon free tier**
  (https://neon.tech). Other compatible options: Supabase, self-hosted
  Postgres 16 with the `vector` extension.

## 1. Provision Postgres (Neon)

1. Sign up at https://neon.tech, create a project.
2. Copy the **pooled connection string** -> use as `DATABASE_URL`.
3. Copy the **direct connection string** -> use as `DIRECT_URL`
   (Prisma migrations need the direct one).
4. Open Neon SQL Editor and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

## 2. Apply Prisma migrations against the new DB

Locally, with the Neon URLs:
```bash
DATABASE_URL='postgresql://...?sslmode=require' \
DIRECT_URL='postgresql://...?sslmode=require' \
  pnpm --filter @atomic-me/db exec prisma migrate deploy
```

Confirm the `_prisma_migrations` table has rows for both
`20260526164748_init` and the two Phase 5 migrations.

## 3. Create the Fly app

From the repo root (where `fly.toml` lives):
```bash
fly auth login
fly launch --no-deploy --copy-config
```

Answer the prompts:
- App name: keep `atomic-me-api` (or pick a unique one, then update
  `fly.toml`'s `app` field).
- Region: keep `sin` (Singapore) or change.
- Postgres: **No** (we use Neon).
- Redis: **No** (Phase 7+ concern).

This creates the app on Fly without deploying yet.

## 4. Set secrets

Fly secrets are encrypted env vars made available to the Machine at
runtime. The API exits on boot if any required var is missing.

```bash
fly secrets set \
  DATABASE_URL='postgresql://...?sslmode=require&pgbouncer=true' \
  DIRECT_URL='postgresql://...?sslmode=require' \
  CLERK_SECRET_KEY='sk_live_or_test_...' \
  CLERK_PUBLISHABLE_KEY='pk_live_or_test_...' \
  CLERK_WEBHOOK_SECRET='whsec_...' \
  CLERK_JWT_ISSUER='https://<your-app>.clerk.accounts.dev' \
  R2_ACCOUNT_ID='...' \
  R2_ACCESS_KEY_ID='...' \
  R2_SECRET_ACCESS_KEY='...' \
  R2_BUCKET='atomic-me-assets'
```

Non-secret env (`PORT`, `API_HOST`, `NODE_ENV`, `LOG_LEVEL`) are
already in `fly.toml` `[env]` and do not need to be set as secrets.

## 5. Deploy

```bash
fly deploy
```

Watch the build + release. On success Fly prints the URL, typically
`https://atomic-me-api.fly.dev`. Verify:

```bash
curl https://atomic-me-api.fly.dev/health
# {"status":"ok","uptime":...}
```

## 6. Wire frontend to the new API

On Vercel (project: `atomic-me`):

1. Settings -> Environment Variables (Production scope):
   - `VITE_API_BASE_URL` = `https://atomic-me-api.fly.dev`
   - `VITE_CLERK_PUBLISHABLE_KEY` already set from earlier.
2. Trigger a redeploy (Vite inlines env at build time).

## 7. Update CORS / webhook URLs

- **R2 bucket CORS**: add your Vercel origin to `AllowedOrigins` so the
  browser PUT from production page works:
  ```json
  [
    {
      "AllowedOrigins": [
        "http://localhost:5173",
        "https://<your-vercel-project>.vercel.app"
      ],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```
- **API CORS**: the Phase 5 fix uses `origin: true` (reflect any
  origin). The auth boundary is the Bearer JWT, so this is acceptable.
  Tighten via env later when you want strict allow-listing.
- **Clerk webhook**: in the Clerk Dashboard, update the webhook
  endpoint URL to `https://atomic-me-api.fly.dev/webhooks/clerk` and
  re-copy the signing secret into Fly secrets if it changes.

## 8. Verify end to end

From the Vercel-hosted page:
- Sign in via Clerk -> redirected to `/upload`.
- Drag a PDF, hit Upload.
- Network tab shows `POST /assets/upload-url` -> 200 (to Fly URL).
- PUT to R2 succeeds.
- `POST /assets/confirm` -> 200.
- Asset row exists in Neon `Asset` table with status `UPLOADED`.

## Operational notes

- The rate-limit plugin is **in-memory per Machine**. With
  `min_machines_running = 0` + auto-start, scaling beyond a single
  Machine breaks per-user limits (each Machine has its own buckets).
  Move to Redis-backed rate limiting in a later phase if you scale.
- Auto-stop is enabled to save the free hobby budget. First request
  after idle takes ~2 seconds to warm up.
- `fly logs` streams stdout/stderr from running Machines.
- `fly status` shows Machine health + the most recent deploy.
- Rollback: `fly releases` lists past releases; `fly deploy --image
  registry.fly.io/atomic-me-api:deployment-<id>` redeploys a prior
  build.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Invalid environment variables` on boot | A required secret is missing or empty. `fly secrets list` shows what's set. |
| 401 on every authed route | `CLERK_JWT_ISSUER` doesn't match the actual `iss` claim of the JWT. Copy it from Clerk Dashboard -> API Keys -> Frontend API URL. |
| 503 on `/ready` after deploy | The DB is unreachable from Fly. Verify Neon allows connections from the Fly egress IPs (Neon usually allows all). |
| R2 PUT 403 | The `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` token does not have R2 Object Read & Write on the bucket. |
| Browser blocks R2 PUT (CORS) | R2 bucket CORS missing the Vercel origin. |
| Machine OOM-killed | 512 MB is enough for the API + Prisma engine, but heavy concurrent uploads may need more. Bump `[[vm]] memory_mb` and `fly deploy`. |
