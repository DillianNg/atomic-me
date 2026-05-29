import type { Atom, Prisma, PrismaClient } from '@atomic-me/db';
import type { AtomCreateInput, AtomKind, AtomUpdateInput } from '@atomic-me/shared';

/**
 * Atom repository: thuan Prisma.
 *
 * BAT BUOC: moi method nhan userId va enforce WHERE userId = ? (row-level
 * security). Worker chay duoi shared connection, KHONG dua vao app-level
 * auth -> repo phai tu bao ve cross-tenant.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Bulk-insert atoms. Set promptVersion cho tat ca atom trong batch.
 * Tra so atom da insert (Prisma createMany count).
 */
export async function createMany(
  db: Db,
  userId: string,
  atoms: AtomCreateInput[],
  promptVersion: string,
): Promise<{ count: number }> {
  if (atoms.length === 0) return { count: 0 };
  // Safety: dam bao moi atom co userId khop voi userId argument.
  for (const a of atoms) {
    if (a.userId !== userId) {
      throw new Error(
        `createMany: atom userId mismatch (atom=${a.userId}, arg=${userId})`,
      );
    }
  }
  const data: Prisma.AtomCreateManyInput[] = atoms.map((a) => ({
    userId: a.userId,
    assetId: a.assetId,
    kind: a.kind,
    // content + evidenceSpan la Json column; Prisma chap nhan plain object.
    content: a.content as Prisma.InputJsonValue,
    evidenceSpan: a.evidenceSpan as unknown as Prisma.InputJsonValue,
    confidence: a.confidence,
    canonicalSkillId: a.canonicalSkillId ?? null,
    promptVersion,
  }));
  return db.atom.createMany({ data });
}

export interface FindByUserOptions {
  kind?: AtomKind;
  limit?: number;
  offset?: number;
}

/**
 * Liet ke atoms cua 1 user, optional filter kind + paging.
 * Sort theo createdAt desc (atom moi nhat hien dau).
 */
export function findByUserId(
  db: Db,
  userId: string,
  opts: FindByUserOptions = {},
): Promise<Atom[]> {
  return db.atom.findMany({
    where: {
      userId,
      ...(opts.kind ? { kind: opts.kind } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 100,
    skip: opts.offset ?? 0,
  });
}

/** Tim 1 atom theo id, chi tra ve neu thuoc user. */
export function findById(db: Db, id: string, userId: string): Promise<Atom | null> {
  return db.atom.findFirst({ where: { id, userId } });
}

/** Patch atom (vd user verify, sua content). Enforce ownership qua WHERE. */
export async function updateById(
  db: Db,
  id: string,
  userId: string,
  patch: AtomUpdateInput,
): Promise<Atom> {
  const data: Prisma.AtomUpdateInput = {};
  if (patch.content !== undefined) {
    data.content = patch.content as Prisma.InputJsonValue;
  }
  if (patch.confidence !== undefined) data.confidence = patch.confidence;
  if (patch.canonicalSkillId !== undefined) {
    // Prisma update input dung relation; map FK -> connect/disconnect.
    data.canonicalSkill = patch.canonicalSkillId
      ? { connect: { id: patch.canonicalSkillId } }
      : { disconnect: true };
  }
  if (patch.isVerified !== undefined) data.isVerified = patch.isVerified;

  // Prisma update WHERE chi nhan unique (id). Phai 2-step: findFirst de assert
  // ownership, roi update theo id. Tranh leak data sang user khac.
  const existing = await db.atom.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) {
    throw new Error(`Atom ${id} not found for user ${userId}`);
  }
  return db.atom.update({ where: { id }, data });
}

/** Xoa atom (hard delete). Enforce ownership. */
export async function deleteById(
  db: Db,
  id: string,
  userId: string,
): Promise<void> {
  const existing = await db.atom.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) {
    throw new Error(`Atom ${id} not found for user ${userId}`);
  }
  await db.atom.delete({ where: { id } });
}

/** Dem tong so atom cua user. */
export function countByUserId(db: Db, userId: string): Promise<number> {
  return db.atom.count({ where: { userId } });
}
