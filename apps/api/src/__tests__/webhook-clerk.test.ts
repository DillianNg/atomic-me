import type { User } from '@atomic-me/db';
import type { FastifyInstance } from 'fastify';
import { Webhook } from 'svix';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import * as userRepo from '../repositories/user.repo.js';
import { provisionUser } from '../services/user.service.js';

// Mock DB/service layer. KHONG mock svix/env: chu ky webhook duoc verify that.
vi.mock('../repositories/user.repo.js');
vi.mock('../services/user.service.js');
vi.mock('../services/audit.service.js');

// Phai trung CLERK_WEBHOOK_SECRET trong vitest.config.ts.
const WEBHOOK_SECRET = 'whsec_dGVzdHNlY3JldHRlc3RzZWNyZXQ=';

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

/** Tao header svix hop le bang cach ky payload voi secret test. */
function signedHeaders(payload: string): Record<string, string> {
  const wh = new Webhook(WEBHOOK_SECRET);
  const msgId = `msg_${Math.random().toString(36).slice(2)}`;
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, payload);
  return {
    'content-type': 'application/json',
    'svix-id': msgId,
    'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
    'svix-signature': signature,
  };
}

const userCreatedEvent = (clerkId: string) =>
  JSON.stringify({
    type: 'user.created',
    data: {
      id: clerkId,
      email_addresses: [{ id: 'idn_1', email_address: 'jane@example.com' }],
      primary_email_address_id: 'idn_1',
      first_name: 'Jane',
      last_name: 'Doe',
    },
  });

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

describe('POST /webhooks/clerk', () => {
  it('returns 400 when svix headers are missing', async () => {
    const body = userCreatedEvent('user_clerk_1');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when the signature is invalid', async () => {
    const body = userCreatedEvent('user_clerk_1');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_x',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,not-a-real-signature',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('UNAUTHORIZED');
  });

  it('provisions a user on a valid user.created event', async () => {
    vi.mocked(userRepo.findByClerkId).mockResolvedValue(null);
    vi.mocked(provisionUser).mockResolvedValue(makeUser());

    const body = userCreatedEvent('user_clerk_1');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: signedHeaders(body),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(provisionUser).toHaveBeenCalledTimes(1);
    expect(vi.mocked(provisionUser).mock.calls[0]?.[0]).toMatchObject({
      clerkId: 'user_clerk_1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      source: 'webhook',
    });
  });

  it('is idempotent: a repeated user.created creates the user only once', async () => {
    vi.mocked(userRepo.findByClerkId)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeUser());
    vi.mocked(provisionUser).mockResolvedValue(makeUser());
    vi.mocked(userRepo.update).mockResolvedValue(makeUser());

    const body = userCreatedEvent('user_clerk_1');
    const first = await app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: signedHeaders(body),
      payload: body,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: signedHeaders(body),
      payload: body,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(provisionUser).toHaveBeenCalledTimes(1);
  });

  it('soft-deletes a user on user.deleted', async () => {
    vi.mocked(userRepo.findByClerkId).mockResolvedValue(makeUser());
    vi.mocked(userRepo.softDelete).mockResolvedValue(makeUser({ deletedAt: new Date() }));

    const body = JSON.stringify({
      type: 'user.deleted',
      data: { id: 'user_clerk_1', deleted: true },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/clerk',
      headers: signedHeaders(body),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(userRepo.softDelete).toHaveBeenCalledWith(expect.anything(), 'user_clerk_1');
  });
});
