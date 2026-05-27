import { createId, isCuid } from '@paralleldrive/cuid2';

/**
 * Sinh atom id moi (cuid2). Dung khi can id truoc khi insert DB
 * (vd: optimistic UI, hoac reference giua cac record cung batch).
 */
export function generateAtomId(): string {
  return createId();
}

/**
 * Kiem tra mot string co phai cuid2 hop le khong.
 */
export function isValidAtomId(id: string): boolean {
  return isCuid(id);
}

/** Metadata parse tu mot atom id. Hien tai id la opaque (khong encode kind). */
export interface AtomIdMetadata {
  valid: boolean;
}

/**
 * Parse metadata tu atom id. atomic-me giu id opaque (khong nhet kind vao prefix)
 * de tranh phu thuoc format; ham nay chi validate. Mo rong sau neu can.
 */
export function parseAtomIdMetadata(id: string): AtomIdMetadata {
  return { valid: isValidAtomId(id) };
}
