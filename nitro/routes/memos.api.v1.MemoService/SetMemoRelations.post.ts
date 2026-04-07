import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, memoRelation } from "../../store/db/schema";
import { eq, inArray } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string; relations?: any[] };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db.select({ id: memoTable.id }).from(memoTable).where(eq(memoTable.uid, uid)).limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  await db.delete(memoRelation).where(eq(memoRelation.memoId, memos[0].id));

  const relUids = (body.relations || []).map((rel) => rel.relatedMemo?.replace("memos/", "")).filter(Boolean) as string[];

  if (relUids.length > 0) {
    const relMemos = await db.select({ id: memoTable.id, uid: memoTable.uid }).from(memoTable).where(inArray(memoTable.uid, relUids));
    const relMemoMap = new Map(relMemos.map((m) => [m.uid, m.id]));

    for (const rel of body.relations || []) {
      const relUid = rel.relatedMemo?.replace("memos/", "");
      if (!relUid) continue;
      const relMemoId = relMemoMap.get(relUid);
      if (!relMemoId) continue;
      await db.insert(memoRelation).values({ memoId: memos[0].id, relatedMemoId: relMemoId, type: rel.type || "REFERENCE" }).onConflictDoNothing();
    }
  }

  return {};
});
