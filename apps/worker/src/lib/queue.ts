import {
  DEFAULT_JOB_OPTIONS as SHARED_DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
  type ParseAssetJob,
  type QueueName,
} from '@atomic-me/shared';
import {
  Queue,
  QueueEvents,
  Worker,
  type ConnectionOptions,
  type Processor,
  type WorkerOptions,
} from 'bullmq';

import { env } from '../config/env.js';

export { QUEUE_NAMES, type QueueName };

/**
 * Map queue name -> payload type. Mo rong khi Phase 7+ them job moi.
 */
export interface QueueJobMap {
  'parse-asset': ParseAssetJob;
  'extract-atoms': { assetId: string; userId: string };
  'embed-atoms': { userId: string; atomIds: string[] };
  'dedup-atoms': { userId: string };
  canonicalize: { userId: string; atomIds: string[] };
  cleanup: { olderThanDays: number };
}

/**
 * Connection options chia se cho tat ca Queue/Worker trong process.
 * Khong tao IORedis instance truc tiep (de tranh xung dot ioredis version voi BullMQ);
 * BullMQ tu tao client tu options. maxRetriesPerRequest=null bat buoc cho consumer.
 */
export function getConnectionOptions(): ConnectionOptions {
  // Parse URL de truyen vao bullmq dang object (BullMQ ho tro url field).
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

/** Default job options ap dung cho moi job add() qua wrapper (re-export tu shared). */
export const DEFAULT_JOB_OPTIONS = SHARED_DEFAULT_JOB_OPTIONS;

/**
 * Wrap BullMQ Queue voi default opts.
 * Producer (API hoac worker khac) goi: `createQueue('parse-asset')`.
 */
export function createQueue<N extends QueueName>(name: N): Queue<QueueJobMap[N], unknown, N> {
  return new Queue<QueueJobMap[N], unknown, N>(name, {
    connection: getConnectionOptions(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

/**
 * Wrap BullMQ Worker voi default opts.
 * processor nhan job typed; co the throw UnrecoverableError de skip retry.
 */
export function createWorker<N extends QueueName>(
  name: N,
  processor: Processor<QueueJobMap[N], unknown, N>,
  opts: Partial<WorkerOptions> = {},
): Worker<QueueJobMap[N], unknown, N> {
  return new Worker<QueueJobMap[N], unknown, N>(name, processor, {
    connection: getConnectionOptions(),
    concurrency: 1,
    // BullMQ tu detect stalled jobs sau lockDuration (mac dinh 30s).
    // Khi stall, BullMQ tu re-enqueue (toi da maxStalledCount = 1 mac dinh).
    ...opts,
  });
}

/** Helper tao QueueEvents (subscribe ket qua); chu yeu dung test/observability. */
export function createQueueEvents(name: QueueName): QueueEvents {
  return new QueueEvents(name, { connection: getConnectionOptions() });
}
