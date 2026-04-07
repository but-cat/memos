import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { genUUID } from "../../utils/helpers";
import { getUserByUsername, getUserSettingRow, upsertUserSettingRow } from "../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { parent?: string; webhook?: { displayName?: string; url?: string } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.parent?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid parent" });

  const targetUser = await getUserByUsername(db, username);
  if (!targetUser) throw createError({ statusCode: 404, message: "User not found" });

  if (targetUser.id !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  if (!body.webhook?.url) throw createError({ statusCode: 400, message: "URL is required" });

  const id = genUUID();
  const setting = await getUserSettingRow(db, targetUser.id, "WEBHOOKS");
  const webhooks: any[] = setting?.webhooks ?? [];
  webhooks.push({ id, title: body.webhook.displayName || "", url: body.webhook.url });
  await upsertUserSettingRow(db, targetUser.id, "WEBHOOKS", { webhooks });

  return {
    name: `users/${username}/webhooks/${id}`,
    displayName: body.webhook.displayName || "",
    url: body.webhook.url,
  };
});
