import type { PrismaClient } from '@atomic-me/db';

// Module augmentation cho Fastify v5.
declare module 'fastify' {
  interface FastifyInstance {
    /** Prisma client singleton, decorate boi plugins/db.ts. */
    db: PrismaClient;
  }

  interface FastifyRequest {
    /** Request id (uuid v4), gan trong onRequest hook o app.ts. */
    requestId: string;
    /** User da xac thuc. Optional o Phase 2, se fill boi auth plugin o Phase 3. */
    user?: {
      id: string;
      clerkId: string;
    };
  }
}
