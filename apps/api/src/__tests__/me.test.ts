import type { User } from '@atomic-me/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import type { ClerkJwtClaims } from '../lib/clerk.js';
import * as clerk from '../lib/clerk.js';
import * as userRepo from '../repositories/user.repo.js';

// Mock bien gioi: Clerk (network) + repo (DB) + service. Khong cham Postgres/Clerk that.
vi.mock('../lib/clerk.js');
vi.mock('../repositories/user.repo.js');
vi.mock('../services/user.service.js');
vi.mock('../services/audit.service.js');

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user_local_1',
    clerkId: 'user_clerk_1',
    email: 'jane@example.com',
    name: 'Jane Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function claims(sub: string): ClerkJwtClaims {
  return { sub } as unknown as ClerkJwtClaims;
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /me', () => {
  it('returns 401 with UNAUTHORIZED when no token is provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(clerk.verifyClerkToken).not.toHaveBeenCalled();
  });

  it('returns 200 with the authenticated user info for a valid token', async () => {
    const user = makeUser();
    vi.mocked(clerk.verifyClerkToken).mockResolvedValue(claims(user.clerkId));
    vi.mocked(userRepo.findByClerkId).mockResolvedValue(user);

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer valid.jwt.token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
    });
  });

  it('returns 401 when the token is invalid or expired', async () => {
    vi.mocked(clerk.verifyClerkToken).mockRejectedValue(new Error('jwt expired'));

    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Bearer expired.jwt.token' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the bearer scheme is malformed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'Token abc' },
    });
    expect(res.statusCode).toBe(401);
    expect(clerk.verifyClerkToken).not.toHaveBeenCalled();
  });
});
