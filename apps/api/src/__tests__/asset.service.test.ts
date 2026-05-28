import { AssetStatus, AssetType, type Asset, type PrismaClient } from '@atomic-me/db';
import { MAX_ASSETS_PER_USER, MAX_FILE_SIZE_MB, type UploadUrlRequest } from '@atomic-me/shared';
import type { FastifyBaseLogger } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import type { StorageClient } from '../plugins/storage.js';
import * as assetRepo from '../repositories/asset.repo.js';
import {
  assetTypeFromMime,
  confirmUpload,
  requestUploadUrl,
} from '../services/asset.service.js';
import { logAudit } from '../services/audit.service.js';

vi.mock('../repositories/asset.repo.js');
vi.mock('../services/audit.service.js');

function makeStorage(): StorageClient {
  return {
    expirySeconds: 300,
    presignPut: vi.fn().mockResolvedValue('https://r2.example/signed-put'),
    presignGet: vi.fn().mockResolvedValue('https://r2.example/signed-get'),
  };
}
function makeLog(): FastifyBaseLogger {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as unknown as FastifyBaseLogger;
}
function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    userId: 'user_1',
    type: AssetType.PDF,
    originalFilename: 'cv.pdf',
    storageKey: 'users/user_1/assets/asset_1/cv.pdf',
    sizeBytes: 1024,
    mimeType: 'application/pdf',
    status: AssetStatus.PENDING,
    parsedText: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const VALID_BODY: UploadUrlRequest = {
  filename: 'CV.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assetTypeFromMime', () => {
  it('maps PDF MIME to AssetType.PDF', () => {
    expect(assetTypeFromMime('application/pdf')).toBe(AssetType.PDF);
  });
  it('maps PNG to IMAGE', () => {
    expect(assetTypeFromMime('image/png')).toBe(AssetType.IMAGE);
  });
  it('maps zip to LINKEDIN_ARCHIVE', () => {
    expect(assetTypeFromMime('application/zip')).toBe(AssetType.LINKEDIN_ARCHIVE);
  });
  it('throws ValidationError for unsupported MIME', () => {
    expect(() => assetTypeFromMime('video/mp4')).toThrow(ValidationError);
  });
});

describe('requestUploadUrl', () => {
  const baseInput = () => ({
    db: {} as PrismaClient,
    storage: makeStorage(),
    log: makeLog(),
    userId: 'user_1',
    body: VALID_BODY,
  });

  it('throws ValidationError when sizeBytes exceeds the limit', async () => {
    const input = baseInput();
    input.body = { ...VALID_BODY, sizeBytes: MAX_FILE_SIZE_MB * 1024 * 1024 + 1 };
    await expect(requestUploadUrl(input)).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError when user is at the asset cap', async () => {
    vi.mocked(assetRepo.countByUser).mockResolvedValue(MAX_ASSETS_PER_USER);
    await expect(requestUploadUrl(baseInput())).rejects.toThrow(ConflictError);
  });

  it('creates an asset, updates storage key, and returns a presigned URL', async () => {
    vi.mocked(assetRepo.countByUser).mockResolvedValue(0);
    vi.mocked(assetRepo.create).mockResolvedValue(makeAsset({ id: 'a1', userId: 'user_1' }));
    vi.mocked(assetRepo.updateStorageKey).mockResolvedValue(makeAsset({ id: 'a1' }));

    const input = baseInput();
    const result = await requestUploadUrl(input);

    expect(assetRepo.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(assetRepo.create).mock.calls[0]?.[1]).toMatchObject({
      userId: 'user_1',
      type: AssetType.PDF,
      originalFilename: 'CV.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(result.assetId).toBe('a1');
    expect(result.storageKey).toBe('users/user_1/assets/a1/CV.pdf');
    expect(result.uploadUrl).toBe('https://r2.example/signed-put');
    expect(result.expiresInSeconds).toBe(300);
    expect(input.storage.presignPut).toHaveBeenCalledWith({
      key: 'users/user_1/assets/a1/CV.pdf',
      contentType: 'application/pdf',
    });
  });
});

describe('confirmUpload', () => {
  const baseInput = () => ({
    db: {} as PrismaClient,
    log: makeLog(),
    userId: 'user_1',
    assetId: 'asset_1',
    ipAddress: null,
    userAgent: null,
  });

  it('throws NotFoundError when the asset is not owned by the user', async () => {
    vi.mocked(assetRepo.findByIdForUser).mockResolvedValue(null);
    await expect(confirmUpload(baseInput())).rejects.toThrow(NotFoundError);
  });

  it('is idempotent when the asset is already UPLOADED', async () => {
    vi.mocked(assetRepo.findByIdForUser).mockResolvedValue(makeAsset({ status: AssetStatus.UPLOADED }));
    const result = await confirmUpload(baseInput());
    expect(result).toEqual({ id: 'asset_1', status: 'UPLOADED' });
    expect(assetRepo.setStatus).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('moves PENDING to UPLOADED and writes an audit log', async () => {
    vi.mocked(assetRepo.findByIdForUser).mockResolvedValue(makeAsset({ status: AssetStatus.PENDING }));
    vi.mocked(assetRepo.setStatus).mockResolvedValue(makeAsset({ status: AssetStatus.UPLOADED }));

    const result = await confirmUpload(baseInput());

    expect(result).toEqual({ id: 'asset_1', status: 'UPLOADED' });
    expect(assetRepo.setStatus).toHaveBeenCalledWith({}, 'asset_1', AssetStatus.UPLOADED);
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logAudit).mock.calls[0]?.[0]).toMatchObject({
      action: 'ASSET_UPLOADED',
      entityType: 'Asset',
      entityId: 'asset_1',
      userId: 'user_1',
    });
  });

  it('throws ForbiddenError when the asset is in an unrelated status (eg FAILED)', async () => {
    vi.mocked(assetRepo.findByIdForUser).mockResolvedValue(makeAsset({ status: AssetStatus.FAILED }));
    await expect(confirmUpload(baseInput())).rejects.toThrow(ForbiddenError);
  });
});
