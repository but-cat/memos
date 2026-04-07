import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { user as userTable, memo as memoTable } from "../../../store/db/schema";
import { eq, and, count } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  const users = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.username, username)).limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  const userId = users[0].id;
  const memoCount = await db.select({ cnt: count() }).from(memoTable)
    .where(and(eq(memoTable.creatorId, userId), eq(memoTable.rowStatus, "NORMAL")));

  return { name: `users/${username}`, memoCount: memoCount[0].cnt, tagCount: 0 };
});
