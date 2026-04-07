import { eq, and, inArray } from "drizzle-orm";
import { memoRelation as memoRelationTable } from "../db/schema";
import type { DrizzleDB } from "../utils/db";
import type { MemoRelation, FindMemoRelation, DeleteMemoRelation } from "./types";

function rowToMemoRelation(row: typeof memoRelationTable.$inferSelect): MemoRelation {
  return {
    memoId: row.memoId,
    relatedMemoId: row.relatedMemoId,
    type: row.type as MemoRelation["type"],
  };
}

export async function upsertMemoRelation(
  db: DrizzleDB,
  rel: MemoRelation,
): Promise<MemoRelation> {
  await db
    .insert(memoRelationTable)
    .values({ memoId: rel.memoId, relatedMemoId: rel.relatedMemoId, type: rel.type })
    .onConflictDoUpdate({
      target: [memoRelationTable.memoId, memoRelationTable.relatedMemoId, memoRelationTable.type],
      set: { type: rel.type },
    });
  return rel;
}

export async function listMemoRelations(
  db: DrizzleDB,
  find: FindMemoRelation,
): Promise<MemoRelation[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.memoId !== undefined) conditions.push(eq(memoRelationTable.memoId, find.memoId));
  if (find.relatedMemoId !== undefined) conditions.push(eq(memoRelationTable.relatedMemoId, find.relatedMemoId));
  if (find.type !== undefined) conditions.push(eq(memoRelationTable.type, find.type));
  if (find.memoIdList && find.memoIdList.length > 0) {
    conditions.push(inArray(memoRelationTable.memoId, find.memoIdList));
  }

  const rows = await db
    .select()
    .from(memoRelationTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToMemoRelation);
}

export async function deleteMemoRelation(
  db: DrizzleDB,
  del: DeleteMemoRelation,
): Promise<void> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (del.memoId !== undefined) conditions.push(eq(memoRelationTable.memoId, del.memoId));
  if (del.relatedMemoId !== undefined) conditions.push(eq(memoRelationTable.relatedMemoId, del.relatedMemoId));
  if (del.type !== undefined) conditions.push(eq(memoRelationTable.type, del.type));

  if (conditions.length === 0) return;

  await db
    .delete(memoRelationTable)
    .where(and(...conditions));
}
