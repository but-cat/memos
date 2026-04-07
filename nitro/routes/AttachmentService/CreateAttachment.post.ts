import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { attachment as attachmentTable } from "../../store/db/schema";
import { nanoid } from "nanoid";
import { convertAttachment } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const body = (await readBody(event)) as { attachment?: { filename?: string; content?: string; type?: string } };
  const db = getDB();
  const uid = nanoid(8).toLowerCase();
  const attachmentData = body.attachment || {};

  let blobData: Buffer | null = null;
  let size = 0;
  if (attachmentData.content) {
    blobData = Buffer.from(attachmentData.content, "base64");
    size = blobData.length;
  }

  const [newAttachment] = await db.insert(attachmentTable).values({
    uid,
    creatorId: currentUser.id,
    filename: attachmentData.filename || "unknown",
    blob: blobData,
    type: attachmentData.type || "application/octet-stream",
    size,
    storageType: "DATABASE",
    reference: "",
    payload: "{}",
  }).returning();

  return { attachment: convertAttachment(newAttachment) };
});
