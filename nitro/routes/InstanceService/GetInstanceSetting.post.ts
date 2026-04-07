import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { systemSetting } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const keyStr = body.name?.replace("settings/", "") || "";

  if (["STORAGE", "NOTIFICATION"].includes(keyStr)) {
    if (!currentUser || currentUser.role !== "ADMIN") throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const row = await db.select().from(systemSetting).where(eq(systemSetting.name, keyStr)).limit(1);

  let value: unknown = {};
  if (row[0]) {
    try { value = JSON.parse(row[0].value); } catch { value = row[0].value; }
  }

  return { name: `settings/${keyStr}`, value };
});
