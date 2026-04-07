import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { generatePAT, hashPAT, generateTokenId } from "../../utils/jwt";
import { getUserSettingRow, upsertUserSettingRow } from "../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { parent?: string; description?: string; expiresInDays?: number };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.parent?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid parent" });

  if (currentUser.username !== username) throw createError({ statusCode: 403, message: "Permission denied" });

  const rawToken = generatePAT();
  const tokenHash = hashPAT(rawToken);
  const tokenId = generateTokenId();
  const now = new Date().toISOString();
  const expiresAt = body.expiresInDays && body.expiresInDays > 0
    ? new Date(Date.now() + body.expiresInDays * 86400 * 1000).toISOString()
    : null;

  const setting = await getUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS");
  const tokens: any[] = setting?.personalAccessTokens ?? [];
  tokens.push({ tokenId, tokenHash, description: body.description || "", expiresAt, createdAt: now, lastUsedAt: null });
  await upsertUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS", { personalAccessTokens: tokens });

  return {
    personalAccessToken: {
      name: `users/${username}/personalAccessTokens/${tokenId}`,
      description: body.description || "",
      expiresAt,
      createdAt: now,
    },
    token: rawToken,
  };
});
