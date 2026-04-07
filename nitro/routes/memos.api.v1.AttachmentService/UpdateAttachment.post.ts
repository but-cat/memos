import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { attachment as attachmentTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { convertAttachment } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { attachment?: any; updateMask?: { paths: string[] } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.attachment?.name?.replace("attachments/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid attachment name" });

  const attachments = await db.select().from(attachmentTable).where(eq(attachmentTable.uid, uid)).limit(1);
  if (!attachments[0]) throw createError({ statusCode: 404, message: "Attachment not found" });
  if (attachments[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const updates: Partial<typeof attachmentTable.$inferInsert> = { updatedTs: new Date() };
  const attachmentData = body.attachment || {};
  if (attachmentData.filename !== undefined) updates.filename = attachmentData.filename;
  if (attachmentData.memoId !== undefined) updates.memoId = attachmentData.memoId;

  const [updated] = await db.update(attachmentTable).set(updates).where(eq(attachmentTable.uid, uid)).returning();
  return { attachment: convertAttachment(updated) };
});
