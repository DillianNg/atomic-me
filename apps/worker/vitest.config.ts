import { defineConfig } from 'vitest/config';

// Env cho test: env.ts validate process.env luc import nen phai cung cap day du.
// DATABASE_URL tro toi Postgres local; REDIS_URL fake (test mock BullMQ).
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://atomic:atomic@localhost:5432/atomic_me',
      REDIS_URL: 'redis://localhost:6379',
      R2_ACCOUNT_ID: 'test_account_id',
      R2_ACCESS_KEY_ID: 'test_access_key',
      R2_SECRET_ACCESS_KEY: 'test_secret_key',
      R2_BUCKET: 'atomic-me-test',
    },
  },
});
