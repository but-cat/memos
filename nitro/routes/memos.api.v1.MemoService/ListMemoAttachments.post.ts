import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, attachment as attachmentTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { tsToISO } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db.select({ id: memoTable.id, visibility: memoTable.visibility, creatorId: memoTable.creatorId })
    .from(memoTable).where(eq(memoTable.uid, uid)).limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  const memo = memos[0];
  if (memo.visibility === "PRIVATE") {
    if (!currentUser || (currentUser.id !== memo.creatorId && currentUser.role !== "ADMIN")) {
      throw createError({ statusCode: 403, message: "Permission denied" });
    }
  } else if (memo.visibility === "PROTECTED" && !currentUser) {
    throw createError({ statusCode: 401, message: "Unauthenticated" });
  }

  const attachments = await db
    .select({ uid: attachmentTable.uid, createdTs: attachmentTable.createdTs, filename: attachmentTable.filename, type: attachmentTable.type, size: attachmentTable.size, storageType: attachmentTable.storageType, reference: attachmentTable.reference })
    .from(attachmentTable).where(eq(attachmentTable.memoId, memo.id));

  return {
    attachments: attachments.map((a) => ({
      name: `attachments/${a.uid}`, uid: a.uid, createTime: tsToISO(a.createdTs),
      filename: a.filename, type: a.type, size: a.size, storageType: a.storageType, reference: a.reference,
    })),
  };
});
