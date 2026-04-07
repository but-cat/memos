import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../utils/db";
import { userSetting } from "../db/schema";
import { eq, and } from "drizzle-orm";

const SHORTCUTS_KEY = "shortcuts";

export async function handleShortcutService(method: string, event: H3Event) {
  switch (method) {
    case "ListShortcuts":
      return listShortcuts(event);
    case "CreateShortcut":
      return createShortcut(event);
    case "UpdateShortcut":
      return updateShortcut(event);
    case "DeleteShortcut":
      return deleteShortcut(event);
    default:
      throw createError({
        statusCode: 404,
        message: `ShortcutService.${method} not found`,
      });
  }
}

async function getShortcuts(userId: number): Promise<any[]> {
  const db = getDB();
  const setting = await db
    .select()
    .from(userSetting)
    .where(
      and(eq(userSetting.userId, userId), eq(userSetting.key, SHORTCUTS_KEY)),
    )
    .limit(1);
  try {
    return JSON.parse(setting[0]?.value || "[]");
  } catch {
    return [];
  }
}

async function saveShortcuts(userId: number, shortcuts: any[]) {
  const db = getDB();
  const value = JSON.stringify(shortcuts);
  await db
    .insert(userSetting)
    .values({ userId, key: SHORTCUTS_KEY, value })
    .onConflictDoUpdate({
      target: [userSetting.userId, userSetting.key],
      set: { value },
    });
}

async function listShortcuts(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  const shortcuts = await getShortcuts(currentUser.id);
  return { shortcuts };
}

async function createShortcut(event: H3Event) {
  const body = (await readBody(event)) as { shortcut?: any };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const shortcuts = await getShortcuts(currentUser.id);
  const newShortcut = { ...body.shortcut, id: Date.now() };
  shortcuts.push(newShortcut);
  await saveShortcuts(currentUser.id, shortcuts);
  return { shortcut: newShortcut };
}

async function updateShortcut(event: H3Event) {
  const body = (await readBody(event)) as { shortcut?: any };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  let shortcuts = await getShortcuts(currentUser.id);
  shortcuts = shortcuts.map((s) =>
    s.id === body.shortcut?.id ? { ...s, ...body.shortcut } : s,
  );
  await saveShortcuts(currentUser.id, shortcuts);
  return { shortcut: body.shortcut };
}

async function deleteShortcut(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const id = parseInt(body.name?.split("/").pop() || "0");
  let shortcuts = await getShortcuts(currentUser.id);
  shortcuts = shortcuts.filter((s) => s.id !== id);
  await saveShortcuts(currentUser.id, shortcuts);
  return {};
}
