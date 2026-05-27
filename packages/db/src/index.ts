import { PrismaClient } from '@prisma/client';

/**
 * Giu mot instance PrismaClient duy nhat qua globalThis.
 * Tranh tao nhieu connection pool khi hot-reload trong dev (Next/tsx watch).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton PrismaClient cho toan bo monorepo.
 * Import: `import { prisma } from '@atomic-me/db'`.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types + enums de consumer khong phai import truc tiep @prisma/client.
export * from '@prisma/client';
