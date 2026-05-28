import type { ConfirmUploadResponse, UploadUrlRequest, UploadUrlResponse } from '@atomic-me/shared';

import { ApiClientError, type ApiClient } from '@/lib/api-client';

import type { UploadProgress } from './types';

/** Goi POST /assets/upload-url qua api-client (auth + base URL handled). */
export function requestUploadUrl(
  api: ApiClient,
  body: UploadUrlRequest,
): Promise<UploadUrlResponse> {
  return api.post<UploadUrlResponse>('/assets/upload-url', body);
}

export interface PutToR2Options {
  url: string;
  file: File;
  contentType: string;
  onProgress?: (info: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * PUT thang len R2 qua presigned URL. Dung XHR thay vi fetch vi:
 *   - fetch khong cung cap upload progress (chi download progress qua ReadableStream).
 *   - XHR.upload.onprogress cho phep theo doi byte da gui.
 */
export function putToR2(opts: PutToR2Options): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', opts.url);
    xhr.setRequestHeader('Content-Type', opts.contentType);

    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.round((e.loaded / e.total) * 100);
        opts.onProgress?.({ loaded: e.loaded, total: e.total, percent });
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(
        new ApiClientError(xhr.status, {
          code: 'R2_UPLOAD_FAILED',
          message: `R2 PUT returned ${xhr.status}`,
        }),
      );
    };
    xhr.onerror = () => {
      reject(
        new ApiClientError(0, {
          code: 'R2_UPLOAD_NETWORK',
          message: 'Network error during R2 upload',
        }),
      );
    };
    xhr.onabort = () => {
      reject(
        new ApiClientError(0, {
          code: 'R2_UPLOAD_ABORTED',
          message: 'Upload aborted',
        }),
      );
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(opts.file);
  });
}

/** Goi POST /assets/confirm. */
export function confirmUpload(api: ApiClient, assetId: string): Promise<ConfirmUploadResponse> {
  return api.post<ConfirmUploadResponse>('/assets/confirm', { assetId });
}
