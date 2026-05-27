import { z } from 'zod';

/**
 * Schema validate bien moi truong. Source of truth cho env cua API.
 * Khong dung dotenv: Node 20 tu load qua `--env-file`, hoac platform inject.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
});

/** Kieu env da validate, infer tu schema. */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse + validate mot nguon env (throw ZodError neu invalid).
 * Tach rieng de test duoc ma khong trigger fail-fast process.exit.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

/**
 * Load env tu process.env, fail-fast: log chi tiet va exit(1) neu invalid.
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  return result.data;
}

/** Env singleton da validate, dung xuyen ung dung. */
export const env: Env = loadEnv();
