import type { PrismaClient } from '@atomic-me/db';
import type { preHandlerHookHandler } from 'fastify';

// Module augmentation cho Fastify v5.
declare module 'fastify' {
  interface FastifyInstance {
    /** Prisma client singleton, decorate boi plugins/db.ts. */
    db: PrismaClient;
    /**
     * preHandler bao ve route: verify Clerk JWT tu header Authorization,
     * lazy-create user neu can, gan request.user. Throw UnauthorizedError neu fail.
     */
    authenticate: preHandlerHookHandler;
  }

  interface FastifyRequest {
    /** Request id (uuid v4), gan trong onRequest hook o app.ts. */
    requestId: string;
    /**
     * User da xac thuc. null neu route khong di qua `authenticate`
     * (decorate mac dinh null boi plugins/auth.ts).
     */
    user: { id: string; clerkId: string; email: string } | null;
  }
}
