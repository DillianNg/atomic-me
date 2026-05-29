import { createLoggerOptions } from '@atomic-me/shared';
import pino, { type Logger } from 'pino';

import { env } from '../config/env.js';

/**
 * Root pino logger cho worker process.
 * Dung cau hinh chia se voi apps/api (level + redact + pretty transport).
 * Module-level: tao 1 lan, child() de them context cho moi job.
 */
export const logger: Logger = pino(createLoggerOptions({
  nodeEnv: env.NODE_ENV,
  level: env.LOG_LEVEL,
}));
