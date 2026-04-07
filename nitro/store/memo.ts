import { eq, and, or, inArray, desc, asc, notInArray, sql } from "drizzle-orm";
import { memo as memoTable, memoRelation } from "../db/schema";
import type { DrizzleDB } from "../utils/db";
import type { Memo, FindMemo, UpdateMemo, DeleteMemo, MemoPayload, Visibility } from "./types";

function rowToMemo(row: typeof memoTable.$inferSelect): Memo {
  let payload: MemoPayload | undefined;
  try {
    payload = JSON.parse(row.payload || "{}") as MemoPayload;
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    uid: row.uid,
    rowStatus: row.rowStatus,
    creatorId: row.creatorId,
    createdTs: row.createdTs instanceof Date ? Math.floor(row.createdTs.getTime() / 1000) : Number(row.createdTs),
    updatedTs: row.updatedTs instanceof Date ? Math.floor(row.updatedTs.getTime() / 1000) : Number(row.updatedTs),
    content: row.content,
    visibility: row.visibility,
    pinned: Boolean(row.pinned),
    payload,
  };
}

export async function createMemo(
  db: DrizzleDB,
  create: Omit<Memo, "id">,
): Promise<Memo> {
  const [row] = await db
    .insert(memoTable)
    .values({
      uid: create.uid,
      creatorId: create.creatorId,
      createdTs: new Date(create.createdTs * 1000),
      updatedTs: new Date(create.updatedTs * 1000),
      rowStatus: create.rowStatus,
      content: create.content,
      visibility: create.visibility,
      pinned: create.pinned,
      payload: JSON.stringify(create.payload ?? {}),
    })
    .returning();
  return rowToMemo(row);
}

export async function listMemos(
  db: DrizzleDB,
  find: FindMemo,
): Promise<Memo[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) conditions.push(eq(memoTable.id, find.id));
  if (find.uid !== undefined) conditions.push(eq(memoTable.uid, find.uid));
  if (find.idList && find.idList.length > 0) conditions.push(inArray(memoTable.id, find.idList));
  if (find.uidList && find.uidList.length > 0) conditions.push(inArray(memoTable.uid, find.uidList));
  if (find.rowStatus !== undefined) conditions.push(eq(memoTable.rowStatus, find.rowStatus));
  if (find.creatorId !== undefined) conditions.push(eq(memoTable.creatorId, find.creatorId));
  if (find.visibilityList && find.visibilityList.length > 0) {
    conditions.push(inArray(memoTable.visibility, find.visibilityList));
  }

  // Parse filters array (e.g. "creator == 'users/1'", "tag == 'foo'", "visibility == 'PUBLIC'")
  if (find.filters) {
    for (const filter of find.filters) {
      const creatorMatch = filter.match(/creator\s*==\s*['"]users\/(\d+)['"]/);
      if (creatorMatch) {
        conditions.push(eq(memoTable.creatorId, parseInt(creatorMatch[1], 10)));
      }
      const visibilityMatch = filter.match(/visibility\s*==\s*['"](\w+)['"]/);
      if (visibilityMatch) {
        conditions.push(eq(memoTable.visibility, visibilityMatch[1] as Visibility));
      }
      const tagMatch = filter.match(/tag\s*==\s*['"]([^'"]+)['"]/);
      if (tagMatch) {
        conditions.push(sql`json_extract(${memoTable.payload}, '$.tags') LIKE ${'%"' + tagMatch[1] + '"%'}`);
      }
    }
  }

  // ExcludeComments: exclude memos that have a COMMENT relation (are comments on other memos)
  if (find.excludeComments) {
    const commentMemoIds = await db
      .select({ memoId: memoRelation.memoId })
      .from(memoRelation)
      .where(eq(memoRelation.type, "COMMENT"));
    const ids = commentMemoIds.map((r) => r.memoId);
    if (ids.length > 0) {
      conditions.push(notInArray(memoTable.id, ids));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order-by
  const orderClauses = [];
  if (find.orderByPinned) {
    orderClauses.push(desc(memoTable.pinned));
  }
  const timeCol = find.orderByUpdatedTs ? memoTable.updatedTs : memoTable.createdTs;
  orderClauses.push(find.orderByTimeAsc ? asc(timeCol) : desc(timeCol));

  let query = db.select().from(memoTable).where(whereClause).orderBy(...orderClauses);

  if (find.offset !== undefined) query = query.offset(find.offset) as typeof query;
  if (find.limit !== undefined) query = query.limit(find.limit) as typeof query;

  const rows = await query;

  return rows.map((row) => {
    const m = rowToMemo(row);
    if (find.excludeContent) m.content = "";
    return m;
  });
}

export async function updateMemo(
  db: DrizzleDB,
  update: UpdateMemo,
): Promise<void> {
  const setFields: Partial<typeof memoTable.$inferInsert> = {};

  if (update.uid !== undefined) setFields.uid = update.uid;
  if (update.createdTs !== undefined) setFields.createdTs = new Date(update.createdTs * 1000);
  if (update.updatedTs !== undefined) {
    setFields.updatedTs = new Date(update.updatedTs * 1000);
  } else {
    setFields.updatedTs = new Date();
  }
  if (update.rowStatus !== undefined) setFields.rowStatus = update.rowStatus;
  if (update.content !== undefined) setFields.content = update.content;
  if (update.visibility !== undefined) setFields.visibility = update.visibility;
  if (update.pinned !== undefined) setFields.pinned = update.pinned;
  if (update.payload !== undefined) setFields.payload = JSON.stringify(update.payload);

  await db.update(memoTable).set(setFields).where(eq(memoTable.id, update.id));
}

export async function deleteMemo(
  db: DrizzleDB,
  del: DeleteMemo,
): Promise<void> {
  await db.delete(memoTable).where(eq(memoTable.id, del.id));
}
