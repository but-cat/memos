import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, attachment as attachmentTable } from "../../store/db/schema";
import { eq, inArray } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string; attachments?: Array<{ name: string }> };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db.select({ id: memoTable.id, creatorId: memoTable.creatorId }).from(memoTable).where(eq(memoTable.uid, uid)).limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });
  if (memos[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const requestedUids = (body.attachments || []).map((a) => a.name?.replace("attachments/", "")).filter(Boolean) as string[];

  await db.update(attachmentTable).set({ memoId: null }).where(eq(attachmentTable.memoId, memos[0].id));

  if (requestedUids.length > 0) {
    await db.update(attachmentTable).set({ memoId: memos[0].id }).where(inArray(attachmentTable.uid, requestedUids));
  }

  return {};
});
