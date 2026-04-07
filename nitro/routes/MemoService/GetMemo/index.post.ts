import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { memo as memoTable, user as userTable } from "../../../store/db/schema";
import { eq } from "drizzle-orm";
import { convertMemo } from "../../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db
    .select({
      id: memoTable.id, uid: memoTable.uid, creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs, updatedTs: memoTable.updatedTs, rowStatus: memoTable.rowStatus,
      content: memoTable.content, visibility: memoTable.visibility, pinned: memoTable.pinned,
      payload: memoTable.payload, creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(eq(memoTable.uid, uid))
    .limit(1);

  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });
  const memo = memos[0];

  if (memo.visibility === "PRIVATE" && (!currentUser || currentUser.id !== memo.creatorId)) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }
  if (memo.visibility === "PROTECTED" && !currentUser) {
    throw createError({ statusCode: 401, message: "Unauthenticated" });
  }

  return { memo: convertMemo(memo) };
});
