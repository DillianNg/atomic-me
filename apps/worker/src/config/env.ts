import { z } from 'zod';

/**
 * Schema validate bien moi truong worker.
 * Khac apps/api: khong can Clerk (worker khong serve HTTP).
 * Khong dung dotenv: Node 20+ tu load qua `--env-file` (xem package.json scripts).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  /** Postgres connection (giong API). */
  DATABASE_URL: z.string().url(),

  /** BullMQ Redis. Default tro local docker-compose. */
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // R2: worker download file da upload de parse.
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/** Parse + validate, separate function de unit test. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

/** Load tu process.env, fail-fast neu invalid. */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid worker environment variables:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env: Env = loadEnv();
