import type { Queue } from 'bullmq';

import { createQueue, QUEUE_NAMES, type QueueJobMap } from '../lib/queue.js';

/**
 * Controller cho ingest pipeline (parse -> extract -> embed -> dedup -> canonicalize).
 *
 * Phase 6 chi co buoc parse. Cac worker sau (Phase 7+) tu chain: parse-asset
 * enqueue extract-atoms, extract-atoms enqueue embed-atoms, ... O day expose
 * entry point cho producer (API hoac CLI/script) chi bat buoc dau pipeline.
 *
 * jobId = `parse:${assetId}` => BullMQ dedupe khi co nhieu confirm cho cung asset.
 */

let parseQueue: Queue<QueueJobMap['parse-asset'], unknown, 'parse-asset'> | null = null;

/** Lazy singleton queue producer (api / worker dung chung connection options). */
export function getParseAssetQueue(): Queue<
  QueueJobMap['parse-asset'],
  unknown,
  'parse-asset'
> {
  if (!parseQueue) {
    parseQueue = createQueue(QUEUE_NAMES.PARSE_ASSET);
  }
  return parseQueue;
}

/** Dong queue producer khi shutdown. */
export async function closeIngestPipeline(): Promise<void> {
  if (parseQueue) {
    await parseQueue.close();
    parseQueue = null;
  }
}

/**
 * Enqueue dau pipeline ingest: parse asset.
 * jobId la deterministic theo assetId nen confirm 2 lan chi spawn 1 job.
 */
export async function enqueueIngestPipeline(
  assetId: string,
  userId: string,
): Promise<void> {
  const queue = getParseAssetQueue();
  await queue.add(
    QUEUE_NAMES.PARSE_ASSET,
    { assetId, userId },
    { jobId: `parse:${assetId}` },
  );
}
