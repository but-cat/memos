import { defineEventHandler, createError } from "h3";
import { getDB } from "../../store/db/db";
import { systemSetting } from "../../store/db/schema";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const settings = await db.select().from(systemSetting);
  return {
    settings: settings.map((s) => {
      let value: unknown = {};
      try { value = JSON.parse(s.value); } catch { value = s.value; }
      return { name: `settings/${s.name}`, value };
    }),
  };
});
