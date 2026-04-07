import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { userSetting } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { setting?: any; updateMask?: { paths: string[] } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const setting = body.setting || {};
  const paths = body.updateMask?.paths || [];

  const upsertSetting = async (key: string, value: string) => {
    await db.insert(userSetting).values({ userId: currentUser.id, key, value })
      .onConflictDoUpdate({ target: [userSetting.userId, userSetting.key], set: { value } });
  };

  if (paths.includes("locale") || setting.locale !== undefined)
    await upsertSetting("locale", setting.locale || "en");
  if (paths.includes("appearance") || setting.appearance !== undefined)
    await upsertSetting("appearance", setting.appearance || "system");
  if (paths.includes("memo_visibility") || setting.memoVisibility !== undefined)
    await upsertSetting("memo-visibility", setting.memoVisibility || "PRIVATE");
  if (paths.includes("telegram_user_id") || setting.telegramUserId !== undefined)
    await upsertSetting("telegram-user-id", setting.telegramUserId || "");

  const allSettings = await db.select().from(userSetting).where(eq(userSetting.userId, currentUser.id));
  const settingMap: Record<string, string> = {};
  for (const s of allSettings) settingMap[s.key] = s.value;

  return {
    name: `users/${currentUser.username}/setting`,
    locale: settingMap["locale"] || "en",
    appearance: settingMap["appearance"] || "system",
    memoVisibility: settingMap["memo-visibility"] || "PRIVATE",
    telegramUserId: settingMap["telegram-user-id"] || "",
  };
});
