import { randomUUID } from 'node:crypto';

import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { CONFIG } from './config/constants.js';
import { loggerOptions } from './lib/logger.js';
import dbPlugin from './plugins/db.js';
import errorHandler from './plugins/error-handler.js';
import healthRoutes from './routes/health.js';

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

  // Thu tu register: sensible -> error-handler -> db -> routes.
  await app.register(sensible);
  await app.register(errorHandler);
  await app.register(dbPlugin);
  await app.register(healthRoutes);

  return app;
}
