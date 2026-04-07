import { eq, and, inArray, like, isNotNull } from "drizzle-orm";
import { attachment as attachmentTable } from "./db/schema";
import type { DrizzleDB } from "./db/db";
import type {
  Attachment,
  FindAttachment,
  UpdateAttachment,
  DeleteAttachment,
  AttachmentPayload,
  AttachmentStorageType,
} from "./types";

function rowToAttachment(row: typeof attachmentTable.$inferSelect): Attachment {
  let payload: AttachmentPayload | undefined;
  try {
    payload = JSON.parse(row.payload || "{}") as AttachmentPayload;
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    uid: row.uid,
    creatorId: row.creatorId,
    createdTs: row.createdTs instanceof Date ? Math.floor(row.createdTs.getTime() / 1000) : Number(row.createdTs),
    updatedTs: row.updatedTs instanceof Date ? Math.floor(row.updatedTs.getTime() / 1000) : Number(row.updatedTs),
    filename: row.filename,
    blob: row.blob as Uint8Array | null,
    type: row.type,
    size: row.size,
    storageType: row.storageType as AttachmentStorageType,
    reference: row.reference,
    payload,
    memoId: row.memoId,
  };
}

export async function createAttachment(
  db: DrizzleDB,
  create: Omit<Attachment, "id">,
): Promise<Attachment> {
  const [row] = await db
    .insert(attachmentTable)
    .values({
      uid: create.uid,
      creatorId: create.creatorId,
      createdTs: new Date(create.createdTs * 1000),
      updatedTs: new Date(create.updatedTs * 1000),
      filename: create.filename,
      blob: create.blob as Buffer | null,
      type: create.type,
      size: create.size,
      storageType: create.storageType,
      reference: create.reference,
      payload: JSON.stringify(create.payload ?? {}),
      memoId: create.memoId ?? null,
    })
    .returning();
  return rowToAttachment(row);
}

export async function listAttachments(
  db: DrizzleDB,
  find: FindAttachment,
): Promise<Attachment[]> {
  // Build select — exclude blob unless requested
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) conditions.push(eq(attachmentTable.id, find.id));
  if (find.uid !== undefined) conditions.push(eq(attachmentTable.uid, find.uid));
  if (find.creatorId !== undefined) conditions.push(eq(attachmentTable.creatorId, find.creatorId));
  if (find.filename !== undefined) conditions.push(eq(attachmentTable.filename, find.filename));
  if (find.filenameSearch !== undefined) {
    conditions.push(like(attachmentTable.filename, `%${find.filenameSearch}%`));
  }
  if (find.memoId !== undefined) conditions.push(eq(attachmentTable.memoId, find.memoId));
  if (find.memoIdList && find.memoIdList.length > 0) {
    conditions.push(inArray(attachmentTable.memoId, find.memoIdList));
  }
  if (find.storageType !== undefined) conditions.push(eq(attachmentTable.storageType, find.storageType));
  if (find.hasRelatedMemo) {
    conditions.push(isNotNull(attachmentTable.memoId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let query = db.select().from(attachmentTable).where(whereClause);

  if (find.offset !== undefined) query = query.offset(find.offset) as typeof query;
  if (find.limit !== undefined) query = query.limit(find.limit) as typeof query;

  const rows = await query;

  return rows.map((row) => {
    const a = rowToAttachment(row);
    // Strip blob if not requested
    if (!find.getBlob) {
      a.blob = null;
    }
    return a;
  });
}

export async function updateAttachment(
  db: DrizzleDB,
  update: UpdateAttachment,
): Promise<void> {
  const setFields: Partial<typeof attachmentTable.$inferInsert> = {};

  if (update.uid !== undefined) setFields.uid = update.uid;
  if (update.updatedTs !== undefined) {
    setFields.updatedTs = new Date(update.updatedTs * 1000);
  } else {
    setFields.updatedTs = new Date();
  }
  if (update.filename !== undefined) setFields.filename = update.filename;
  if (update.memoId !== undefined) setFields.memoId = update.memoId;
  if (update.reference !== undefined) setFields.reference = update.reference;
  if (update.payload !== undefined) setFields.payload = JSON.stringify(update.payload);

  await db
    .update(attachmentTable)
    .set(setFields)
    .where(eq(attachmentTable.id, update.id));
}

export async function deleteAttachment(
  db: DrizzleDB,
  del: DeleteAttachment,
): Promise<void> {
  const conditions: ReturnType<typeof eq>[] = [eq(attachmentTable.id, del.id)];
  if (del.memoId !== undefined) {
    conditions.push(eq(attachmentTable.memoId, del.memoId));
  }
  await db
    .delete(attachmentTable)
    .where(and(...conditions));
}

export async function deleteAttachments(
  db: DrizzleDB,
  dels: DeleteAttachment[],
): Promise<void> {
  for (const del of dels) {
    await deleteAttachment(db, del);
  }
}
