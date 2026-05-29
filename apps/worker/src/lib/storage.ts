import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '../config/env.js';

import { TransientError } from './retry.js';

/**
 * R2 S3-compatible client cho worker. Khac apps/api (chi can GET object).
 * forcePathStyle = true: R2 yeu cau path style.
 */
let s3Client: S3Client | null = null;
function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

export interface DownloadAssetInput {
  key: string;
  /** Toi da byte cho phep tai (hard cap, vd MAX_FILE_SIZE). */
  maxBytes: number;
}

/**
 * Download object tu R2 thanh Buffer, voi gioi han size.
 * - 5xx / network = TransientError (BullMQ retry).
 * - 4xx (NotFound, AccessDenied) = throw goc -> wrapper goi se quyet dinh.
 *
 * Stream body cua aws-sdk v3 la either Readable hoac Blob; xu ly Node.js Readable.
 */
export async function downloadAsset(input: DownloadAssetInput): Promise<Buffer> {
  const client = getS3();
  const cmd = new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: input.key });

  let response;
  try {
    response = await client.send(cmd);
  } catch (err) {
    // 5xx + network -> retry; 404/403 thuong la data sai (parse-asset goi se phan loai).
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === undefined || status >= 500) {
      throw new TransientError(
        `R2 GET failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
    throw err;
  }

  const body = response.Body;
  if (!body) {
    throw new Error('R2 GetObject returned empty body');
  }

  // aws-sdk v3 stream object exposes transformToByteArray() helper.
  const transform = (body as { transformToByteArray?: () => Promise<Uint8Array> })
    .transformToByteArray;
  if (typeof transform !== 'function') {
    throw new Error('Unexpected R2 response body type (no transformToByteArray)');
  }
  const bytes = await transform.call(body);
  if (bytes.byteLength > input.maxBytes) {
    throw new Error(
      `R2 object exceeds max bytes: ${bytes.byteLength} > ${input.maxBytes}`,
    );
  }
  return Buffer.from(bytes);
}

/** Reset cached client (test). */
export function __resetStorageClient(): void {
  s3Client = null;
}
