/**
 * Re-export schema upload tu @atomic-me/shared (single source of truth).
 * Tach file de phia route co duong import gon (./schema.js) va de huong sau
 * gan response schema cho serializer/openapi neu can.
 */
export {
  confirmUploadRequestSchema,
  confirmUploadResponseSchema,
  uploadUrlRequestSchema,
  uploadUrlResponseSchema,
  type ConfirmUploadRequest,
  type ConfirmUploadResponse,
  type UploadUrlRequest,
  type UploadUrlResponse,
} from '@atomic-me/shared';
