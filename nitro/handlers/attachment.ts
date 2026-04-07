import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../store/db/db";
import { attachment as attachmentTable } from "../store/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(Number(val) * 1000).toISOString();
}

function convertAttachment(a: any) {
  return {
    name: `attachments/${a.uid}`,
    uid: a.uid,
    createTime: tsToISO(a.createdTs),
    updateTime: tsToISO(a.updatedTs),
    filename: a.filename,
    content: a.blob ? Buffer.from(a.blob).toString("base64") : undefined,
    externalLink:
      a.storageType !== "LOCAL" && a.storageType !== "DATABASE"
        ? a.reference
        : undefined,
    type: a.type,
    size: a.size,
    memo: a.memoId ? `memos/${a.memoId}` : undefined,
    storageType: a.storageType,
    reference: a.reference,
  };
}

export async function handleAttachmentService(method: string, event: H3Event) {
  switch (method) {
    case "CreateAttachment":
      return createAttachment(event);
    case "ListAttachments":
      return listAttachments(event);
    case "GetAttachment":
      return getAttachment(event);
    case "UpdateAttachment":
      return updateAttachment(event);
    case "DeleteAttachment":
      return deleteAttachment(event);
    case "BatchDeleteAttachments":
      return batchDeleteAttachments(event);
    default:
      throw createError({
        statusCode: 404,
        message: `AttachmentService.${method} not found`,
      });
  }
}

async function createAttachment(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const body = (await readBody(event)) as {
    attachment?: { filename?: string; content?: string; type?: string };
  };

  const db = getDB();
  const uid = nanoid(8).toLowerCase();
  const attachmentData = body.attachment || {};

  let blobData: Buffer | null = null;
  let size = 0;

  if (attachmentData.content) {
    blobData = Buffer.from(attachmentData.content, "base64");
    size = blobData.length;
  }

  const [newAttachment] = await db
    .insert(attachmentTable)
    .values({
      uid,
      creatorId: currentUser.id,
      filename: attachmentData.filename || "unknown",
      blob: blobData,
      type: attachmentData.type || "application/octet-stream",
      size,
      storageType: "DATABASE",
      reference: "",
      payload: "{}",
    })
    .returning();

  return { attachment: convertAttachment(newAttachment) };
}

async function listAttachments(event: H3Event) {
  const body = (await readBody(event)) as {
    pageSize?: number;
    pageToken?: string;
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const pageSize = Math.min(body.pageSize || 20, 100);

  const attachments = await db
    .select({
      id: attachmentTable.id,
      uid: attachmentTable.uid,
      creatorId: attachmentTable.creatorId,
      createdTs: attachmentTable.createdTs,
      updatedTs: attachmentTable.updatedTs,
      filename: attachmentTable.filename,
      type: attachmentTable.type,
      size: attachmentTable.size,
      memoId: attachmentTable.memoId,
      storageType: attachmentTable.storageType,
      reference: attachmentTable.reference,
      payload: attachmentTable.payload,
    })
    .from(attachmentTable)
    .where(eq(attachmentTable.creatorId, currentUser.id))
    .orderBy(desc(attachmentTable.createdTs))
    .limit(pageSize);

  return { attachments: attachments.map(convertAttachment) };
}

async function getAttachment(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("attachments/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid attachment name" });

  const attachments = await db
    .select()
    .from(attachmentTable)
    .where(eq(attachmentTable.uid, uid))
    .limit(1);
  if (!attachments[0])
    throw createError({ statusCode: 404, message: "Attachment not found" });

  return { attachment: convertAttachment(attachments[0]) };
}

async function updateAttachment(event: H3Event) {
  const body = (await readBody(event)) as {
    attachment?: any;
    updateMask?: { paths: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.attachment?.name?.replace("attachments/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid attachment name" });

  const attachments = await db
    .select()
    .from(attachmentTable)
    .where(eq(attachmentTable.uid, uid))
    .limit(1);
  if (!attachments[0])
    throw createError({ statusCode: 404, message: "Attachment not found" });
  if (
    attachments[0].creatorId !== currentUser.id &&
    currentUser.role !== "ADMIN"
  ) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const updates: Partial<typeof attachmentTable.$inferInsert> = {
    updatedTs: new Date(),
  };
  const attachmentData = body.attachment || {};
  if (attachmentData.filename !== undefined)
    updates.filename = attachmentData.filename;
  if (attachmentData.memoId !== undefined)
    updates.memoId = attachmentData.memoId;

  const [updated] = await db
    .update(attachmentTable)
    .set(updates)
    .where(eq(attachmentTable.uid, uid))
    .returning();
  return { attachment: convertAttachment(updated) };
}

async function deleteAttachment(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("attachments/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid attachment name" });

  const attachments = await db
    .select()
    .from(attachmentTable)
    .where(eq(attachmentTable.uid, uid))
    .limit(1);
  if (!attachments[0])
    throw createError({ statusCode: 404, message: "Attachment not found" });
  if (
    attachments[0].creatorId !== currentUser.id &&
    currentUser.role !== "ADMIN"
  ) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  await db.delete(attachmentTable).where(eq(attachmentTable.uid, uid));
  return {};
}

async function batchDeleteAttachments(event: H3Event) {
  const body = (await readBody(event)) as { names?: string[] };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const names = body.names || [];
  if (names.length === 0) return {};
  if (names.length > 20) throw createError({ statusCode: 400, message: "Too many attachments (max 20)" });

  const uids = names.map((n) => n.replace("attachments/", "")).filter(Boolean);
  if (uids.length === 0) return {};

  const db = getDB();
  const existing = await db
    .select({ uid: attachmentTable.uid, creatorId: attachmentTable.creatorId })
    .from(attachmentTable)
    .where(inArray(attachmentTable.uid, uids));

  for (const a of existing) {
    if (a.creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
      throw createError({ statusCode: 403, message: "Permission denied" });
    }
  }

  await db.delete(attachmentTable).where(inArray(attachmentTable.uid, uids));
  return {};
}
