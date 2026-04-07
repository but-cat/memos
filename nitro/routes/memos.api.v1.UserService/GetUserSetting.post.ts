import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable, userSetting } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.name?.replace("users/", "")?.replace("/setting", "");
  const targetUser = username
    ? (await db.select().from(userTable).where(eq(userTable.username, username)).limit(1))[0]
    : currentUser;

  if (!targetUser) throw createError({ statusCode: 404, message: "User not found" });
  if (targetUser.id !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const settings = await db.select().from(userSetting).where(eq(userSetting.userId, targetUser.id));
  const settingMap: Record<string, string> = {};
  for (const s of settings) settingMap[s.key] = s.value;

  return {
    name: `users/${targetUser.username}/setting`,
    locale: settingMap["locale"] || "en",
    appearance: settingMap["appearance"] || "system",
    memoVisibility: settingMap["memo-visibility"] || "PRIVATE",
    telegramUserId: settingMap["telegram-user-id"] || "",
  };
});
