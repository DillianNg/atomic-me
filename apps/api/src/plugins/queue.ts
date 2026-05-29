import {
  DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
  type ParseAssetJob,
} from '@atomic-me/shared';
import { Queue, type ConnectionOptions } from 'bullmq';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';

/**
 * Queue plugin (Phase 6).
 * Decorate `fastify.queue` voi producer BullMQ.
 * Phase 6 chi expose `parseAsset`; Phase 7+ them queue khac neu API can enqueue.
 *
 * Connection options khop voi worker (xem apps/worker/src/lib/queue.ts):
 * Tao Redis instance ngam qua BullMQ, khong share IORedis voi route khac.
 */

export interface ApiQueueRegistry {
  /** Producer cho 'parse-asset': worker se download R2 + parser. */
  parseAsset: Queue<ParseAssetJob, unknown, 'parse-asset'>;
}

declare module 'fastify' {
  interface FastifyInstance {
    queue: ApiQueueRegistry;
  }
}

function buildConnectionOptions(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: url.username } : {}),
    ...(url.password ? { password: url.password } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export default fp(
  async (fastify) => {
    const connection = buildConnectionOptions();
    const parseAsset = new Queue<ParseAssetJob, unknown, 'parse-asset'>(
      QUEUE_NAMES.PARSE_ASSET,
      { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS },
    );

    parseAsset.on('error', (err) => {
      fastify.log.error({ err, queue: QUEUE_NAMES.PARSE_ASSET }, 'BullMQ queue error');
    });

    fastify.decorate('queue', { parseAsset });

    fastify.addHook('onClose', async () => {
      await parseAsset.close();
    });
  },
  { name: 'queue' },
);
