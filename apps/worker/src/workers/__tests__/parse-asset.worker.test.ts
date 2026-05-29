import { AssetStatus, AssetType } from '@atomic-me/db';
import { UnrecoverableError } from 'bullmq';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Logger } from 'pino';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../lib/storage.js', () => ({
  downloadAsset: vi.fn(),
  __resetStorageClient: vi.fn(),
}));

// Block enqueue cua extract-atoms trong test (test khong dung Redis).
vi.mock('../../lib/queue.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/queue.js')>(
    '../../lib/queue.js',
  );
  return {
    ...actual,
    createQueue: vi.fn(() => ({
      add: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { downloadAsset } from '../../lib/storage.js';
import { processParseAsset } from '../parse-asset.worker.js';

function makeLog(): Logger {
  const fn = vi.fn();
  const log = {
    info: fn,
    warn: fn,
    error: fn,
    debug: fn,
    fatal: fn,
    trace: fn,
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
  originalFilename: string;
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  status: AssetStatus;
  parsedText: string | null;
  parsedMetadata: unknown;
  parsedAt: Date | null;
  warnings: string[];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeAsset(overrides: Partial<FakeAsset> = {}): FakeAsset {
  return {
    id: 'asset_1',
    userId: 'user_1',
    type: AssetType.PDF,
    originalFilename: 'cv.pdf',
    storageKey: 'users/user_1/assets/asset_1/cv.pdf',
    sizeBytes: 1234,
    mimeType: 'application/pdf',
    status: AssetStatus.UPLOADED,
    parsedText: null,
    parsedMetadata: null,
    parsedAt: null,
    warnings: [],
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface FakeDb {
  asset: {
    findFirst: Mock;
    update: Mock;
  };
  auditLog: {
    create: Mock;
  };
}

function makeDb(asset: FakeAsset): { db: FakeDb; updates: FakeAsset[] } {
  let current: FakeAsset = { ...asset };
  const updates: FakeAsset[] = [];
  const db: FakeDb = {
    asset: {
      findFirst: vi.fn().mockImplementation(async () => ({ ...current })),
      update: vi.fn().mockImplementation(async ({ data }: { data: Partial<FakeAsset> }) => {
        current = { ...current, ...data } as FakeAsset;
        updates.push({ ...current });
        return current;
      }),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
  return { db, updates };
}

interface FakeJob {
  id: string;
  data: { assetId: string; userId: string };
}

function makeJob(overrides: Partial<FakeJob> = {}): FakeJob {
  return {
    id: 'job_1',
    data: { assetId: 'asset_1', userId: 'user_1' },
    ...overrides,
  };
}

const downloadAssetMock = downloadAsset as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

// Minimal valid PDF buffer (text-based, single page) for parser pass-through.
async function makeTinyPdf(text = 'Hello CV'): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  page.setFont(font);
  page.setFontSize(12);
  page.drawText(text, { x: 50, y: 720 });
  return Buffer.from(await doc.save());
}

describe('processParseAsset', () => {
  it('happy path: UPLOADED -> PARSING -> PARSED with parsed text + audit', async () => {
    const pdfBuf = await makeTinyPdf('Phase 6 happy path');
    downloadAssetMock.mockResolvedValue(pdfBuf);
    const { db, updates } = makeDb(makeAsset());

    await processParseAsset(
      makeJob() as never,
      db as never,
      makeLog(),
    );

    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates[0]?.status).toBe(AssetStatus.PARSING);
    const final = updates.at(-1);
    expect(final?.status).toBe(AssetStatus.PARSED);
    expect(final?.parsedText).toContain('Phase 6 happy path');
    expect(final?.parsedAt).toBeInstanceOf(Date);

    // Audit gom ASSET_PARSING + ASSET_PARSED.
    const actions = (db.auditLog.create.mock.calls as Array<[{ data: { action: string } }]>).map(
      (call) => call[0].data.action,
    );
    expect(actions).toContain('ASSET_PARSING');
    expect(actions).toContain('ASSET_PARSED');
  });

  it('idempotent: status already PARSED -> skip without touching R2', async () => {
    const { db, updates } = makeDb(makeAsset({ status: AssetStatus.PARSED }));

    await processParseAsset(
      makeJob() as never,
      db as never,
      makeLog(),
    );

    expect(downloadAssetMock).not.toHaveBeenCalled();
    expect(updates.length).toBe(0);
  });

  it('throws UnrecoverableError when asset not found (no retry)', async () => {
    const db: FakeDb = {
      asset: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };

    await expect(
      processParseAsset(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(downloadAssetMock).not.toHaveBeenCalled();
  });

  it('unsupported file type -> status FAILED + UnrecoverableError', async () => {
    const { db, updates } = makeDb(
      makeAsset({ mimeType: 'application/x-msdownload', originalFilename: 'bad.exe' }),
    );

    await expect(
      processParseAsset(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    // Co update PARSING truoc, sau do FAILED.
    expect(updates.at(-1)?.status).toBe(AssetStatus.FAILED);
    expect(updates.at(-1)?.errorMessage).toMatch(/Unsupported/);

    const actions = (db.auditLog.create.mock.calls as Array<[{ data: { action: string } }]>).map(
      (call) => call[0].data.action,
    );
    expect(actions).toContain('ASSET_PARSE_FAILED');
  });

  it('userId mismatch -> UnrecoverableError', async () => {
    const { db } = makeDb(makeAsset({ userId: 'someone_else' }));

    await expect(
      processParseAsset(makeJob() as never, db as never, makeLog()),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('resumes from PARSING state (worker crash recovery)', async () => {
    const pdfBuf = await makeTinyPdf('Recovered');
    downloadAssetMock.mockResolvedValue(pdfBuf);
    const { db, updates } = makeDb(makeAsset({ status: AssetStatus.PARSING }));

    await processParseAsset(
      makeJob() as never,
      db as never,
      makeLog(),
    );

    expect(updates.at(-1)?.status).toBe(AssetStatus.PARSED);
  });
});
