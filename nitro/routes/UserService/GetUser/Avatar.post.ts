import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { user as userTable } from "../../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  const users = await db.select({ avatarUrl: userTable.avatarUrl }).from(userTable).where(eq(userTable.username, username)).limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  return { avatarUrl: users[0].avatarUrl };
});
