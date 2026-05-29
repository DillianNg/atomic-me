import { defineConfig } from 'vitest/config';

/**
 * Vitest config dieng cho e2e (real Anthropic call).
 * KHONG override ANTHROPIC_API_KEY -> env that tu shell/CI duoc dung.
 * SKIP_E2E mac dinh khong set -> file e2e tu skip neu thieu key thuc.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://atomic:atomic@localhost:5432/atomic_me',
      REDIS_URL: 'redis://localhost:6379',
      R2_ACCOUNT_ID: 'test_account_id',
      R2_ACCESS_KEY_ID: 'test_access_key',
      R2_SECRET_ACCESS_KEY: 'test_secret_key',
      R2_BUCKET: 'atomic-me-test',
      // Khong dat ANTHROPIC_API_KEY o day; lay tu shell de e2e dung key that.
      ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ?? 'sk-ant-test-dummy',
    },
  },
});
