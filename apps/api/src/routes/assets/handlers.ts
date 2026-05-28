import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  confirmUpload,
  requestUploadUrl,
  type ConfirmUploadResult,
  type RequestUploadUrlResult,
} from '../../services/asset.service.js';

import {
  confirmUploadRequestSchema,
  uploadUrlRequestSchema,
  type ConfirmUploadResponse,
  type UploadUrlResponse,
} from './schema.js';

/**
 * Handlers cho /assets/*. Auth + rate-limit gan o `index.ts` qua preHandler,
 * nen tai day request.user chac chan da co (typed `{ id, clerkId, email }`).
 */

export async function postUploadUrl(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<UploadUrlResponse> {
  const user = request.user;
  if (!user) {
    // Khong xay ra do authenticate da check, nhung TS guard.
    throw new Error('Missing authenticated user');
  }
  const body = uploadUrlRequestSchema.parse(request.body);

  const result: RequestUploadUrlResult = await requestUploadUrl({
    db: request.server.db,
    storage: request.server.storage,
    log: request.log,
    userId: user.id,
    body,
  });

  return result;
}

export async function postConfirm(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<ConfirmUploadResponse> {
  const user = request.user;
  if (!user) {
    throw new Error('Missing authenticated user');
  }
  const body = confirmUploadRequestSchema.parse(request.body);

  const result: ConfirmUploadResult = await confirmUpload({
    db: request.server.db,
    log: request.log,
    userId: user.id,
    assetId: body.assetId,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] ?? null,
  });

  return result;
}
