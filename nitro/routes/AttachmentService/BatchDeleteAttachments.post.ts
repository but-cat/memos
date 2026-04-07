import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { attachment as attachmentTable } from "../../store/db/schema";
import { inArray } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { names?: string[] };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const names = body.names || [];
  if (names.length === 0) return {};
  if (names.length > 20) throw createError({ statusCode: 400, message: "Too many attachments (max 20)" });

  const uids = names.map((n) => n.replace("attachments/", "")).filter(Boolean);
  if (uids.length === 0) return {};

  const db = getDB();
  const existing = await db.select({ uid: attachmentTable.uid, creatorId: attachmentTable.creatorId })
    .from(attachmentTable).where(inArray(attachmentTable.uid, uids));

  for (const a of existing) {
    if (a.creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
      throw createError({ statusCode: 403, message: "Permission denied" });
    }
  }

  await db.delete(attachmentTable).where(inArray(attachmentTable.uid, uids));
  return {};
});
