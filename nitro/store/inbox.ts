import { eq, and } from "drizzle-orm";
import { inbox as inboxTable } from "../db/schema";
import type { DrizzleDB } from "../utils/db";
import type { Inbox, FindInbox, UpdateInbox, DeleteInbox, InboxMessage, InboxStatus } from "./types";

function rowToInbox(row: typeof inboxTable.$inferSelect): Inbox {
  let message: InboxMessage | undefined;
  try {
    message = JSON.parse(row.message || "{}") as InboxMessage;
  } catch {
    message = {};
  }
  return {
    id: row.id,
    createdTs: row.createdTs instanceof Date ? Math.floor(row.createdTs.getTime() / 1000) : Number(row.createdTs),
    senderId: row.senderId,
    receiverId: row.receiverId,
    status: row.status as InboxStatus,
    message,
  };
}

export async function createInbox(
  db: DrizzleDB,
  create: Omit<Inbox, "id">,
): Promise<Inbox> {
  const [row] = await db
    .insert(inboxTable)
    .values({
      createdTs: new Date(create.createdTs * 1000),
      senderId: create.senderId,
      receiverId: create.receiverId,
      status: create.status,
      message: JSON.stringify(create.message ?? {}),
    })
    .returning();
  return rowToInbox(row);
}

export async function listInboxes(
  db: DrizzleDB,
  find: FindInbox,
): Promise<Inbox[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) conditions.push(eq(inboxTable.id, find.id));
  if (find.senderId !== undefined) conditions.push(eq(inboxTable.senderId, find.senderId));
  if (find.receiverId !== undefined) conditions.push(eq(inboxTable.receiverId, find.receiverId));
  if (find.status !== undefined) conditions.push(eq(inboxTable.status, find.status));

  let query = db
    .select()
    .from(inboxTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  if (find.offset !== undefined) query = query.offset(find.offset) as typeof query;
  if (find.limit !== undefined) query = query.limit(find.limit) as typeof query;

  const rows = await query;

  return rows
    .filter((row) => {
      // Filter by message type if requested
      if (find.messageType !== undefined) {
        let msg: InboxMessage = {};
        try { msg = JSON.parse(row.message || "{}"); } catch { /* ignore */ }
        return msg.type === find.messageType;
      }
      return true;
    })
    .map(rowToInbox);
}

export async function updateInbox(
  db: DrizzleDB,
  update: UpdateInbox,
): Promise<Inbox> {
  const [row] = await db
    .update(inboxTable)
    .set({ status: update.status })
    .where(eq(inboxTable.id, update.id))
    .returning();
  return rowToInbox(row);
}

export async function deleteInbox(
  db: DrizzleDB,
  del: DeleteInbox,
): Promise<void> {
  await db.delete(inboxTable).where(eq(inboxTable.id, del.id));
}
