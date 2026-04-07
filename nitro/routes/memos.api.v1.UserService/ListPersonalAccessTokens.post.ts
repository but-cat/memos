import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { getUserByUsername, getUserSettingRow } from "../../utils/user-setting-helpers";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { parent?: string };
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

  const setting = await getUserSettingRow(db, targetUser.id, "PERSONAL_ACCESS_TOKENS");
  const tokens: any[] = setting?.personalAccessTokens ?? [];

  return {
    personalAccessTokens: tokens.map((t: any) => ({
      name: `users/${username}/personalAccessTokens/${t.tokenId}`,
      description: t.description || "",
      expiresAt: t.expiresAt ?? null,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt ?? null,
    })),
  };
});
