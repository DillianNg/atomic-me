import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns 200 with the expected shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      status: string;
      uptime: number;
      timestamp: string;
      version: string;
    }>();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.version).toBe('string');
  });
});

describe('GET /ready', () => {
  // Stub DB de test khong phu thuoc Postgres that (CI khong co DB).
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with db ok when the database is reachable', async () => {
    vi.spyOn(app.db, '$queryRaw').mockResolvedValue([{ result: 1 }]);
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', checks: { db: 'ok' } });
  });

  it('returns 503 with db fail when the database is unreachable', async () => {
    vi.spyOn(app.db, '$queryRaw').mockRejectedValue(new Error('connection refused'));
    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'not_ready', checks: { db: 'fail' } });
  });
});

describe('not found', () => {
  it('returns 404 with the standard error shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/no-such-route' });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ error: { code: string; message: string; requestId: string } }>();
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(typeof body.error.requestId).toBe('string');
  });
});
