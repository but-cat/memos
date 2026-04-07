import { defineEventHandler, readBody } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, user as userTable } from "../../store/db/schema";
import { eq, and, or, desc, lt, sql } from "drizzle-orm";
import { convertMemo } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { pageSize?: number; pageToken?: string; filter?: string; state?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const pageSize = Math.min(body.pageSize || 20, 100);
  const conditions: any[] = [];

  if (!currentUser) {
    conditions.push(eq(memoTable.visibility, "PUBLIC"));
  } else if (currentUser.role !== "ADMIN") {
    conditions.push(
      or(
        eq(memoTable.visibility, "PUBLIC"),
        eq(memoTable.visibility, "PROTECTED"),
        and(eq(memoTable.visibility, "PRIVATE"), eq(memoTable.creatorId, currentUser.id)),
      ),
    );
  }

  if (body.state === "ARCHIVED") {
    conditions.push(eq(memoTable.rowStatus, "ARCHIVED"));
  } else {
    conditions.push(eq(memoTable.rowStatus, "NORMAL"));
  }

  if (body.filter) {
    const creatorMatch = body.filter.match(/creator\s*==\s*"([^"]+)"/);
    if (creatorMatch) {
      const username = creatorMatch[1].replace("users/", "");
      const users = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.username, username)).limit(1);
      if (users[0]) conditions.push(eq(memoTable.creatorId, users[0].id));
    }
    const tagMatch = body.filter.match(/tag\s*==\s*"([^"]+)"/);
    if (tagMatch) {
      const tagParam = `%"${tagMatch[1]}"%`;
      conditions.push(sql`json_extract(${memoTable.payload}, '$.tags') LIKE ${tagParam}`);
    }
  }

  if (body.pageToken) {
    conditions.push(lt(memoTable.id, parseInt(body.pageToken)));
  }

  const memos = await db
    .select({
      id: memoTable.id, uid: memoTable.uid, creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs, updatedTs: memoTable.updatedTs, rowStatus: memoTable.rowStatus,
      content: memoTable.content, visibility: memoTable.visibility, pinned: memoTable.pinned,
      payload: memoTable.payload, creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(memoTable.pinned), desc(memoTable.createdTs))
    .limit(pageSize + 1);

  const hasMore = memos.length > pageSize;
  const resultMemos = hasMore ? memos.slice(0, pageSize) : memos;
  const nextPageToken = hasMore ? String(resultMemos[resultMemos.length - 1].id) : "";

  return { memos: resultMemos.map(convertMemo), nextPageToken };
});
