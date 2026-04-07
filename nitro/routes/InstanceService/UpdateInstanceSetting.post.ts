import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { systemSetting } from "../../store/db/schema";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { setting?: any; updateMask?: { paths: string[] } };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const setting = body.setting || {};
  const keyStr = setting.name?.replace("settings/", "") || "";
  const valueStr = JSON.stringify(setting.value ?? {});

  await db.insert(systemSetting).values({ name: keyStr, value: valueStr, description: "" })
    .onConflictDoUpdate({ target: [systemSetting.name], set: { value: valueStr } });

  return { name: `settings/${keyStr}`, value: setting.value };
});
