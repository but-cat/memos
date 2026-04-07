import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { getUserSettingRow, upsertUserSettingRow } from "../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const parts = (body.name || "").split("/");
  const username = parts[1];
  const tokenId = parts[3];
  if (!username || !tokenId) throw createError({ statusCode: 400, message: "Invalid name" });

  if (currentUser.username !== username) throw createError({ statusCode: 403, message: "Permission denied" });

  const setting = await getUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS");
  const tokens: any[] = setting?.personalAccessTokens ?? [];
  const filtered = tokens.filter((t: any) => t.tokenId !== tokenId);
  await upsertUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS", { personalAccessTokens: filtered });

  return {};
});
