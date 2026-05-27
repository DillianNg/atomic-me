import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { NotFoundError, ValidationError } from '../lib/errors.js';
import errorHandler from '../plugins/error-handler.js';

let app: FastifyInstance;

interface ErrorResponse {
  error: { code: string; message: string; details?: unknown; requestId: string };
}

beforeEach(async () => {
  app = Fastify({ logger: false });
  await app.register(errorHandler);

  app.get('/app-error', async () => {
    throw new NotFoundError('atom missing', { atomId: 'abc' });
  });
  app.get('/validation', async () => {
    throw new ValidationError('bad input', { field: 'email' });
  });
  app.get('/zod', async () => {
    z.object({ a: z.string() }).parse({ a: 1 });
    return 'unreachable';
  });
  app.get('/fastify-error', async () => {
    throw Object.assign(new Error('bad request'), { statusCode: 400, code: 'FST_ERR_BAD' });
  });
  app.get('/boom', async () => {
    throw new Error('kaboom');
  });

  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('error handler', () => {
  it('maps AppError to its statusCode, code, and details', async () => {
    const res = await app.inject({ method: 'GET', url: '/app-error' });
    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('atom missing');
    expect(body.error.details).toEqual({ atomId: 'abc' });
    expect(typeof body.error.requestId).toBe('string');
  });

  it('maps ValidationError to 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/validation' });
    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual({ field: 'email' });
  });

  it('maps a ZodError to 400 with flattened issues', async () => {
    const res = await app.inject({ method: 'GET', url: '/zod' });
    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeTruthy();
  });

  it('preserves a 4xx FastifyError statusCode and code', async () => {
    const res = await app.inject({ method: 'GET', url: '/fastify-error' });
    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('FST_ERR_BAD');
  });

  it('maps an unexpected error to a generic 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal Server Error');
  });

  it('returns the standard shape for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
