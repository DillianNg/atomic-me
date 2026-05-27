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
