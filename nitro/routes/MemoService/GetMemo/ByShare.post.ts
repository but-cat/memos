import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { memo as memoTable, memoShare, user as userTable } from "../../../store/db/schema";
import { eq } from "drizzle-orm";
import { convertMemo } from "../../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { shareToken?: string };
  const db = getDB();

  const share = await db.select().from(memoShare).where(eq(memoShare.uid, body.shareToken || "")).limit(1);
  if (!share[0]) throw createError({ statusCode: 404, message: "Share not found" });

  const expTs = share[0].expiresTs;
  if (expTs) {
    const expDate = expTs instanceof Date ? expTs : new Date(Number(expTs) * 1000);
    if (new Date() > expDate) throw createError({ statusCode: 410, message: "Share expired" });
  }

  const memos = await db
    .select({
      id: memoTable.id, uid: memoTable.uid, creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs, updatedTs: memoTable.updatedTs, rowStatus: memoTable.rowStatus,
      content: memoTable.content, visibility: memoTable.visibility, pinned: memoTable.pinned,
      payload: memoTable.payload, creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(eq(memoTable.id, share[0].memoId))
    .limit(1);

  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });
  return { memo: convertMemo(memos[0]) };
});
