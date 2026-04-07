import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { getUserByUsername, getUserSettingRow, upsertUserSettingRow } from "../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { webhook?: { name?: string; displayName?: string; url?: string }; updateMask?: { paths?: string[] } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const parts = (body.webhook?.name || "").split("/");
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
  const idx = webhooks.findIndex((w: any) => w.id === webhookId);
  if (idx === -1) throw createError({ statusCode: 404, message: "Webhook not found" });

  const paths = body.updateMask?.paths ?? [];
  const wh = webhooks[idx];
  if (paths.length === 0 || paths.includes("display_name")) wh.title = body.webhook?.displayName ?? wh.title;
  if (paths.length === 0 || paths.includes("url")) wh.url = body.webhook?.url ?? wh.url;
  webhooks[idx] = wh;
  await upsertUserSettingRow(db, targetUser.id, "WEBHOOKS", { webhooks });

  return { name: `users/${username}/webhooks/${wh.id}`, displayName: wh.title, url: wh.url };
});
