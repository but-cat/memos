import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { extractTags } from "../../utils/helpers";
import { convertMemo } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { memo?: any; updateMask?: { paths: string[] } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.memo?.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const existing = await db.select().from(memoTable).where(eq(memoTable.uid, uid)).limit(1);
  if (!existing[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  if (existing[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const memoData = body.memo || {};
  const updates: Partial<typeof memoTable.$inferInsert> = { updatedTs: new Date() };

  if (memoData.content !== undefined) {
    updates.content = memoData.content;
    const payload: any = {};
    try { Object.assign(payload, JSON.parse(existing[0].payload || "{}")); } catch { /* ignore */ }
    payload.tags = extractTags(memoData.content);
    updates.payload = JSON.stringify(payload);
  }
  if (memoData.visibility !== undefined) updates.visibility = memoData.visibility;
  if (memoData.pinned !== undefined) updates.pinned = memoData.pinned;
  if (memoData.rowStatus !== undefined) updates.rowStatus = memoData.rowStatus;

  const [updated] = await db.update(memoTable).set(updates).where(eq(memoTable.uid, uid)).returning();
  return { memo: convertMemo({ ...updated, creatorUsername: currentUser.username }) };
});
