import { defineEventHandler, createError } from "h3";
import { getDB } from "../../store/db/db";
import { userSetting } from "../../store/db/schema";
import { eq, and } from "drizzle-orm";

const SHORTCUTS_KEY = "shortcuts";

async function getShortcuts(userId: number): Promise<any[]> {
  const db = getDB();
  const setting = await db.select().from(userSetting)
    .where(and(eq(userSetting.userId, userId), eq(userSetting.key, SHORTCUTS_KEY))).limit(1);
  try { return JSON.parse(setting[0]?.value || "[]"); } catch { return []; }
}

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  const shortcuts = await getShortcuts(currentUser.id);
  return { shortcuts };
});
