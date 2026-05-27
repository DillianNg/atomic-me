import type { FastifyServerOptions } from 'fastify';

import { env } from '../config/env.js';

// Field nhay cam can che giau trong log production.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'authorization',
  'cookie',
];

/**
 * Pino options cho Fastify logger, cau hinh theo NODE_ENV.
 * Development: pino-pretty cho de doc. Production: JSON + redact field nhay cam.
 * Tra ve options de Fastify tu tao logger (khong tao pino instance rieng).
 */
export const loggerOptions: NonNullable<FastifyServerOptions['logger']> =
  env.NODE_ENV === 'development'
    ? {
        level: env.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
        },
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      }
    : {
        level: env.LOG_LEVEL,
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      };
