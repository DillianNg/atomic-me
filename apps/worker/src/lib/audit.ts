import type { Prisma, PrismaClient } from '@atomic-me/db';
import type { Logger } from 'pino';

/**
 * Audit log helper cho worker.
 * Khac apps/api: khong co req context (ipAddress / userAgent) -> bo qua field do.
 * Fire-and-forget: log loi qua pino, khong throw.
 */
export type WorkerAuditAction =
  | 'ASSET_PARSING'
  | 'ASSET_PARSED'
  | 'ASSET_PARSE_FAILED';

export interface WorkerAuditInput {
  db: PrismaClient | Prisma.TransactionClient;
  log: Logger;
  action: WorkerAuditAction;
  entityId: string;
  userId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function logWorkerAudit(input: WorkerAuditInput): Promise<void> {
  try {
    await input.db.auditLog.create({
      data: {
        action: input.action,
        entityType: 'Asset',
        entityId: input.entityId,
        userId: input.userId ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  } catch (err) {
    input.log.error({ err, action: input.action }, 'Failed to write audit log');
  }
}
