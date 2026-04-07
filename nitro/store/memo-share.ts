import { eq, and } from "drizzle-orm";
import { memoShare as memoShareTable } from "./db/schema";
import type { DrizzleDB } from "./db/db";
import type { MemoShare, FindMemoShare, DeleteMemoShare } from "./types";

function rowToMemoShare(row: typeof memoShareTable.$inferSelect): MemoShare {
  return {
    id: row.id,
    uid: row.uid,
    memoId: row.memoId,
    creatorId: row.creatorId,
    createdTs: row.createdTs instanceof Date ? Math.floor(row.createdTs.getTime() / 1000) : Number(row.createdTs),
    expiresTs: row.expiresTs instanceof Date
      ? Math.floor(row.expiresTs.getTime() / 1000)
      : row.expiresTs != null ? Number(row.expiresTs) : null,
  };
}

export async function createMemoShare(
  db: DrizzleDB,
  create: Omit<MemoShare, "id">,
): Promise<MemoShare> {
  const [row] = await db
    .insert(memoShareTable)
    .values({
      uid: create.uid,
      memoId: create.memoId,
      creatorId: create.creatorId,
      createdTs: new Date(create.createdTs * 1000),
      expiresTs: create.expiresTs != null ? new Date(create.expiresTs * 1000) : null,
    })
    .returning();
  return rowToMemoShare(row);
}

export async function listMemoShares(
  db: DrizzleDB,
  find: FindMemoShare,
): Promise<MemoShare[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) conditions.push(eq(memoShareTable.id, find.id));
  if (find.uid !== undefined) conditions.push(eq(memoShareTable.uid, find.uid));
  if (find.memoId !== undefined) conditions.push(eq(memoShareTable.memoId, find.memoId));

  const rows = await db
    .select()
    .from(memoShareTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToMemoShare);
}

export async function getMemoShare(
  db: DrizzleDB,
  find: FindMemoShare,
): Promise<MemoShare | null> {
  const rows = await listMemoShares(db, find);
  return rows[0] ?? null;
}

export async function deleteMemoShare(
  db: DrizzleDB,
  del: DeleteMemoShare,
): Promise<void> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (del.id !== undefined) conditions.push(eq(memoShareTable.id, del.id));
  if (del.uid !== undefined) conditions.push(eq(memoShareTable.uid, del.uid));

  if (conditions.length === 0) return;

  await db
    .delete(memoShareTable)
    .where(and(...conditions));
}
