import { z } from 'zod';

import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB } from '../constants/limits.js';

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILENAME_LEN = 255;

/** Zod enum cua cac MIME type duoc phep upload. Source-of-truth duy nhat. */
export const mimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);
export type MimeType = z.infer<typeof mimeTypeSchema>;

// ============================================================
// POST /assets/upload-url
// ============================================================

/**
 * Body request xin presigned URL upload.
 * FE phai validate truoc (size + mime) de fail som, BE van validate lai
 * (khong tin client).
 */
export const uploadUrlRequestSchema = z.object({
  filename: z.string().min(1).max(MAX_FILENAME_LEN),
  mimeType: mimeTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

export const uploadUrlResponseSchema = z.object({
  /** ID cua Asset record da tao (status = PENDING). */
  assetId: z.string().min(1),
  /** Presigned PUT URL (FE upload thang len R2). Het han sau expiresInSeconds. */
  uploadUrl: z.string().url(),
  /** R2 key sau khi sanitize, de debug + dung trong audit. */
  storageKey: z.string().min(1),
  /** Thoi gian song cua presigned URL. */
  expiresInSeconds: z.number().int().positive(),
});
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

// ============================================================
// POST /assets/confirm
// ============================================================

/** Body request xac nhan upload da xong (FE goi sau khi PUT thanh cong). */
export const confirmUploadRequestSchema = z.object({
  assetId: z.string().min(1),
});
export type ConfirmUploadRequest = z.infer<typeof confirmUploadRequestSchema>;

export const confirmUploadResponseSchema = z.object({
  id: z.string().min(1),
  status: z.literal('UPLOADED'),
});
export type ConfirmUploadResponse = z.infer<typeof confirmUploadResponseSchema>;
