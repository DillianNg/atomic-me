/**
 * Shape cua cac BullMQ job payload.
 * Source of truth giua API (producer) va worker (consumer) de ca 2 ben
 * import cung 1 type, tranh sai key.
 *
 * Quy tac:
 * - Khong dat field nhay cam (token, secret) trong job data (luu vao DB la du).
 * - Field nho gon: id reference + minimum context. Worker reload tu DB.
 */

/**
 * Job 'parse-asset': worker download file tu R2, parse thanh text + metadata,
 * cap nhat Asset (status, parsedText, parsedMetadata, warnings).
 *
 * Idempotent: job chay 2 lan voi cung assetId phai an toan
 * (lan 2 kiem tra status, skip neu da PARSED).
 */
export interface ParseAssetJob {
  /** Asset.id de worker load record. */
  assetId: string;
  /** User.id (de log + check audit, khong dung de auth). */
  userId: string;
}

/**
 * Job 'extract-atoms': Phase 7 se implement. Khai bao truoc de parse-asset
 * worker co the enqueue ma khong cho.
 */
export interface ExtractAtomsJob {
  assetId: string;
  userId: string;
}

/**
 * Job 'embed-atoms': Phase 7+. Embed mot batch atom (Voyage AI).
 */
export interface EmbedAtomsJob {
  userId: string;
  atomIds: string[];
}

/**
 * Job 'dedup-atoms': Phase 7+. Tim atom trung lap sau khi embed.
 */
export interface DedupAtomsJob {
  userId: string;
}

/**
 * Job 'canonicalize': Phase 8+. Map atom skill -> CanonicalSkill.
 */
export interface CanonicalizeJob {
  userId: string;
  atomIds: string[];
}

/**
 * Job 'cleanup': Phase n. Don dep asset bi orphan / soft-delete cu.
 */
export interface CleanupJob {
  olderThanDays: number;
}
