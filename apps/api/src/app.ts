import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { CONFIG } from './config/constants.js';
import { loggerOptions } from './lib/logger.js';
import authPlugin from './plugins/auth.js';
import dbPlugin from './plugins/db.js';
import errorHandler from './plugins/error-handler.js';
import queuePlugin from './plugins/queue.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import storagePlugin from './plugins/storage.js';
import assetRoutes from './routes/assets/index.js';
import healthRoutes from './routes/health.js';
import userRoutes from './routes/users/me.js';
import clerkWebhookRoutes from './routes/webhooks/clerk.js';

/**
 * Tao Fastify instance da cau hinh day du nhung CHUA listen.
 * Tach khoi server.ts de test co the inject ma khong mo cong that.
 * `opts` cho phep test override (vd logger: false).
 */
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const options: FastifyServerOptions = {
    logger: loggerOptions,
    genReqId: () => randomUUID(),
    bodyLimit: CONFIG.BODY_LIMIT_BYTES,
    requestTimeout: CONFIG.REQUEST_TIMEOUT_MS,
    ...opts,
  };
  const app: FastifyInstance = Fastify(options);

  app.decorateRequest('requestId', '');
  app.addHook('onRequest', async (request) => {
    request.requestId = request.id;
  });

  // Thu tu register: sensible -> error-handler -> db -> auth -> routes.
  // auth (fastify-plugin) decorate `authenticate` + `request.user` len root,
  // nen cac route dang ky sau co the dung lam preHandler.
  await app.register(sensible);
  // CORS: bao boc TAT CA route (vd POST /assets/upload-url tu http://localhost:5173).
  // origin: true => reflect request origin (an toan vi auth thuc te dung Bearer JWT,
  // CORS chi de browser cho phep response qua same-origin policy).
  await app.register(cors, {
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
    maxAge: 600,
  });
  await app.register(errorHandler);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(storagePlugin);
  await app.register(queuePlugin);
  await app.register(rateLimitPlugin);

  await app.register(healthRoutes);
  await app.register(userRoutes);
  await app.register(assetRoutes);
  // Webhook khong dung `authenticate` (verify bang svix signature).
  await app.register(clerkWebhookRoutes);

  return app;
}
