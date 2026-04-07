import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { attachment as attachmentTable } from "../../store/db/schema";
import { eq, desc } from "drizzle-orm";
import { convertAttachment } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { pageSize?: number; pageToken?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const pageSize = Math.min(body.pageSize || 20, 100);

  const attachments = await db
    .select({
      id: attachmentTable.id, uid: attachmentTable.uid, creatorId: attachmentTable.creatorId,
      createdTs: attachmentTable.createdTs, updatedTs: attachmentTable.updatedTs,
      filename: attachmentTable.filename, type: attachmentTable.type, size: attachmentTable.size,
      memoId: attachmentTable.memoId, storageType: attachmentTable.storageType,
      reference: attachmentTable.reference, payload: attachmentTable.payload,
    })
    .from(attachmentTable)
    .where(eq(attachmentTable.creatorId, currentUser.id))
    .orderBy(desc(attachmentTable.createdTs))
    .limit(pageSize);

  return { attachments: attachments.map(convertAttachment) };
});
