import {
  ALLOWED_MIME_TYPES,
  COST_PER_COVER_LETTER,
  COST_PER_CV_GENERATION,
  MAX_FILE_SIZE_MB,
  MAX_GENERATIONS_PER_DAY,
} from '@atomic-me/shared';

/**
 * Hang so cau hinh server (timeout, body limit).
 * BODY_LIMIT_BYTES la default cho route thuong; route upload se override sau.
 */
export const CONFIG = {
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 10_000,
  REQUEST_TIMEOUT_MS: 30_000,
  BODY_LIMIT_BYTES: 1_048_576,
} as const;

/** Version cua app, doc tu npm script env (fallback khi chay node truc tiep). */
export const APP_VERSION = process.env['npm_package_version'] ?? '0.0.0';

// Re-export credit cost / limits tu @atomic-me/shared de consumer import 1 cho.
export {
  ALLOWED_MIME_TYPES,
  COST_PER_COVER_LETTER,
  COST_PER_CV_GENERATION,
  MAX_FILE_SIZE_MB,
  MAX_GENERATIONS_PER_DAY,
};
