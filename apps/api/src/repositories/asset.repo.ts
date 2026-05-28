import type {
  Asset,
  AssetStatus,
  AssetType,
  Prisma,
  PrismaClient,
} from '@atomic-me/db';

/** Repo Asset: thuan Prisma, khong biet HTTP/business rules. */
type Db = PrismaClient | Prisma.TransactionClient;

export interface CreateAssetInput {
  userId: string;
  type: AssetType;
  originalFilename: string;
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
}

/** Tao asset moi voi status mac dinh (PENDING tu schema). */
export function create(db: Db, input: CreateAssetInput): Promise<Asset> {
  return db.asset.create({
    data: {
      userId: input.userId,
      type: input.type,
      originalFilename: input.originalFilename,
      storageKey: input.storageKey,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
    },
  });
}

/**
 * Tim asset chi khi thuoc ve userId truyen vao (security: tranh nguoi A
 * doc/sua asset cua nguoi B). Tra null neu khong khop -> handler tra 404.
 */
export function findByIdForUser(db: Db, id: string, userId: string): Promise<Asset | null> {
  return db.asset.findFirst({ where: { id, userId } });
}

/** Dem so asset cua user (de check limit MAX_ASSETS_PER_USER). */
export function countByUser(db: Db, userId: string): Promise<number> {
  return db.asset.count({ where: { userId } });
}

/** Cap nhat status, tra ve record sau cap nhat. */
export function setStatus(db: Db, id: string, status: AssetStatus): Promise<Asset> {
  return db.asset.update({ where: { id }, data: { status } });
}

/** Cap nhat storageKey (vd sau khi tao record xong va build key tu id). */
export function updateStorageKey(db: Db, id: string, storageKey: string): Promise<Asset> {
  return db.asset.update({ where: { id }, data: { storageKey } });
}
