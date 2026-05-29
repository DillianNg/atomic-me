/**
 * Ten queue dung chung trong toan he thong.
 * Cung file de api (producer) va worker (consumer) cung tham chieu 1 hang.
 * Tach khoi worker package vi api khong nen import worker (worker la entry-point
 * boot process; subpath export overhead khong dang).
 */
export const QUEUE_NAMES = {
  PARSE_ASSET: 'parse-asset',
  EXTRACT_ATOMS: 'extract-atoms',
  EMBED_ATOMS: 'embed-atoms',
  DEDUP_ATOMS: 'dedup-atoms',
  CANONICALIZE: 'canonicalize',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Default BullMQ job options dung chung. */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { age: 86_400, count: 1000 },
  removeOnFail: { age: 604_800 },
} as const;
