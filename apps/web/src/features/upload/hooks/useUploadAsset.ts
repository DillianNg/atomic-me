import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
  type AllowedMimeType,
} from '@atomic-me/shared';
import { useCallback, useState } from 'react';

import { useApiClient } from '@/features/auth/hooks/useApiClient';

import { confirmUpload, putToR2, requestUploadUrl } from '../api';
import type { ConfirmUploadResponse, UploadProgress, UploadStage } from '../types';

const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function isAllowedMime(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export interface UseUploadAssetResult {
  stage: UploadStage;
  progress: UploadProgress | null;
  error: Error | null;
  result: ConfirmUploadResponse | null;
  upload: (file: File) => Promise<void>;
  reset: () => void;
}

/**
 * Orchestrator 3 buoc:
 *   1) POST /assets/upload-url    (stage = requesting)
 *   2) PUT file len R2 qua XHR    (stage = uploading, theo doi progress)
 *   3) POST /assets/confirm       (stage = confirming)
 * Validate size + mime CLIENT-SIDE truoc khi goi BE (BE van validate lai).
 */
export function useUploadAsset(): UseUploadAssetResult {
  const api = useApiClient();
  const [stage, setStage] = useState<UploadStage>('idle');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<ConfirmUploadResponse | null>(null);

  const reset = useCallback(() => {
    setStage('idle');
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setStage('idle');
      setProgress(null);
      setError(null);
      setResult(null);

      try {
        if (file.size > MAX_BYTES) {
          throw new Error(`File vuot qua gioi han ${MAX_FILE_SIZE_MB} MB`);
        }
        if (!isAllowedMime(file.type)) {
          throw new Error(`Loai file khong duoc ho tro: ${file.type || 'unknown'}`);
        }

        setStage('requesting');
        const presigned = await requestUploadUrl(api, {
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });

        setStage('uploading');
        setProgress({ loaded: 0, total: file.size, percent: 0 });
        await putToR2({
          url: presigned.uploadUrl,
          file,
          contentType: file.type,
          onProgress: setProgress,
        });

        setStage('confirming');
        const confirmed = await confirmUpload(api, presigned.assetId);
        setResult(confirmed);
        setStage('done');
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Upload failed'));
        setStage('error');
      }
    },
    [api],
  );

  return { stage, progress, error, result, upload, reset };
}
