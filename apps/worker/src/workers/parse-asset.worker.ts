import { AssetStatus, type Prisma, type PrismaClient } from '@atomic-me/db';
import { MAX_FILE_SIZE_MB } from '@atomic-me/shared';
import { UnrecoverableError, type Job, type Worker } from 'bullmq';
import type { Logger } from 'pino';

import { logWorkerAudit } from '../lib/audit.js';
import { createWorker, QUEUE_NAMES, type QueueJobMap } from '../lib/queue.js';
import { PermanentError } from '../lib/retry.js';
import { downloadAsset } from '../lib/storage.js';
import { parserRegistry } from '../parsers/index.js';

const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Job processor: parse 1 asset.
 *
 * Workflow:
 * 1. Load asset; missing => PermanentError -> UnrecoverableError (no retry).
 * 2. Status check: PARSED => skip (idempotent). UPLOADED hoac PARSING => continue
 *    (PARSING xay ra khi worker truoc crash, BullMQ pick lai).
 * 3. Update -> PARSING + audit ASSET_PARSING.
 * 4. Download tu R2.
 * 5. parser.parse(); luu parsedText, parsedMetadata, warnings, parsedAt; status PARSED.
 * 6. Audit ASSET_PARSED.
 *
 * Loi:
 * - PermanentError (unsupported file, corrupt PDF, ...) => status FAILED, audit
 *   ASSET_PARSE_FAILED, throw UnrecoverableError (no retry).
 * - Loi khac (R2 5xx, Prisma timeout) => set errorMessage tam, re-throw goc cho
 *   BullMQ retry. Khong set FAILED de tranh ket luan som.
 */
export async function processParseAsset(
  job: Job<QueueJobMap['parse-asset'], unknown, 'parse-asset'>,
  db: PrismaClient,
  log: Logger,
): Promise<void> {
  const { assetId, userId } = job.data;
  const jobLog = log.child({ jobId: job.id, assetId, userId });

  const asset = await db.asset.findFirst({ where: { id: assetId } });
  if (!asset) {
    throw new UnrecoverableError(`Asset ${assetId} not found`);
  }
  if (asset.userId !== userId) {
    throw new UnrecoverableError(
      `Asset ${assetId} userId mismatch (expected ${userId}, got ${asset.userId})`,
    );
  }
  if (asset.status === AssetStatus.PARSED) {
    jobLog.warn('Asset already parsed, skipping');
    return;
  }
  if (
    asset.status !== AssetStatus.UPLOADED &&
    asset.status !== AssetStatus.PARSING
  ) {
    throw new UnrecoverableError(
      `Asset ${assetId} status ${asset.status} not parseable`,
    );
  }

  await db.asset.update({
    where: { id: assetId },
    data: { status: AssetStatus.PARSING, errorMessage: null },
  });
  await logWorkerAudit({
    db,
    log: jobLog,
    action: 'ASSET_PARSING',
    entityId: assetId,
    userId,
  });

  try {
    const buffer = await downloadAsset({ key: asset.storageKey, maxBytes: MAX_BYTES });
    const parser = parserRegistry.getParser(asset.mimeType, asset.originalFilename);
    jobLog.info({ parser: parser.name, bytes: buffer.length }, 'Parsing asset');
    const result = await parser.parse(buffer, asset.originalFilename);

    await db.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.PARSED,
        parsedText: result.text,
        // Cast: parsedMetadata la Json column; metadata la Record<string, unknown>
        // -> safe vi parser khong dat undefined / class instance.
        parsedMetadata: result.metadata as Prisma.InputJsonValue,
        parsedAt: new Date(),
        warnings: result.warnings,
        errorMessage: null,
      },
    });
    await logWorkerAudit({
      db,
      log: jobLog,
      action: 'ASSET_PARSED',
      entityId: assetId,
      userId,
      metadata: {
        parser: parser.name,
        textLength: result.text.length,
        warnings: result.warnings,
      },
    });
    jobLog.info({ parser: parser.name, textLength: result.text.length }, 'Asset parsed');

    // Enqueue extract-atoms (Phase 7 worker). Skip neu trong test (no Redis).
    // Phase 6 chi enqueue; worker chua implement.
    // Lazy import de tranh circular qua queue.
    // Bo qua loi enqueue (parse coi nhu thanh cong roi).
    try {
      const { createQueue, QUEUE_NAMES: NAMES } = await import('../lib/queue.js');
      const queue = createQueue(NAMES.EXTRACT_ATOMS);
      await queue.add(
        NAMES.EXTRACT_ATOMS,
        { assetId, userId },
        {
          jobId: `extract:${assetId}`,
          // Phase 7: extraction retry nhanh hon parse (1s vs 2s base). 3 attempts giu nhu DEFAULT.
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );
      await queue.close();
    } catch (err) {
      jobLog.warn({ err }, 'Failed to enqueue extract-atoms (non-fatal)');
    }
  } catch (err) {
    if (err instanceof PermanentError) {
      const message = err.message;
      await db.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.FAILED, errorMessage: message },
      });
      await logWorkerAudit({
        db,
        log: jobLog,
        action: 'ASSET_PARSE_FAILED',
        entityId: assetId,
        userId,
        metadata: { reason: message, kind: 'permanent' },
      });
      jobLog.error({ err }, 'Asset parse failed (permanent)');
      throw new UnrecoverableError(message);
    }

    // Loi khac: ghi errorMessage tam, KHONG doi status thanh FAILED (de retry).
    await db.asset
      .update({
        where: { id: assetId },
        data: {
          errorMessage:
            err instanceof Error ? err.message : String(err),
        },
      })
      .catch((updateErr) => {
        jobLog.error({ err: updateErr }, 'Failed to record transient errorMessage');
      });
    jobLog.warn({ err }, 'Asset parse failed (transient, will retry)');
    throw err;
  }
}

/**
 * Tao BullMQ Worker cho queue 'parse-asset'.
 * Wire processor + ham close de index.ts close gracefully.
 */
export function createParseAssetWorker(
  db: PrismaClient,
  log: Logger,
): Worker<QueueJobMap['parse-asset'], unknown, 'parse-asset'> {
  return createWorker(QUEUE_NAMES.PARSE_ASSET, async (job) => {
    await processParseAsset(job, db, log);
  });
}
