import { defineEventHandler, getRequestHeader, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { generateAccessToken, verifyRefreshToken, extractRefreshTokenFromCookie } from "../../utils/jwt";

export default defineEventHandler(async (event) => {
  const cookieHeader = getRequestHeader(event, "cookie") || "";
  const refreshTokenStr = extractRefreshTokenFromCookie(cookieHeader);

  if (!refreshTokenStr) throw createError({ statusCode: 401, message: "No refresh token" });

  const claims = await verifyRefreshToken(refreshTokenStr);
  if (!claims?.sub) throw createError({ statusCode: 401, message: "Invalid refresh token" });

  const userId = parseInt(claims.sub);
  const db = getDB();
  const users = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
  const foundUser = users[0];

  if (!foundUser || foundUser.rowStatus === "ARCHIVED") {
    throw createError({ statusCode: 401, message: "User not found or archived" });
  }

  const { token: accessToken, expiresAt } = await generateAccessToken(
    foundUser.id, foundUser.username, foundUser.role, foundUser.rowStatus,
  );

  return { accessToken, expiresAt: expiresAt.toISOString() };
});
