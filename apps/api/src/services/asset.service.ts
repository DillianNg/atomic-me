import { AssetStatus, AssetType, type PrismaClient } from '@atomic-me/db';
import {
  ALLOWED_MIME_TYPES,
  MAX_ASSETS_PER_USER,
  MAX_FILE_SIZE_MB,
  type AllowedMimeType,
  type UploadUrlRequest,
} from '@atomic-me/shared';
import type { FastifyBaseLogger } from 'fastify';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import type { StorageClient } from '../plugins/storage.js';
import { buildStorageKey } from '../plugins/storage.js';
import * as assetRepo from '../repositories/asset.repo.js';

import { logAudit } from './audit.service.js';

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Map MIME -> AssetType (1-1 voi enum trong schema + ALLOWED_MIME_TYPES). */
const MIME_TO_ASSET_TYPE: Record<AllowedMimeType, AssetType> = {
  'application/pdf': AssetType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': AssetType.DOCX,
  'image/png': AssetType.IMAGE,
  'image/jpeg': AssetType.IMAGE,
  'image/webp': AssetType.IMAGE,
  'audio/mpeg': AssetType.AUDIO,
  'audio/wav': AssetType.AUDIO,
  'audio/mp4': AssetType.AUDIO,
  'application/zip': AssetType.LINKEDIN_ARCHIVE,
  'text/plain': AssetType.TEXT,
};

/** Helper: chuyen MIME thanh AssetType, throw ValidationError neu khong support. */
export function assetTypeFromMime(mime: string): AssetType {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    throw new ValidationError(`Unsupported MIME type: ${mime}`);
  }
  return MIME_TO_ASSET_TYPE[mime as AllowedMimeType];
}

export interface RequestUploadUrlInput {
  db: PrismaClient;
  storage: StorageClient;
  log: FastifyBaseLogger;
  userId: string;
  body: UploadUrlRequest;
}

export interface RequestUploadUrlResult {
  assetId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

/**
 * Buoc 1: xin presigned URL.
 * - Validate (Zod o handler da check shape + size cap + mime cap). O day check:
 *   + Quota MAX_ASSETS_PER_USER.
 *   + Khang dinh size <= MAX_FILE_SIZE_BYTES lan nua (no trust client).
 * - Tao Asset record voi status mac dinh PENDING (default schema).
 * - storageKey = users/{userId}/assets/{assetId}/{sanitizedFilename}.
 * - Tra presigned PUT URL het han sau 5 phut.
 */
export async function requestUploadUrl(
  input: RequestUploadUrlInput,
): Promise<RequestUploadUrlResult> {
  const { db, storage, userId, body } = input;

  if (body.sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(`File exceeds the ${MAX_FILE_SIZE_MB} MB limit`);
  }
  const type = assetTypeFromMime(body.mimeType);

  const existingCount = await assetRepo.countByUser(db, userId);
  if (existingCount >= MAX_ASSETS_PER_USER) {
    throw new ConflictError(`Asset limit reached (${MAX_ASSETS_PER_USER} per user)`);
  }

  // Tao record voi storageKey rong tam thoi -> can id thi moi build key.
  // Cach goon nhat la tao record, lay id, build key, roi update lai storageKey.
  // KHONG transaction-bao quanh presign (presign khong nen trong DB tx).
  const draft = await assetRepo.create(db, {
    userId,
    type,
    originalFilename: body.filename,
    storageKey: 'pending', // placeholder, sap update
    sizeBytes: body.sizeBytes,
    mimeType: body.mimeType,
  });

  const storageKey = buildStorageKey(userId, draft.id, body.filename);
  await assetRepo.updateStorageKey(db, draft.id, storageKey);

  const uploadUrl = await storage.presignPut({ key: storageKey, contentType: body.mimeType });

  return {
    assetId: draft.id,
    uploadUrl,
    storageKey,
    expiresInSeconds: storage.expirySeconds,
  };
}

export interface ConfirmUploadInput {
  db: PrismaClient;
  log: FastifyBaseLogger;
  userId: string;
  assetId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ConfirmUploadResult {
  id: string;
  status: 'UPLOADED';
}

/**
 * Buoc 2: confirm sau khi FE PUT thanh cong len R2.
 * - Bat buoc asset thuoc user goi (security).
 * - Chi cho phep chuyen PENDING -> UPLOADED. Cac status khac -> 409.
 * - Ghi audit log action 'asset.uploaded'.
 */
export async function confirmUpload(input: ConfirmUploadInput): Promise<ConfirmUploadResult> {
  const { db, log, userId, assetId } = input;

  const asset = await assetRepo.findByIdForUser(db, assetId, userId);
  if (!asset) {
    // Khong leak thong tin: dung NotFoundError thay vi ForbiddenError.
    throw new NotFoundError('Asset not found');
  }
  if (asset.status === AssetStatus.UPLOADED) {
    // Idempotent: confirm 2 lan tra ket qua nhat quan, khong throw.
    return { id: asset.id, status: 'UPLOADED' };
  }
  if (asset.status !== AssetStatus.PENDING) {
    throw new ForbiddenError(`Cannot confirm asset in status ${asset.status}`);
  }

  const updated = await assetRepo.setStatus(db, asset.id, AssetStatus.UPLOADED);

  await logAudit({
    db,
    log,
    action: 'ASSET_UPLOADED',
    entityType: 'Asset',
    entityId: updated.id,
    userId,
    metadata: { storageKey: updated.storageKey },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return { id: updated.id, status: 'UPLOADED' };
}
