import { createLoggerOptions } from '@atomic-me/shared';
import type { FastifyServerOptions } from 'fastify';

import { env } from '../config/env.js';

/**
 * Pino options cho Fastify logger.
 * Cau hinh chia se tu @atomic-me/shared (cung dung trong apps/worker).
 * Cast sang Fastify's logger config type vi shared khong import fastify.
 */
export const loggerOptions: NonNullable<FastifyServerOptions['logger']> = createLoggerOptions({
  nodeEnv: env.NODE_ENV,
  level: env.LOG_LEVEL,
}) as NonNullable<FastifyServerOptions['logger']>;
