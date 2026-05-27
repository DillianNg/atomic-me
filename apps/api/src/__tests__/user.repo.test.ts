import type { PrismaClient } from '@atomic-me/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as userRepo from '../repositories/user.repo.js';

// Fake Prisma: chi can cac method userRepo dung. Repo thuan delegate nen
// ta chi assert no goi dung method + args.
function makeDb() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

let db: ReturnType<typeof makeDb>;

beforeEach(() => {
  db = makeDb();
});

describe('user.repo', () => {
  it('findByClerkId queries by clerkId', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await userRepo.findByClerkId(db as unknown as PrismaClient, 'clerk_1');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { clerkId: 'clerk_1' } });
  });

  it('findById queries by id', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await userRepo.findById(db as unknown as PrismaClient, 'id_1');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: 'id_1' } });
  });

  it('create maps input to data, defaulting name to null', async () => {
    db.user.create.mockResolvedValue({});
    await userRepo.create(db as unknown as PrismaClient, {
      clerkId: 'clerk_1',
      email: 'a@b.com',
    });
    expect(db.user.create).toHaveBeenCalledWith({
      data: { clerkId: 'clerk_1', email: 'a@b.com', name: null },
    });
  });

  it('update only includes provided fields', async () => {
    db.user.update.mockResolvedValue({});
    await userRepo.update(db as unknown as PrismaClient, 'clerk_1', { name: 'New Name' });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_1' },
      data: { name: 'New Name' },
    });
  });

  it('softDelete sets deletedAt', async () => {
    db.user.update.mockResolvedValue({});
    await userRepo.softDelete(db as unknown as PrismaClient, 'clerk_1');
    const call = db.user.update.mock.calls[0]?.[0] as {
      where: { clerkId: string };
      data: { deletedAt: Date };
    };
    expect(call.where).toEqual({ clerkId: 'clerk_1' });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });
});
