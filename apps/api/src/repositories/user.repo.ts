import type { Prisma, PrismaClient, User } from '@atomic-me/db';

/**
 * Repository cho User: thuan Prisma, khong biet toi Fastify/HTTP.
 * Nhan vao `db` (PrismaClient hoac TransactionClient) de tai su dung
 * trong $transaction. Khong chua logic credit/audit (de o service layer).
 */
type Db = PrismaClient | Prisma.TransactionClient;

export interface CreateUserInput {
  clerkId: string;
  email: string;
  name?: string | null;
}

export interface UpdateUserInput {
  email?: string;
  name?: string | null;
}

/** Tim user theo Clerk id (unique). Tra null neu khong co. */
export function findByClerkId(db: Db, clerkId: string): Promise<User | null> {
  return db.user.findUnique({ where: { clerkId } });
}

/** Tim user theo id noi bo (cuid). Tra null neu khong co. */
export function findById(db: Db, id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

/** Tao user moi. Caller chiu trach nhiem dam bao chua ton tai (idempotency). */
export function create(db: Db, input: CreateUserInput): Promise<User> {
  return db.user.create({
    data: { clerkId: input.clerkId, email: input.email, name: input.name ?? null },
  });
}

/** Cap nhat field dong bo tu Clerk (email, name). */
export function update(db: Db, clerkId: string, input: UpdateUserInput): Promise<User> {
  const data: Prisma.UserUpdateInput = {};
  if (input.email !== undefined) data.email = input.email;
  if (input.name !== undefined) data.name = input.name;
  return db.user.update({ where: { clerkId }, data });
}

/** Soft-delete: set deletedAt. Giu nguyen record lien quan (FK). */
export function softDelete(db: Db, clerkId: string): Promise<User> {
  return db.user.update({ where: { clerkId }, data: { deletedAt: new Date() } });
}
