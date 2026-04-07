import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { userSetting } from "../../store/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const SHORTCUTS_KEY = "shortcuts";

async function getShortcuts(userId: number): Promise<any[]> {
  const db = getDB();
  const setting = await db.select().from(userSetting)
    .where(and(eq(userSetting.userId, userId), eq(userSetting.key, SHORTCUTS_KEY))).limit(1);
  try { return JSON.parse(setting[0]?.value || "[]"); } catch { return []; }
}

async function saveShortcuts(userId: number, shortcuts: any[]) {
  const db = getDB();
  const value = JSON.stringify(shortcuts);
  await db.insert(userSetting).values({ userId, key: SHORTCUTS_KEY, value })
    .onConflictDoUpdate({ target: [userSetting.userId, userSetting.key], set: { value } });
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { shortcut?: any };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const shortcuts = await getShortcuts(currentUser.id);
  const newShortcut = { ...body.shortcut, id: nanoid(12) };
  shortcuts.push(newShortcut);
  await saveShortcuts(currentUser.id, shortcuts);
  return { shortcut: newShortcut };
});
