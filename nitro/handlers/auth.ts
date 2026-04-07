import type { H3Event } from "h3";
import { readBody, setCookie, deleteCookie, getRequestHeader, createError } from "h3";
import { getDB } from "../utils/db";
import { user as userTable, userSetting } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  extractRefreshTokenFromCookie,
  REFRESH_TOKEN_COOKIE,
  generateTokenId,
} from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/helpers";

export async function handleAuthService(method: string, event: H3Event) {
  switch (method) {
    case "GetCurrentUser":
      return getCurrentUser(event);
    case "SignIn":
      return signIn(event);
    case "SignUp":
      return signUp(event);
    case "SignOut":
      return signOut(event);
    case "RefreshToken":
      return refreshToken(event);
    case "DeleteSession":
      return deleteSession(event);
    default:
      throw createError({
        statusCode: 404,
        message: `AuthService.${method} not implemented`,
      });
  }
}

function convertUser(user: any, viewerUser: any) {
  return {
    name: `users/${user.username}`,
    id: user.id,
    rowStatus: user.rowStatus === "ARCHIVED" ? "ARCHIVED" : "NORMAL",
    createTime: tsToISO(user.createdTs),
    updateTime: tsToISO(user.updatedTs),
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
    username: user.username,
    email:
      viewerUser?.id === user.id || viewerUser?.role === "ADMIN"
        ? user.email
        : "",
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    description: user.description,
  };
}

function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(Number(val) * 1000).toISOString();
}

async function getCurrentUser(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  return { user: convertUser(currentUser, currentUser) };
}

async function signIn(event: H3Event) {
  const body = (await readBody(event)) as {
    passwordCredentials?: { username: string; password: string };
  };

  if (!body.passwordCredentials) {
    throw createError({ statusCode: 400, message: "Password credentials required" });
  }

  const { username, password } = body.passwordCredentials;
  const db = getDB();
  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);
  const foundUser = users[0];

  if (!foundUser || !(await verifyPassword(password, foundUser.passwordHash))) {
    throw createError({ statusCode: 400, message: "Invalid credentials" });
  }

  if (foundUser.rowStatus === "ARCHIVED") {
    throw createError({ statusCode: 403, message: "User is archived" });
  }

  const { token: accessToken, expiresAt } = await generateAccessToken(
    foundUser.id,
    foundUser.username,
    foundUser.role,
    foundUser.rowStatus,
  );

  const tokenId = generateTokenId();
  const { token: refreshTokenStr, expiresAt: refreshExpiresAt } =
    await generateRefreshToken(foundUser.id, tokenId);

  await storeRefreshToken(foundUser.id, tokenId, refreshExpiresAt);

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
}

async function signUp(event: H3Event) {
  const body = (await readBody(event)) as {
    username: string;
    password: string;
  };
  const db = getDB();

  const existingUsers = await db
    .select({ id: userTable.id })
    .from(userTable)
    .limit(1);
  const isFirstUser = existingUsers.length === 0;

  if (!isFirstUser) {
    const setting = await db
      .select()
      .from(userSetting)
      .where(eq(userSetting.key, "allow-signup"))
      .limit(1);
    if (!setting[0] || setting[0].value !== "true") {
      throw createError({ statusCode: 403, message: "Signup is not allowed" });
    }
  }

  const existingUser = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, body.username))
    .limit(1);
  if (existingUser[0]) {
    throw createError({ statusCode: 409, message: "Username already exists" });
  }

  const passwordHash = await hashPassword(body.password);
  const role = isFirstUser ? "ADMIN" : "USER";

  const [newUser] = await db
    .insert(userTable)
    .values({
      username: body.username,
      passwordHash,
      role: role as "ADMIN" | "USER",
    })
    .returning();

  return { user: convertUser(newUser, newUser) };
}

async function signOut(event: H3Event) {
  deleteCookie(event, REFRESH_TOKEN_COOKIE);
  return {};
}

async function refreshToken(event: H3Event) {
  const cookieHeader = getRequestHeader(event, "cookie") || "";
  const refreshTokenStr = extractRefreshTokenFromCookie(cookieHeader);

  if (!refreshTokenStr) {
    throw createError({ statusCode: 401, message: "No refresh token" });
  }

  const claims = await verifyRefreshToken(refreshTokenStr);
  if (!claims?.sub) {
    throw createError({ statusCode: 401, message: "Invalid refresh token" });
  }

  const userId = parseInt(claims.sub);
  const db = getDB();
  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  const foundUser = users[0];

  if (!foundUser || foundUser.rowStatus === "ARCHIVED") {
    throw createError({ statusCode: 401, message: "User not found or archived" });
  }

  const { token: accessToken, expiresAt } = await generateAccessToken(
    foundUser.id,
    foundUser.username,
    foundUser.role,
    foundUser.rowStatus,
  );

  return { accessToken, expiresAt: expiresAt.toISOString() };
}

async function deleteSession(event: H3Event) {
  deleteCookie(event, REFRESH_TOKEN_COOKIE);
  return {};
}

async function storeRefreshToken(
  userId: number,
  tokenId: string,
  expiresAt: Date,
) {
  const db = getDB();
  const key = `refresh_token_${tokenId}`;
  const value = JSON.stringify({ tokenId, expiresAt: expiresAt.toISOString() });
  await db
    .insert(userSetting)
    .values({ userId, key, value })
    .onConflictDoUpdate({
      target: [userSetting.userId, userSetting.key],
      set: { value },
    });
}
