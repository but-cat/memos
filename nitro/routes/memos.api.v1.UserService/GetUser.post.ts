import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { convertUser } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  const users = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  return { user: convertUser(users[0], currentUser) };
});
