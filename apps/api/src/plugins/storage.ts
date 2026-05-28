import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fp from 'fastify-plugin';

import { env } from '../config/env.js';

const PRESIGN_EXPIRY_SECONDS = 300;
const MAX_FILENAME_LEN = 200;

/**
 * Sanitize filename truoc khi nhet vao R2 key:
 * - Trim whitespace, cap do dai.
 * - Giu chu/so/.-_, doi cac ky tu khac thanh `_` va nen `_+` -> `_`.
 * - Fallback `unnamed` neu rong.
 */
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  const cropped = trimmed.length > MAX_FILENAME_LEN ? trimmed.slice(-MAX_FILENAME_LEN) : trimmed;
  const safe = cropped.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^[._]+/, '');
  return safe.length === 0 ? 'unnamed' : safe;
}

/** R2 key chuan: users/{userId}/assets/{assetId}/{sanitizedFilename}. */
export function buildStorageKey(userId: string, assetId: string, filename: string): string {
  return `users/${userId}/assets/${assetId}/${sanitizeFilename(filename)}`;
}

export interface PresignPutInput {
  key: string;
  contentType: string;
}

export interface PresignGetInput {
  key: string;
}

export interface StorageClient {
  /** Presigned PUT URL (FE upload truc tiep). expiresInSeconds = 300. */
  presignPut(input: PresignPutInput): Promise<string>;
  /** Presigned GET URL de tai file ve (Phase 6 / evidence). */
  presignGet(input: PresignGetInput): Promise<string>;
  /** Thoi gian song cua URL (giay). */
  expirySeconds: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageClient;
  }
}

/**
 * Storage plugin (Phase 5).
 * Decorate `fastify.storage` voi presignPut/presignGet bound voi R2 client va bucket.
 * Khong cham network o boot, chi luc handler goi presignXxx().
 */
export default fp(
  async (fastify) => {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    const storage: StorageClient = {
      expirySeconds: PRESIGN_EXPIRY_SECONDS,
      async presignPut({ key, contentType }) {
        const command = new PutObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: key,
          ContentType: contentType,
        });
        return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
      },
      async presignGet({ key }) {
        const command = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key });
        return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
      },
    };

    fastify.decorate('storage', storage);
  },
  { name: 'storage' },
);
