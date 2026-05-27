/**
 * Gioi han kich thuoc file upload (MB).
 */
export const MAX_FILE_SIZE_MB = 25;

/** Gioi han so asset moi user co the upload. */
export const MAX_ASSETS_PER_USER = 50;

/** Gioi han so atom moi user (chong abuse + control cost embedding). */
export const MAX_ATOMS_PER_USER = 5000;

/** Do dai toi da cua JD raw text (ky tu). */
export const MAX_JD_LENGTH_CHARS = 20000;

/** Gioi han so generation moi ngay (anti-abuse). */
export const MAX_GENERATIONS_PER_DAY = 20;

/**
 * MIME type duoc phep upload. Map 1-1 voi AssetType trong DB schema.
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'application/zip',
  'text/plain',
] as const;

/** Union type cua cac MIME type duoc phep. */
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
