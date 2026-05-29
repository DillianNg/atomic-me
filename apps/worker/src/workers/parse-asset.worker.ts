import type { PrismaClient } from '@atomic-me/db';
import type { Logger } from 'pino';

import { createWorker, QUEUE_NAMES } from '../lib/queue.js';

/**
 * Placeholder for the parse-asset worker.
 * Phase 6.9 will fill the workflow (download R2, parser registry, status update).
 * Khai bao truoc de index.ts wire len + de queue lib type-check.
 */
export function createParseAssetWorker(_db: PrismaClient, log: Logger) {
  return createWorker(QUEUE_NAMES.PARSE_ASSET, async (job) => {
    log.warn({ jobId: job.id, data: job.data }, 'parse-asset worker not implemented yet');
  });
}
