import type { FastifyInstance } from 'fastify';

/**
 * Route user. GET /me: protected, tra ve user da xac thuc tu request.user.
 * Dung de test flow auth end-to-end (token -> backend -> user info).
 */
export default async function userRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
    // Sau `authenticate`, request.user chac chan da duoc gan (khac null).
    return request.user;
  });
}
