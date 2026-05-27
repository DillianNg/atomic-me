import type { PrismaClient } from '@atomic-me/db';
import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logAudit } from '../services/audit.service.js';

function makeDb() {
  return { auditLog: { create: vi.fn() } };
}
function makeLog() {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
}

let db: ReturnType<typeof makeDb>;
let log: ReturnType<typeof makeLog>;

beforeEach(() => {
  db = makeDb();
  log = makeLog();
});

describe('audit.service logAudit', () => {
  it('writes a row mapping action/entityType/entityId/userId', async () => {
    db.auditLog.create.mockResolvedValue({});
    await logAudit({
      db: db as unknown as PrismaClient,
      log: log as unknown as FastifyBaseLogger,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: 'user_1',
      userId: 'user_1',
      metadata: { source: 'webhook' },
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    const arg = db.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data).toMatchObject({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: 'user_1',
      userId: 'user_1',
      metadata: { source: 'webhook' },
    });
  });

  it('defaults userId to null when omitted (system event)', async () => {
    db.auditLog.create.mockResolvedValue({});
    await logAudit({
      db: db as unknown as PrismaClient,
      log: log as unknown as FastifyBaseLogger,
      action: 'AUTH_FAILED',
      entityType: 'Auth',
      entityId: 'unknown',
    });
    const arg = db.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data.userId).toBeNull();
  });

  it('never throws: swallows db error and logs it', async () => {
    db.auditLog.create.mockRejectedValue(new Error('db down'));
    await expect(
      logAudit({
        db: db as unknown as PrismaClient,
        log: log as unknown as FastifyBaseLogger,
        action: 'USER_DELETED',
        entityType: 'User',
        entityId: 'user_1',
      }),
    ).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
