import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { attachment as attachmentTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("attachments/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid attachment name" });

  const attachments = await db.select().from(attachmentTable).where(eq(attachmentTable.uid, uid)).limit(1);
  if (!attachments[0]) throw createError({ statusCode: 404, message: "Attachment not found" });
  if (attachments[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  await db.delete(attachmentTable).where(eq(attachmentTable.uid, uid));
  return {};
});
