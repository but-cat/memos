import { defineEventHandler, readBody, setCookie, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable, userSetting } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE,
  generateTokenId,
} from "../../utils/jwt";
import { verifyPassword } from "../../utils/helpers";
import { convertUser } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    passwordCredentials?: { username: string; password: string };
  };

  if (!body.passwordCredentials) {
    throw createError({ statusCode: 400, message: "Password credentials required" });
  }

  const { username, password } = body.passwordCredentials;
  const db = getDB();
  const users = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
  const foundUser = users[0];

  if (!foundUser || !(await verifyPassword(password, foundUser.passwordHash))) {
    throw createError({ statusCode: 400, message: "Invalid credentials" });
  }

  if (foundUser.rowStatus === "ARCHIVED") {
    throw createError({ statusCode: 403, message: "User is archived" });
  }

  const { token: accessToken, expiresAt } = await generateAccessToken(
    foundUser.id, foundUser.username, foundUser.role, foundUser.rowStatus,
  );

  const tokenId = generateTokenId();
  const { token: refreshTokenStr, expiresAt: refreshExpiresAt } = await generateRefreshToken(foundUser.id, tokenId);

  const key = `refresh_token_${tokenId}`;
  const value = JSON.stringify({ tokenId, expiresAt: refreshExpiresAt.toISOString() });
  await db.insert(userSetting).values({ userId: foundUser.id, key, value })
    .onConflictDoUpdate({ target: [userSetting.userId, userSetting.key], set: { value } });

  setCookie(event, REFRESH_TOKEN_COOKIE, refreshTokenStr, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: refreshExpiresAt,
    path: "/",
  });

  return {
    user: convertUser(foundUser, foundUser),
    accessToken,
    expiresAt: expiresAt.toISOString(),
  };
});
