import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable } from "../../store/db/schema";
import { nanoid } from "nanoid";
import { extractTags } from "../../utils/helpers";
import { convertMemo } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const body = (await readBody(event)) as { memo?: any; memoId?: string };
  const db = getDB();

  const uid = body.memoId || nanoid(8).toLowerCase();
  const memoData = body.memo || {};

  const payload: any = { tags: [], property: {} };
  if (memoData.location) payload.location = memoData.location;
  payload.tags = extractTags(memoData.content || "");

  const insertData: any = {
    uid,
    creatorId: currentUser.id,
    content: memoData.content || "",
    visibility: memoData.visibility || "PRIVATE",
    pinned: memoData.pinned || false,
    payload: JSON.stringify(payload),
  };
  if (memoData.createTime) insertData.createdTs = new Date(memoData.createTime);
  if (memoData.updateTime) insertData.updatedTs = new Date(memoData.updateTime);

  const [newMemo] = await db.insert(memoTable).values(insertData).returning();

  return { memo: convertMemo({ ...newMemo, creatorUsername: currentUser.username }) };
});
