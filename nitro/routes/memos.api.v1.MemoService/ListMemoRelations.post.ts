import { defineEventHandler, readBody } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, memoRelation } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) return { relations: [] };

  const memos = await db.select({ id: memoTable.id }).from(memoTable).where(eq(memoTable.uid, uid)).limit(1);
  if (!memos[0]) return { relations: [] };

  const relations = await db
    .select({ type: memoRelation.type, relatedUid: memoTable.uid })
    .from(memoRelation)
    .leftJoin(memoTable, eq(memoRelation.relatedMemoId, memoTable.id))
    .where(eq(memoRelation.memoId, memos[0].id));

  return {
    relations: relations.map((r) => ({ memo: `memos/${uid}`, relatedMemo: `memos/${r.relatedUid}`, type: r.type })),
  };
});
