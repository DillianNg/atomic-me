/**
 * Re-export shared Zod-inferred types tu @atomic-me/shared cho convenience,
 * va dat them cac UI-local type cho hook orchestrator.
 */
export type {
  AllowedMimeType,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  UploadUrlRequest,
  UploadUrlResponse,
} from '@atomic-me/shared';

/** Stage cua flow upload. */
export type UploadStage = 'idle' | 'requesting' | 'uploading' | 'confirming' | 'done' | 'error';

/** Progress chuan cho upload XHR. */
export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}
