import { defineConfig } from 'vitest/config';

// Env cho test: env.ts validate process.env luc import nen phai cung cap day du.
// DATABASE_URL tro toi Postgres local (docker-compose / podman) cho test /ready.
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      API_HOST: '0.0.0.0',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://atomic:atomic@localhost:5432/atomic_me',
      // Gia tri Clerk gia lap cho test: env.ts validate luc import nen phai co.
      CLERK_SECRET_KEY: 'sk_test_dummy',
      CLERK_PUBLISHABLE_KEY: 'pk_test_dummy',
      CLERK_WEBHOOK_SECRET: 'whsec_dGVzdHNlY3JldHRlc3RzZWNyZXQ=',
      CLERK_JWT_ISSUER: 'https://example.clerk.accounts.dev',
      // R2 (Phase 5): gia tri gia lap cho test, khong cham R2 that.
      R2_ACCOUNT_ID: 'test_account_id',
      R2_ACCESS_KEY_ID: 'test_access_key',
      R2_SECRET_ACCESS_KEY: 'test_secret_key',
      R2_BUCKET: 'atomic-me-test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/lib/errors.ts', 'src/plugins/error-handler.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
