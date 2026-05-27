import { CreditReason, Prisma, type PrismaClient, type User } from '@atomic-me/db';
import { SIGNUP_BONUS } from '@atomic-me/shared';
import type { FastifyBaseLogger } from 'fastify';

import * as userRepo from '../repositories/user.repo.js';

import { logAudit } from './audit.service.js';

export interface ProvisionUserInput {
  db: PrismaClient;
  log: FastifyBaseLogger;
  clerkId: string;
  email: string;
  name?: string | null;
  /** Nguon tao user, chi de ghi audit metadata (khong PII). */
  source: 'webhook' | 'lazy';
}

/**
 * Dam bao user ton tai trong DB local (idempotent).
 *
 * - Da co (theo clerkId) -> tra ve nguyen trang, KHONG grant lai credit.
 * - Chua co -> tao User + CreditBalance(SIGNUP_BONUS) + CreditTransaction
 *   trong MOT $transaction, roi ghi audit USER_CREATED.
 * - Race condition (2 request cung tao) -> bat unique violation (P2002),
 *   coi nhu da ton tai va tra ve record hien co.
 *
 * Dung chung boi webhook `user.created` va lazy-create trong auth plugin.
 */
export async function provisionUser(input: ProvisionUserInput): Promise<User> {
  const existing = await userRepo.findByClerkId(input.db, input.clerkId);
  if (existing) return existing;

  let user: User;
  try {
    user = await input.db.$transaction(async (tx) => {
      const created = await userRepo.create(tx, {
        clerkId: input.clerkId,
        email: input.email,
        name: input.name ?? null,
      });
      await tx.creditBalance.create({
        data: { userId: created.id, balance: SIGNUP_BONUS, lifetimeEarned: SIGNUP_BONUS },
      });
      await tx.creditTransaction.create({
        data: {
          userId: created.id,
          amount: SIGNUP_BONUS,
          reason: CreditReason.SIGNUP_BONUS,
          balanceAfter: SIGNUP_BONUS,
        },
      });
      return created;
    });
  } catch (err) {
    // Unique violation -> user da duoc tao boi request song song. Idempotent.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await userRepo.findByClerkId(input.db, input.clerkId);
      if (raced) return raced;
    }
    throw err;
  }

  await logAudit({
    db: input.db,
    log: input.log,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    userId: user.id,
    metadata: { source: input.source },
  });

  return user;
}
