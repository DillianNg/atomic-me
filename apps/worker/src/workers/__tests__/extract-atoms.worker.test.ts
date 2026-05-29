import { AssetStatus, AssetType } from '@atomic-me/db';
import { UnrecoverableError } from 'bullmq';
import type { Logger } from 'pino';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Mock extraction so we don't touch Anthropic SDK in unit test.
vi.mock('../../ai/extraction.js', () => ({
  PROMPT_VERSION: 'extract-atom@v1.0.0',
  extractAtomsFromAsset: vi.fn(),
}));

// Mock atom repo: capture the calls but allow real call shape inspection.
vi.mock('../../repositories/atom.repo.js', () => ({
  createMany: vi.fn().mockResolvedValue({ count: 0 }),
}));

import { extractAtomsFromAsset } from '../../ai/extraction.js';
import { PermanentError } from '../../lib/retry.js';
import * as atomRepo from '../../repositories/atom.repo.js';
import { processExtractAtoms } from '../extract-atoms.worker.js';

const extractMock = extractAtomsFromAsset as unknown as Mock;
const createManyMock = atomRepo.createMany as unknown as Mock;

function makeLog(): Logger {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child() {
      return log;
    },
  };
  return log as unknown as Logger;
}

interface FakeAsset {
  id: string;
  userId: string;
  type: AssetType;
  status: AssetStatus;
  parsedText: string | null;
  parsedMetadata: unknown;
  atomCount: number;
  extractionCostUsd: number | null;
  extractedAt: Date | null;
  errorMessage: string | null;
}

function makeAsset(overrides: Partial<FakeAsset> = {}): FakeAsset {
  return {
    id: 'asset_1',
    userId: 'user_1',
    type: AssetType.PDF,
    status: AssetStatus.PARSED,
    parsedText: 'Jane Doe CV. Skill: Python.',
    parsedMetadata: null,
    atomCount: 0,
    extractionCostUsd: null,
    extractedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

interface FakeDb {
  asset: {
    findFirst: Mock;
    update: Mock;
  };
  auditLog: { create: Mock };
  $transaction: Mock;
}

function makeDb(asset: FakeAsset): { db: FakeDb; updates: Partial<FakeAsset>[] } {
  let current = { ...asset };
  const updates: Partial<FakeAsset>[] = [];
  const update = vi.fn().mockImplementation(async ({ data }: { data: Partial<FakeAsset> }) => {
    current = { ...current, ...data };
    updates.push({ ...data });
    return current;
  });
  const db: FakeDb = {
    asset: {
      findFirst: vi.fn().mockImplementation(async () => ({ ...current })),
      update,
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Run inline; "tx" is the same fake db (test simplification).
      return fn({
        asset: { update },
        // Note: atomRepo.createMany is mocked module-level; tx.atom not accessed.
      });
    }),
  };
  return { db, updates };
}

function makeJob() {
  return {
    id: 'job_1',
    data: { assetId: 'asset_1', userId: 'user_1' },
  };
}

beforeEach(() => {
  // resetAllMocks also clears mockReturnValue/Implementation between tests.
  vi.resetAllMocks();
  createManyMock.mockResolvedValue({ count: 0 });
});

describe('processExtractAtoms', () => {
  it('happy path: PARSED -> EXTRACTING -> COMPLETED + persists atoms', async () => {
    extractMock.mockResolvedValue({
      atoms: [
        {
          userId: 'user_1',
          assetId: 'asset_1',
          kind: 'SKILL',
          content: { kind: 'SKILL', name: 'Python' },
          evidenceSpan: { assetId: 'asset_1', startOffset: 0, endOffset: 6, snippet: 'Python' },
          confidence: 0.95,
        },
      ],
      totalCostUsd: 0.012,
      rejectedCount: 0,
      inputCharCount: 26,
      chunkCount: 1,
      sourceLanguage: 'en',
    });
    createManyMock.mockResolvedValue({ count: 1 });

    const { db, updates } = makeDb(makeAsset());
    await processExtractAtoms(makeJob() as never, db as never, makeLog());

    expect(updates[0]?.status).toBe(AssetStatus.EXTRACTING);
    expect(updates.at(-1)?.status).toBe(AssetStatus.COMPLETED);
    expect(updates.at(-1)?.atomCount).toBe(1);
    expect(updates.at(-1)?.extractionCostUsd).toBe(0.012);
    expect(createManyMock).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      expect.arrayContaining([expect.objectContaining({ kind: 'SKILL' })]),
      'extract-atom@v1.0.0',
    );

    const actions = (db.auditLog.create.mock.calls as Array<[{ data: { action: string } }]>).map(
      (c) => c[0].data.action,
    );
    expect(actions).toContain('ASSET_EXTRACTING');
    expect(actions).toContain('ASSET_EXTRACTED');
    expect(actions).toContain('ATOMS_CREATED');
  });

  it('idempotent: COMPLETED -> skip', async () => {
    const { db, updates } = makeDb(makeAsset({ status: AssetStatus.COMPLETED, atomCount: 5 }));
    await processExtractAtoms(makeJob() as never, db as never, makeLog());
    expect(extractMock).not.toHaveBeenCalled();
    expect(updates.length).toBe(0);
  });

  it('idempotent: EXTRACTING + atomCount>0 -> skip (crash recovery)', async () => {
    const { db, updates } = makeDb(
      makeAsset({ status: AssetStatus.EXTRACTING, atomCount: 3 }),
    );
    await processExtractAtoms(makeJob() as never, db as never, makeLog());
    expect(extractMock).not.toHaveBeenCalled();
    expect(updates.length).toBe(0);
  });

  it('resumes when EXTRACTING + atomCount=0 (crash before persisting)', async () => {
    extractMock.mockResolvedValue({
      atoms: [],
      totalCostUsd: 0.005,
      rejectedCount: 0,
      inputCharCount: 10,
      chunkCount: 1,
      sourceLanguage: 'en',
    });
    createManyMock.mockResolvedValue({ count: 0 });
    const { db } = makeDb(makeAsset({ status: AssetStatus.EXTRACTING, atomCount: 0 }));
    await processExtractAtoms(makeJob() as never, db as never, makeLog());
    expect(extractMock).toHaveBeenCalled();
  });

  it('empty parsedText -> COMPLETED with 0 atoms (image asset path)', async () => {
    const { db, updates } = makeDb(makeAsset({ parsedText: '' }));
    await processExtractAtoms(makeJob() as never, db as never, makeLog());
    expect(extractMock).not.toHaveBeenCalled();
    expect(updates.at(-1)?.status).toBe(AssetStatus.COMPLETED);
    expect(updates.at(-1)?.atomCount).toBe(0);
  });

  it('missing asset -> UnrecoverableError', async () => {
    const db: FakeDb = {
      asset: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    };
    await expect(
      processExtractAtoms(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('userId mismatch -> UnrecoverableError', async () => {
    const { db } = makeDb(makeAsset({ userId: 'someone_else' }));
    await expect(
      processExtractAtoms(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('status not extractable -> UnrecoverableError', async () => {
    const { db } = makeDb(makeAsset({ status: AssetStatus.PENDING }));
    await expect(
      processExtractAtoms(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('PermanentError from extraction -> FAILED + audit + UnrecoverableError', async () => {
    extractMock.mockRejectedValue(new PermanentError('LLM did not call submit_atoms'));
    const { db, updates } = makeDb(makeAsset());
    await expect(
      processExtractAtoms(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(updates.at(-1)?.status).toBe(AssetStatus.FAILED);
    expect(updates.at(-1)?.errorMessage).toMatch(/submit_atoms/);
    const actions = (db.auditLog.create.mock.calls as Array<[{ data: { action: string } }]>).map(
      (c) => c[0].data.action,
    );
    expect(actions).toContain('ASSET_EXTRACT_FAILED');
  });

  it('Transient error -> errorMessage + rethrow (status stays EXTRACTING)', async () => {
    const transient = new Error('Anthropic 503');
    extractMock.mockRejectedValue(transient);
    const { db, updates } = makeDb(makeAsset());
    await expect(
      processExtractAtoms(makeJob() as never, db as never, makeLog()),
    ).rejects.toBe(transient);
    expect(updates.some((u) => u.status === AssetStatus.FAILED)).toBe(false);
    expect(updates.at(-1)?.errorMessage).toBe('Anthropic 503');
  });

  it('cost cap exceeded -> FAILED + UnrecoverableError without calling Claude', async () => {
    // estimate = chars/4 * (1 + 1.5*5) / 1M = chars * 2.125 / 1M.
    // 80_000 chars -> 0.17 USD which is over the 0.15 cap and under MAX_INPUT_CHARS (100k).
    const huge = 'x'.repeat(80_000);
    const { db, updates } = makeDb(makeAsset({ parsedText: huge }));
    await expect(
      processExtractAtoms(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(extractMock).not.toHaveBeenCalled();
    expect(updates.at(-1)?.status).toBe(AssetStatus.FAILED);
    expect(updates.at(-1)?.errorMessage).toMatch(/exceeds cap/);
  });
});
