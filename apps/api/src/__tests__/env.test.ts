import { describe, expect, it } from 'vitest';

import { parseEnv } from '../config/env.js';

describe('env schema', () => {
  it('rejects when DATABASE_URL is missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow();
  });

  it('rejects an invalid DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('accepts a valid env and applies defaults', () => {
    const env = parseEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' });
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.API_HOST).toBe('0.0.0.0');
  });

  it('coerces PORT from a string', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      PORT: '8080',
    });
    expect(env.PORT).toBe(8080);
  });

  it('rejects an out-of-enum NODE_ENV', () => {
    expect(() =>
      parseEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', NODE_ENV: 'staging' }),
    ).toThrow();
  });
});
