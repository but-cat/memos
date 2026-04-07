import { defineEventHandler } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable, memo as memoTable } from "../../store/db/schema";
import { eq, and, sql } from "drizzle-orm";

export default defineEventHandler(async (_event) => {
  const db = getDB();
  const rows = await db
    .select({
      username: userTable.username,
      memoCount: sql<number>`COUNT(${memoTable.id})`.as("memo_count"),
    })
    .from(userTable)
    .leftJoin(memoTable, and(eq(memoTable.creatorId, userTable.id), eq(memoTable.rowStatus, "NORMAL")))
    .groupBy(userTable.id, userTable.username);

  return {
    userStats: rows.map((r) => ({ name: `users/${r.username}`, memoCount: Number(r.memoCount) })),
  };
});
