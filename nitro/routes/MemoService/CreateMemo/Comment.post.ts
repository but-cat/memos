import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { memo as memoTable, memoRelation } from "../../../store/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { convertMemo } from "../../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string; comment?: any; commentId?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const parentUid = body.name?.replace("memos/", "").replace("/comments", "");
  if (!parentUid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const parent = await db.select({ id: memoTable.id }).from(memoTable).where(eq(memoTable.uid, parentUid)).limit(1);
  if (!parent[0]) throw createError({ statusCode: 404, message: "Parent memo not found" });

  const uid = body.commentId || nanoid(8).toLowerCase();
  const memoData = body.comment || {};

  const [newMemo] = await db.insert(memoTable).values({
    uid,
    creatorId: currentUser.id,
    content: memoData.content || "",
    visibility: memoData.visibility || "PRIVATE",
    payload: JSON.stringify({ tags: [] }),
  }).returning();

  await db.insert(memoRelation).values({ memoId: newMemo.id, relatedMemoId: parent[0].id, type: "COMMENT" });

  return { memo: convertMemo({ ...newMemo, creatorUsername: currentUser.username }) };
});
