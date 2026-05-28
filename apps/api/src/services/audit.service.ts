import type { Prisma, PrismaClient } from '@atomic-me/db';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Audit service (ban toi thieu cho Phase 3 auth).
 *
 * Map sang model AuditLog co san (Phase 1):
 *   action     <- loai su kien (AuditAction)
 *   entityType <- loai doi tuong, vd 'User' | 'Auth'
 *   entityId   <- id doi tuong (BAT BUOC: schema la String)
 *   userId     <- id user noi bo (null cho su kien he thong / chua xac dinh)
 *   metadata   <- du lieu phu, KHONG chua secret / PII nhay cam (email, token)
 *
 * Quy tac: fire-and-forget. logAudit() KHONG BAO GIO throw -> khong lam
 * fail request chinh; loi ghi log duoc nuot va log lai qua logger.
 */
export type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'AUTH_FAILED'
  | 'ASSET_UPLOADED';

export interface AuditInput {
  db: PrismaClient | Prisma.TransactionClient;
  log: FastifyBaseLogger;
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Ghi mot dong audit log. Nuot loi (chi log lai), khong throw. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await input.db.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    input.log.error({ err, action: input.action }, 'Failed to write audit log');
  }
}
