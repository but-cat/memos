import { defineEventHandler, readBody } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, memoRelation, user as userTable } from "../../store/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { convertMemo } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("memos/", "").replace("/comments", "");
  if (!uid) return { memos: [] };

  const parent = await db.select({ id: memoTable.id }).from(memoTable).where(eq(memoTable.uid, uid)).limit(1);
  if (!parent[0]) return { memos: [] };

  const relations = await db.select().from(memoRelation).where(and(eq(memoRelation.relatedMemoId, parent[0].id), eq(memoRelation.type, "COMMENT")));
  if (!relations.length) return { memos: [] };

  const commentIds = relations.map((r) => r.memoId);
  const comments = await db
    .select({
      id: memoTable.id, uid: memoTable.uid, creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs, updatedTs: memoTable.updatedTs, rowStatus: memoTable.rowStatus,
      content: memoTable.content, visibility: memoTable.visibility, pinned: memoTable.pinned,
      payload: memoTable.payload, creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(inArray(memoTable.id, commentIds));

  return { memos: comments.map(convertMemo) };
});
