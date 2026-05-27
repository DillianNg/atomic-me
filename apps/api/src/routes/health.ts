import type { FastifyInstance } from 'fastify';

import { APP_VERSION } from '../config/constants.js';

/**
 * Health + readiness routes cho infra check. Khong auth, khong rate limit.
 * - GET /health: liveness, luon 200 neu process song.
 * - GET /ready: readiness, kiem tra DB qua `SELECT 1`, 503 neu DB fail.
 */
export default async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
  });

  fastify.get('/ready', async (_request, reply) => {
    try {
      await fastify.db.$queryRaw`SELECT 1`;
      return { status: 'ready', checks: { db: 'ok' } };
    } catch (err) {
      fastify.log.error({ err }, 'Readiness check failed');
      reply.status(503);
      return { status: 'not_ready', checks: { db: 'fail' } };
    }
  });
}
