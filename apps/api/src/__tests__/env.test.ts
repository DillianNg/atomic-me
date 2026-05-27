import { describe, expect, it } from 'vitest';

import { parseEnv } from '../config/env.js';

// Base env hop le (du moi field bat buoc, gom ca Clerk) de test cac case positive.
const validBase = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  CLERK_SECRET_KEY: 'sk_test_x',
  CLERK_PUBLISHABLE_KEY: 'pk_test_x',
  CLERK_WEBHOOK_SECRET: 'whsec_test_x',
  CLERK_JWT_ISSUER: 'https://example.clerk.accounts.dev',
} as const;

describe('env schema', () => {
  it('rejects when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow();
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => parseEnv({ ...validBase, DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('rejects when a Clerk variable is missing', () => {
    const { CLERK_SECRET_KEY: _omit, ...withoutSecret } = validBase;
    expect(() => parseEnv(withoutSecret)).toThrow();
  });

  it('rejects an invalid CLERK_JWT_ISSUER', () => {
    expect(() => parseEnv({ ...validBase, CLERK_JWT_ISSUER: 'not-a-url' })).toThrow();
  });

  it('accepts a valid env and applies defaults', () => {
    const env = parseEnv({ ...validBase });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.API_HOST).toBe('0.0.0.0');
    expect(env.CLERK_SECRET_KEY).toBe('sk_test_x');
    expect(env.CLERK_JWT_ISSUER).toBe('https://example.clerk.accounts.dev');
  });

  it('coerces PORT from a string', () => {
    const env = parseEnv({ ...validBase, PORT: '8080' });
    expect(env.PORT).toBe(8080);
  });

  it('rejects an out-of-enum NODE_ENV', () => {
    expect(() => parseEnv({ ...validBase, NODE_ENV: 'staging' })).toThrow();
  });
});
