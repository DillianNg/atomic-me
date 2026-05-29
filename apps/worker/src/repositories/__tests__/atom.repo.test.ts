import { AtomKind, type PrismaClient } from '@atomic-me/db';
import type { AtomCreateInput } from '@atomic-me/shared';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import * as atomRepo from '../atom.repo.js';

interface FakeDb {
  atom: {
    createMany: Mock;
    findMany: Mock;
    findFirst: Mock;
    update: Mock;
    delete: Mock;
    count: Mock;
  };
}

function makeDb(): FakeDb {
  return {
    atom: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

function makeAtomInput(overrides: Partial<AtomCreateInput> = {}): AtomCreateInput {
  return {
    userId: 'user_1',
    assetId: 'asset_1',
    kind: 'SKILL',
    content: { kind: 'SKILL', name: 'Python' },
    evidenceSpan: { assetId: 'asset_1', startOffset: 0, endOffset: 6, snippet: 'Python' },
    confidence: 0.95,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMany', () => {
  it('returns count 0 for empty input without calling Prisma', async () => {
    const db = makeDb();
    const out = await atomRepo.createMany(db as unknown as PrismaClient, 'user_1', [], 'v1');
    expect(out).toEqual({ count: 0 });
    expect(db.atom.createMany).not.toHaveBeenCalled();
  });

  it('threads promptVersion into every atom row', async () => {
    const db = makeDb();
    db.atom.createMany.mockResolvedValue({ count: 2 });
    await atomRepo.createMany(
      db as unknown as PrismaClient,
      'user_1',
      [makeAtomInput(), makeAtomInput({ kind: 'EXPERIENCE', content: { kind: 'EXPERIENCE', company: 'Acme', title: 'X', startDate: '2020', endDate: 'present', description: 'd' } })],
      'extract-atom@v1.0.0',
    );
    const call = db.atom.createMany.mock.calls[0]?.[0] as { data: Array<{ promptVersion: string; userId: string }> };
    expect(call.data.length).toBe(2);
    expect(call.data[0]?.promptVersion).toBe('extract-atom@v1.0.0');
    expect(call.data[1]?.promptVersion).toBe('extract-atom@v1.0.0');
  });

  it('throws when an atom userId does not match the arg userId', async () => {
    const db = makeDb();
    await expect(
      atomRepo.createMany(
        db as unknown as PrismaClient,
        'user_1',
        [makeAtomInput({ userId: 'other_user' })],
        'v1',
      ),
    ).rejects.toThrow(/userId mismatch/);
    expect(db.atom.createMany).not.toHaveBeenCalled();
  });
});

describe('findByUserId', () => {
  it('always WHERE userId; supports kind filter + paging', async () => {
    const db = makeDb();
    await atomRepo.findByUserId(db as unknown as PrismaClient, 'user_1', {
      kind: AtomKind.SKILL,
      limit: 10,
      offset: 20,
    });
    const args = db.atom.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      take: number;
      skip: number;
    };
    expect(args.where['userId']).toBe('user_1');
    expect(args.where['kind']).toBe('SKILL');
    expect(args.take).toBe(10);
    expect(args.skip).toBe(20);
  });
});

describe('findById', () => {
  it('uses findFirst with id + userId so cross-tenant reads fail', async () => {
    const db = makeDb();
    await atomRepo.findById(db as unknown as PrismaClient, 'atom_1', 'user_1');
    const where = db.atom.findFirst.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where).toEqual({ id: 'atom_1', userId: 'user_1' });
  });
});

describe('updateById', () => {
  it('asserts ownership before update', async () => {
    const db = makeDb();
    db.atom.findFirst.mockResolvedValue({ id: 'atom_1' });
    db.atom.update.mockResolvedValue({ id: 'atom_1', isVerified: true });
    const out = await atomRepo.updateById(
      db as unknown as PrismaClient,
      'atom_1',
      'user_1',
      { isVerified: true },
    );
    expect(out.id).toBe('atom_1');
    expect(db.atom.findFirst).toHaveBeenCalledTimes(1);
    expect(db.atom.update).toHaveBeenCalledWith({
      where: { id: 'atom_1' },
      data: { isVerified: true },
    });
  });

  it('throws when atom does not belong to user (no update issued)', async () => {
    const db = makeDb();
    db.atom.findFirst.mockResolvedValue(null);
    await expect(
      atomRepo.updateById(db as unknown as PrismaClient, 'atom_1', 'someone_else', {
        isVerified: true,
      }),
    ).rejects.toThrow(/not found/);
    expect(db.atom.update).not.toHaveBeenCalled();
  });
});

describe('deleteById', () => {
  it('asserts ownership before delete', async () => {
    const db = makeDb();
    db.atom.findFirst.mockResolvedValue({ id: 'atom_1' });
    await atomRepo.deleteById(db as unknown as PrismaClient, 'atom_1', 'user_1');
    expect(db.atom.delete).toHaveBeenCalledWith({ where: { id: 'atom_1' } });
  });

  it('throws and does not delete when ownership check fails', async () => {
    const db = makeDb();
    db.atom.findFirst.mockResolvedValue(null);
    await expect(
      atomRepo.deleteById(db as unknown as PrismaClient, 'atom_1', 'someone_else'),
    ).rejects.toThrow(/not found/);
    expect(db.atom.delete).not.toHaveBeenCalled();
  });
});

describe('countByUserId', () => {
  it('filters by userId', async () => {
    const db = makeDb();
    db.atom.count.mockResolvedValue(7);
    const n = await atomRepo.countByUserId(db as unknown as PrismaClient, 'user_1');
    expect(n).toBe(7);
    expect(db.atom.count.mock.calls[0]?.[0]).toEqual({ where: { userId: 'user_1' } });
  });
});
