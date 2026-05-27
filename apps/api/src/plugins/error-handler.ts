import type { FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';

import { isAppError } from '../lib/errors.js';

/** Shape error response thong nhat toan API. */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

/**
 * Error handler plugin: chuan hoa moi loi ve mot shape duy nhat.
 * Phan biet AppError, ZodError, FastifyError (4xx), va loi khong luong truoc (500).
 * Cung dat notFound handler (code ROUTE_NOT_FOUND).
 */
export default fp(
  async (fastify) => {
    fastify.setErrorHandler((error: FastifyError, request, reply) => {
      const requestId = request.id;

      if (isAppError(error)) {
        reply.status(error.statusCode);
        const body: ErrorBody = {
          error: { code: error.code, message: error.message, requestId },
        };
        if (error.details !== undefined) {
          body.error.details = error.details;
        }
        return body;
      }

      if (error instanceof ZodError) {
        reply.status(400);
        return {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.flatten(),
            requestId,
          },
        } satisfies ErrorBody;
      }

      // FastifyError giu nguyen statusCode neu la loi client (4xx).
      const statusCode = error.statusCode ?? 500;
      if (statusCode < 500) {
        reply.status(statusCode);
        return {
          error: { code: error.code, message: error.message, requestId },
        } satisfies ErrorBody;
      }

      // Loi khong luong truoc: log full stack, tra generic message.
      request.log.error({ err: error }, 'Unhandled error');
      reply.status(500);
      return {
        error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error', requestId },
      } satisfies ErrorBody;
    });

    fastify.setNotFoundHandler((request, reply) => {
      reply.status(404);
      return {
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found`,
          requestId: request.id,
        },
      } satisfies ErrorBody;
    });
  },
  { name: 'error-handler' },
);
