import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { userSetting } from "../../../store/db/schema";
import { eq } from "drizzle-orm";
import { getUserByUsername } from "../../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { parent?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.parent?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid parent" });

  const targetUser = await getUserByUsername(db, username);
  if (!targetUser) throw createError({ statusCode: 404, message: "User not found" });

  if (targetUser.id !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const rows = await db.select().from(userSetting).where(eq(userSetting.userId, targetUser.id));
  const userSettings = rows.map((row) => {
    let parsed: any = null;
    try { parsed = JSON.parse(row.value); } catch { /* ignore */ }
    return { name: `users/${username}/settings/${row.key}`, userId: row.userId, key: row.key, value: parsed };
  });

  return { userSettings };
});
