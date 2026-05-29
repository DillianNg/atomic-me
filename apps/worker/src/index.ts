import { prisma } from '@atomic-me/db';

import { logger } from './lib/logger.js';
import { createExtractAtomsWorker } from './workers/extract-atoms.worker.js';
import { createParseAssetWorker } from './workers/parse-asset.worker.js';

/** Loose worker type cho mang chua nhieu BullMQ workers voi generic khac nhau. */
type AnyWorker = {
  name: string;
  isRunning(): boolean;
  close(): Promise<void>;
  on(event: 'ready', cb: () => void): unknown;
};

/**
 * Bootstrap worker process.
 * - Validate env (da chay luc import).
 * - Khoi tao Prisma client (singleton qua @atomic-me/db).
 * - Dang ky tat ca workers (Phase 6: chi parse-asset).
 * - Graceful shutdown: SIGTERM/SIGINT -> worker.close() cho job dang chay xong,
 *   roi prisma.$disconnect.
 *
 * Health: Railway dung TCP probe vao process; "All workers ready" log la signal manual.
 */
async function main(): Promise<void> {
  logger.info('Worker bootstrap starting');

  const workers: AnyWorker[] = [];
  workers.push(createParseAssetWorker(prisma, logger));
  workers.push(createExtractAtomsWorker(prisma, logger));

  // Khi BullMQ worker ready (connect Redis OK + lang nghe), log signal.
  await Promise.all(
    workers.map(
      (w) =>
        new Promise<void>((resolve) => {
          w.on('ready', () => {
            logger.info({ queue: w.name }, 'Worker ready');
            resolve();
          });
          // Khong block neu ready event da xay ra truoc khi listener gan;
          // BullMQ dispatch ngay sau connect, neu listener miss -> isRunning check sau.
          if (w.isRunning()) {
            resolve();
          }
        }),
    ),
  );
  logger.info('All workers ready, processing jobs');

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutdown signal received');

    const forceExit = setTimeout(() => {
      logger.fatal('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 15_000);
    forceExit.unref();

    try {
      // worker.close() cho job dang chay xong + close BullMQ connection (Redis).
      await Promise.all(workers.map((w) => w.close()));
      logger.info('Workers closed');
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

void main();
