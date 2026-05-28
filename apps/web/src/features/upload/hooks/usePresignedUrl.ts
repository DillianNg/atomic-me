import { useMutation } from '@tanstack/react-query';

import { useApiClient } from '@/features/auth/hooks/useApiClient';

import { requestUploadUrl } from '../api';
import type { UploadUrlRequest, UploadUrlResponse } from '../types';

/**
 * Mutation goi POST /assets/upload-url.
 * Tach rieng ra hook de dung doc lap (vd retry) hoac compose trong useUploadAsset.
 */
export function usePresignedUrl() {
  const api = useApiClient();
  return useMutation<UploadUrlResponse, Error, UploadUrlRequest>({
    mutationFn: (body) => requestUploadUrl(api, body),
  });
}
