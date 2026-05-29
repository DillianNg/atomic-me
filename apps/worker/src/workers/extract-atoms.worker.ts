import { AssetStatus, AssetType, type Prisma, type PrismaClient } from '@atomic-me/db';
import { EXTRACTION_COST_CAP_USD, EXTRACTION_MODEL } from '@atomic-me/shared';
import { UnrecoverableError, type Job, type Worker } from 'bullmq';
import type { Logger } from 'pino';

import {
  extractAtomsFromAsset,
  PROMPT_VERSION,
  type ExtractAtomsResult,
} from '../ai/extraction.js';
import type { ExtractionSourceType } from '../ai/prompts/extract-atom.v1.js';
import { logWorkerAudit } from '../lib/audit.js';
import { createWorker, QUEUE_NAMES, type QueueJobMap } from '../lib/queue.js';
import { PermanentError } from '../lib/retry.js';
import * as atomRepo from '../repositories/atom.repo.js';

/**
 * Map Asset.type (Prisma enum) -> ExtractionSourceType (prompt hint).
 * Default 'other' khi khong khop.
 */
function sourceTypeFromAssetType(type: AssetType): ExtractionSourceType {
  switch (type) {
    case AssetType.PDF:
    case AssetType.DOCX:
    case AssetType.TEXT:
      return 'cv';
    case AssetType.LINKEDIN_ARCHIVE:
      return 'linkedin';
    case AssetType.AUDIO:
      return 'voice_note';
    case AssetType.IMAGE:
      return 'certificate';
    default:
      return 'other';
  }
}

/**
 * Detect language tu parsedMetadata neu co; mac dinh 'en'.
 * Phase 7 chua co reliable detect; phụ thuộc LLM tu phat hien.
 */
function detectLanguage(parsedMetadata: unknown): string {
  if (
    parsedMetadata &&
    typeof parsedMetadata === 'object' &&
    'language' in parsedMetadata &&
    typeof (parsedMetadata as { language: unknown }).language === 'string'
  ) {
    return (parsedMetadata as { language: string }).language.slice(0, 2);
  }
  return 'en';
}

/**
 * Estimate cost truoc khi goi Claude. Voi Haiku 4.5 ~ $1/$5 per M:
 *   inputTokens ~ chars / 4
 *   outputTokens uoc luong la inputTokens * 1.5 (extraction nang ve output JSON)
 * Cap luc nay rat conservative; goal: chan CV outlier truoc khi ton tien.
 */
function estimateCostUsd(charCount: number): number {
  const inputTokens = charCount / 4;
  const outputTokens = inputTokens * 1.5;
  const pricing = { inputPerMillion: 1.0, outputPerMillion: 5.0 };
  return (
    (inputTokens * pricing.inputPerMillion) / 1_000_000 +
    (outputTokens * pricing.outputPerMillion) / 1_000_000
  );
}

/**
 * Workflow processor cho 1 job extract-atoms.
 *
 * 1. Load Asset; missing / wrong owner -> UnrecoverableError.
 * 2. Idempotency: COMPLETED skip; EXTRACTING + co Atom -> skip (worker da chay xong
 *    nhung crash truoc khi flip status, tin tuong atomCount); PARSED / EXTRACTING -> tiep.
 * 3. parsedText null / rong -> COMPLETED voi 0 atom, audit ATOMS_CREATED count=0.
 * 4. Status -> EXTRACTING + audit ASSET_EXTRACTING.
 * 5. Estimate cost; vuot cap -> FAILED + UnrecoverableError.
 * 6. Goi extractAtomsFromAsset (chunking + Claude + validation).
 * 7. $transaction: createMany atoms + update Asset { status COMPLETED, atomCount,
 *    extractionCostUsd, extractedAt }. Audit ASSET_EXTRACTED + ATOMS_CREATED.
 *
 * Loi:
 *  - PermanentError -> Asset.status = FAILED, errorMessage, audit ASSET_EXTRACT_FAILED,
 *    throw UnrecoverableError (no retry).
 *  - Khac (Transient) -> errorMessage + re-throw cho BullMQ retry.
 */
export async function processExtractAtoms(
  job: Job<QueueJobMap['extract-atoms'], unknown, 'extract-atoms'>,
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

  if (asset.status === AssetStatus.COMPLETED) {
    jobLog.warn({ atomCount: asset.atomCount }, 'Asset already extracted, skipping');
    return;
  }
  if (
    asset.status === AssetStatus.EXTRACTING &&
    asset.atomCount > 0
  ) {
    jobLog.warn(
      { atomCount: asset.atomCount },
      'Asset EXTRACTING + atomCount>0 (prior run completed work), skipping',
    );
    return;
  }
  if (
    asset.status !== AssetStatus.PARSED &&
    asset.status !== AssetStatus.EXTRACTING
  ) {
    throw new UnrecoverableError(
      `Asset ${assetId} status ${asset.status} not extractable`,
    );
  }

  // parsedText null hoac rong (vd image stub) -> success voi 0 atom.
  if (!asset.parsedText || asset.parsedText.length === 0) {
    await db.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.COMPLETED,
        extractedAt: new Date(),
        atomCount: 0,
        extractionCostUsd: 0,
        errorMessage: null,
      },
    });
    await logWorkerAudit({
      db,
      log: jobLog,
      action: 'ATOMS_CREATED',
      entityId: assetId,
      userId,
      metadata: { count: 0, reason: 'no parsed text' },
    });
    jobLog.info('Asset has no parsedText, completed with 0 atoms');
    return;
  }

  // Status -> EXTRACTING.
  await db.asset.update({
    where: { id: assetId },
    data: { status: AssetStatus.EXTRACTING, errorMessage: null },
  });
  await logWorkerAudit({
    db,
    log: jobLog,
    action: 'ASSET_EXTRACTING',
    entityId: assetId,
    userId,
  });

  // Cost gate truoc khi call Claude.
  const estimatedCost = estimateCostUsd(asset.parsedText.length);
  if (estimatedCost > EXTRACTION_COST_CAP_USD) {
    const msg = `Estimated cost ${estimatedCost.toFixed(4)} USD exceeds cap ${EXTRACTION_COST_CAP_USD}`;
    await db.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.FAILED, errorMessage: msg },
    });
    await logWorkerAudit({
      db,
      log: jobLog,
      action: 'ASSET_EXTRACT_FAILED',
      entityId: assetId,
      userId,
      metadata: { reason: msg, estimatedCost },
    });
    throw new UnrecoverableError(msg);
  }

  let result: ExtractAtomsResult;
  try {
    result = await extractAtomsFromAsset({
      assetId,
      userId,
      parsedText: asset.parsedText,
      sourceType: sourceTypeFromAssetType(asset.type),
      language: detectLanguage(asset.parsedMetadata),
      log: jobLog,
    });
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
        action: 'ASSET_EXTRACT_FAILED',
        entityId: assetId,
        userId,
        metadata: { reason: message, kind: 'permanent' },
      });
      jobLog.error({ err }, 'Extraction permanent failure');
      throw new UnrecoverableError(message);
    }
    // Transient: ghi errorMessage, leave status EXTRACTING (resume), re-throw.
    await db.asset
      .update({
        where: { id: assetId },
        data: {
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch((updateErr) => {
        jobLog.error({ err: updateErr }, 'Failed to record transient errorMessage');
      });
    jobLog.warn({ err }, 'Extraction transient failure, will retry');
    throw err;
  }

  // Persist atoms + flip status COMPLETED trong 1 transaction.
  await db.$transaction(async (tx) => {
    await atomRepo.createMany(tx, userId, result.atoms, PROMPT_VERSION);
    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.COMPLETED,
        atomCount: result.atoms.length,
        extractionCostUsd: result.totalCostUsd,
        extractedAt: new Date(),
        errorMessage: null,
      },
    });
  });

  const auditMetadata: Prisma.InputJsonValue = {
    atomCount: result.atoms.length,
    rejectedCount: result.rejectedCount,
    chunkCount: result.chunkCount,
    inputCharCount: result.inputCharCount,
    sourceLanguage: result.sourceLanguage,
    costUsd: result.totalCostUsd,
    promptVersion: PROMPT_VERSION,
    model: EXTRACTION_MODEL,
  };
  await logWorkerAudit({
    db,
    log: jobLog,
    action: 'ASSET_EXTRACTED',
    entityId: assetId,
    userId,
    metadata: auditMetadata,
  });
  await logWorkerAudit({
    db,
    log: jobLog,
    action: 'ATOMS_CREATED',
    entityId: assetId,
    userId,
    metadata: { count: result.atoms.length, promptVersion: PROMPT_VERSION },
  });

  jobLog.info(
    {
      atomCount: result.atoms.length,
      rejected: result.rejectedCount,
      chunks: result.chunkCount,
      costUsd: result.totalCostUsd,
      language: result.sourceLanguage,
    },
    'extract-atoms.done',
  );
}

export function createExtractAtomsWorker(
  db: PrismaClient,
  log: Logger,
): Worker<QueueJobMap['extract-atoms'], unknown, 'extract-atoms'> {
  return createWorker(
    QUEUE_NAMES.EXTRACT_ATOMS,
    async (job) => {
      await processExtractAtoms(job, db, log);
    },
    { concurrency: 3 },
  );
}
