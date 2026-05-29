import { AssetStatus, AssetType, type Asset, type User } from '@atomic-me/db';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AWS presigner BEFORE importing the app to ensure storage plugin picks up the mock.
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/signed-put'),
}));
// Mock BullMQ truoc khi queue plugin tao Queue: trong test khong co Redis.
const queueAdd = vi.fn().mockResolvedValue(undefined);
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: queueAdd,
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  })),
}));
vi.mock('../lib/clerk.js');
vi.mock('../repositories/user.repo.js');
vi.mock('../repositories/asset.repo.js');
vi.mock('../services/audit.service.js');
vi.mock('../services/user.service.js');

import { buildApp } from '../app.js';
import type { ClerkJwtClaims } from '../lib/clerk.js';
import * as clerk from '../lib/clerk.js';
import { __resetRateLimitForTests } from '../plugins/rate-limit.js';
import * as assetRepo from '../repositories/asset.repo.js';
import * as userRepo from '../repositories/user.repo.js';
import { logAudit } from '../services/audit.service.js';

function makeUser(): User {
  return {
    id: 'user_local_1',
    clerkId: 'user_clerk_1',
    email: 'a@b.com',
    name: 'A',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}
function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    userId: 'user_local_1',
    type: AssetType.PDF,
    originalFilename: 'CV.pdf',
    storageKey: 'users/user_local_1/assets/asset_1/CV.pdf',
    sizeBytes: 1024,
    mimeType: 'application/pdf',
    status: AssetStatus.PENDING,
    parsedText: null,
    parsedMetadata: null,
    parsedAt: null,
    warnings: [],
    errorMessage: null,
    extractionCostUsd: null,
    extractedAt: null,
    atomCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitForTests();
  vi.mocked(clerk.verifyClerkToken).mockResolvedValue({ sub: 'user_clerk_1' } as unknown as ClerkJwtClaims);
  vi.mocked(userRepo.findByClerkId).mockResolvedValue(makeUser());
});

describe('POST /assets/upload-url', () => {
  const VALID_BODY = { filename: 'CV.pdf', mimeType: 'application/pdf', sizeBytes: 1024 };

  it('returns 401 when no bearer token is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-url',
      payload: VALID_BODY,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when sizeBytes exceeds the cap', async () => {
    const tooBig = 26 * 1024 * 1024;
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-url',
      headers: { authorization: 'Bearer t' },
      payload: { ...VALID_BODY, sizeBytes: tooBig },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when MIME type is not allowed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-url',
      headers: { authorization: 'Bearer t' },
      payload: { filename: 'a.mp4', mimeType: 'video/mp4', sizeBytes: 100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with assetId, uploadUrl, storageKey on success', async () => {
    vi.mocked(assetRepo.countByUser).mockResolvedValue(0);
    vi.mocked(assetRepo.create).mockResolvedValue(makeAsset({ id: 'a_new' }));
    vi.mocked(assetRepo.updateStorageKey).mockResolvedValue(makeAsset({ id: 'a_new' }));

    const res = await app.inject({
      method: 'POST',
      url: '/assets/upload-url',
      headers: { authorization: 'Bearer t' },
      payload: VALID_BODY,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      assetId: 'a_new',
      uploadUrl: 'https://r2.example.com/signed-put',
      storageKey: 'users/user_local_1/assets/a_new/CV.pdf',
      expiresInSeconds: 300,
    });
    // userId is set from JWT, not body -> assertCreatedFor user_local_1.
    expect(vi.mocked(assetRepo.create).mock.calls[0]?.[1]).toMatchObject({
      userId: 'user_local_1',
      type: AssetType.PDF,
    });
  });

  it('returns 429 once the per-user rate limit is exceeded', async () => {
    vi.mocked(assetRepo.countByUser).mockResolvedValue(0);
    vi.mocked(assetRepo.create).mockResolvedValue(makeAsset({ id: 'a_x' }));
    vi.mocked(assetRepo.updateStorageKey).mockResolvedValue(makeAsset({ id: 'a_x' }));

    const headers = { authorization: 'Bearer t' };
    // 20 OK
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/assets/upload-url',
        headers,
        payload: VALID_BODY,
      });
      expect(res.statusCode).toBe(200);
    }
    // 21st rate-limited
    const overflow = await app.inject({
      method: 'POST',
      url: '/assets/upload-url',
      headers,
      payload: VALID_BODY,
    });
    expect(overflow.statusCode).toBe(429);
    expect(overflow.json<{ error: { code: string } }>().error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /assets/confirm', () => {
  it('returns 200 with UPLOADED status, audits, enqueues parse-asset job', async () => {
    vi.mocked(assetRepo.findByIdForUser).mockResolvedValue(makeAsset({ status: AssetStatus.PENDING }));
    vi.mocked(assetRepo.setStatus).mockResolvedValue(makeAsset({ status: AssetStatus.UPLOADED }));

    const res = await app.inject({
      method: 'POST',
      url: '/assets/confirm',
      headers: { authorization: 'Bearer t' },
      payload: { assetId: 'asset_1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: 'asset_1', status: 'UPLOADED' });
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logAudit).mock.calls[0]?.[0]).toMatchObject({
      action: 'ASSET_UPLOADED',
      entityType: 'Asset',
      entityId: 'asset_1',
      userId: 'user_local_1',
    });
    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd.mock.calls[0]?.[0]).toBe('parse-asset');
    expect(queueAdd.mock.calls[0]?.[1]).toEqual({ assetId: 'asset_1', userId: 'user_local_1' });
    expect(queueAdd.mock.calls[0]?.[2]).toEqual({ jobId: 'parse:asset_1' });
  });

  it('returns 404 when the asset does not belong to the user', async () => {
    vi.mocked(assetRepo.findByIdForUser).mockResolvedValue(null);
    const res = await app.inject({
      method: 'POST',
      url: '/assets/confirm',
      headers: { authorization: 'Bearer t' },
      payload: { assetId: 'someone_elses' },
    });
    expect(res.statusCode).toBe(404);
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
