import { prisma } from '@atomic-me/db';
import fp from 'fastify-plugin';

/**
 * DB plugin: decorate `fastify.db` voi Prisma singleton tu @atomic-me/db.
 * Khong query luc startup (health /ready lo viec do); chi dang ky + dong ket noi onClose.
 */
export default fp(
  async (fastify) => {
    fastify.decorate('db', prisma);

    fastify.addHook('onClose', async (instance) => {
      await instance.db.$disconnect();
    });

    fastify.log.info('DB plugin registered');
  },
  { name: 'db' },
);
