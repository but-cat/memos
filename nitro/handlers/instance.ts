import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../utils/db";
import { systemSetting, user as userTable } from "../db/schema";
import { eq } from "drizzle-orm";

export async function handleInstanceService(method: string, event: H3Event) {
  switch (method) {
    case "GetInstanceProfile":
      return getInstanceProfile(event);
    case "GetInstanceSetting":
      return getInstanceSetting(event);
    case "UpdateInstanceSetting":
      return updateInstanceSetting(event);
    case "ListInstanceSettings":
      return listInstanceSettings(event);
    default:
      throw createError({
        statusCode: 404,
        message: `InstanceService.${method} not found`,
      });
  }
}

async function getInstanceProfile(_event: H3Event) {
  const db = getDB();
  const admins = await db
    .select({ username: userTable.username })
    .from(userTable)
    .where(eq(userTable.role, "ADMIN"))
    .limit(1);

  return {
    version: process.env.MEMOS_VERSION || "0.26.0",
    demo: process.env.MEMOS_DEMO === "true",
    instanceUrl: process.env.INSTANCE_URL || "",
    admin: admins[0] ? `users/${admins[0].username}` : null,
  };
}

async function getInstanceSetting(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const keyStr = body.name?.replace("settings/", "") || "";

  if (["STORAGE", "NOTIFICATION"].includes(keyStr)) {
    if (!currentUser || currentUser.role !== "ADMIN") {
      throw createError({ statusCode: 403, message: "Permission denied" });
    }
  }

  const row = await db
    .select()
    .from(systemSetting)
    .where(eq(systemSetting.name, keyStr))
    .limit(1);

  let value: unknown = {};
  if (row[0]) {
    try {
      value = JSON.parse(row[0].value);
    } catch {
      value = row[0].value;
    }
  }

  return { name: `settings/${keyStr}`, value };
}

async function updateInstanceSetting(event: H3Event) {
  const body = (await readBody(event)) as {
    setting?: any;
    updateMask?: { paths: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Admin required" });
  }

  const db = getDB();
  const setting = body.setting || {};
  const keyStr = setting.name?.replace("settings/", "") || "";
  const valueStr = JSON.stringify(setting.value ?? {});

  await db
    .insert(systemSetting)
    .values({ name: keyStr, value: valueStr, description: "" })
    .onConflictDoUpdate({
      target: [systemSetting.name],
      set: { value: valueStr },
    });

  return { name: `settings/${keyStr}`, value: setting.value };
}

async function listInstanceSettings(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Admin required" });
  }

  const db = getDB();
  const settings = await db.select().from(systemSetting);
  return {
    settings: settings.map((s) => {
      let value: unknown = {};
      try {
        value = JSON.parse(s.value);
      } catch {
        value = s.value;
      }
      return { name: `settings/${s.name}`, value };
    }),
  };
}
