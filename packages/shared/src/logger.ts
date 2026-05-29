/**
 * Cau hinh pino dung chung giua apps/api va apps/worker.
 *
 * Tach khoi framework (khong import fastify, khong import pino) de
 * package @atomic-me/shared khong keo dependency nang.
 *
 * Consumer:
 *  - apps/api truyen vao FastifyServerOptions['logger'] (Fastify tu tao pino).
 *  - apps/worker truyen vao pino() factory truc tiep.
 *
 * Quy tac:
 *  - Production: JSON output, redact field nhay cam.
 *  - Development: pino-pretty cho de doc, van redact.
 *  - Field 'silent' duoc support de unit test khong noise.
 */

/** Cac path can che giau trong log (Bearer token, cookie, password,...). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'token',
  'authorization',
  'cookie',
] as const;

/** Log level pino ho tro. */
export type PinoLevel =
  | 'fatal'
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'trace'
  | 'silent';

export interface CreateLoggerOptionsInput {
  /** NODE_ENV. 'development' bat pretty transport. */
  nodeEnv: string;
  /** Pino log level. */
  level: PinoLevel;
}

/**
 * Output type that satisfies pino LoggerOptions and Fastify's logger config.
 * Khong de tat ca optional bat buoc; transport chi co o development.
 */
export interface SharedLoggerOptions {
  level: PinoLevel;
  redact: { paths: string[]; censor: string };
  transport?: { target: string; options: Record<string, unknown> };
}

/**
 * Tao logger options chuan, dung lai duoc o moi process.
 * Khong cache (test co the goi nhieu lan voi cfg khac nhau).
 */
export function createLoggerOptions(cfg: CreateLoggerOptionsInput): SharedLoggerOptions {
  // Copy paths to a mutable array (pino's redact options require string[], not readonly).
  const base: SharedLoggerOptions = {
    level: cfg.level,
    redact: { paths: [...LOG_REDACT_PATHS], censor: '[REDACTED]' },
  };
  if (cfg.nodeEnv === 'development') {
    return {
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    };
  }
  return base;
}
