import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { getUserByUsername, getUserSettingRow, upsertUserSettingRow } from "../../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const parts = (body.name || "").split("/");
  const username = parts[1];
  const webhookId = parts[3];
  if (!username || !webhookId) throw createError({ statusCode: 400, message: "Invalid webhook name" });

  const targetUser = await getUserByUsername(db, username);
  if (!targetUser) throw createError({ statusCode: 404, message: "User not found" });

  if (targetUser.id !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const setting = await getUserSettingRow(db, targetUser.id, "WEBHOOKS");
  const webhooks: any[] = setting?.webhooks ?? [];
  const filtered = webhooks.filter((w: any) => w.id !== webhookId);
  await upsertUserSettingRow(db, targetUser.id, "WEBHOOKS", { webhooks: filtered });

  return {};
});
