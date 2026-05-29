/**
 * Phan loai loi de BullMQ retry hay vao DLQ.
 *
 * - TransientError: van xuat hien => BullMQ retry tu nhien (attempts mac dinh).
 *   Vi du: R2 5xx, Redis timeout, mat connection tam.
 * - PermanentError: bug logic / data sai => khong retry, vao failed luon.
 *   Vi du: unsupported file type, asset khong ton tai, parser fail vi corrupt.
 *
 * BullMQ pickup: dung Worker.UnrecoverableError de stop retry. retry.ts wrap
 * helper khac nhau, parse-asset.worker.ts se check instance va re-throw
 * Worker.UnrecoverableError neu can.
 */

export class TransientError extends Error {
  override readonly name = 'TransientError';
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class PermanentError extends Error {
  override readonly name = 'PermanentError';
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export interface WithRetryOptions {
  /** So lan retry toi da (mac dinh 3). */
  retries?: number;
  /** Delay co ban (ms) cho exponential backoff. */
  baseDelayMs?: number;
  /** Optional logger callback. */
  onRetry?: (attempt: number, err: unknown) => void;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 200;

/**
 * Helper retry trong worker (ngoai retry mac dinh cua BullMQ).
 * Stop ngay khi gap PermanentError. Retry chi voi TransientError hoac Error chua phan loai.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: WithRetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof PermanentError) {
        throw err;
      }
      if (attempt === retries) break;
      opts.onRetry?.(attempt + 1, err);
      const delay = baseDelay * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
