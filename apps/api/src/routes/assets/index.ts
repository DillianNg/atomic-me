import type { FastifyInstance } from 'fastify';

import { postConfirm, postUploadUrl } from './handlers.js';

/**
 * Route assets/* (Phase 5 upload pipeline).
 * Moi route deu yeu cau authenticate + rateLimitPerUser (preHandler).
 * - POST /assets/upload-url : tao Asset (PENDING) + presigned PUT URL.
 * - POST /assets/confirm    : doi PENDING -> UPLOADED, ghi audit log.
 */
export default async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/assets/upload-url',
    { preHandler: [fastify.authenticate, fastify.rateLimitPerUser] },
    postUploadUrl,
  );
  fastify.post(
    '/assets/confirm',
    { preHandler: [fastify.authenticate, fastify.rateLimitPerUser] },
    postConfirm,
  );
}
