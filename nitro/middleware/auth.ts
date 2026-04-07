import { defineEventHandler, getRequestHeader, createError } from "h3";
import {
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
  extractRefreshTokenFromCookie,
  PAT_PREFIX,
  hashPAT,
} from "../utils/jwt";
import { getDB } from "../utils/db";
import { user as userTable, userSetting } from "../db/schema";
import { eq, and } from "drizzle-orm";

// Public endpoints that don't require authentication
const PUBLIC_PATHS = new Set([
  "/memos.api.v1.AuthService/SignIn",
  "/memos.api.v1.AuthService/RefreshToken",
  "/memos.api.v1.InstanceService/GetInstanceProfile",
  "/memos.api.v1.InstanceService/GetInstanceSetting",
  "/memos.api.v1.UserService/CreateUser",
  "/memos.api.v1.UserService/GetUser",
  "/memos.api.v1.UserService/BatchGetUsers",
  "/memos.api.v1.UserService/GetUserAvatar",
  "/memos.api.v1.UserService/GetUserStats",
  "/memos.api.v1.UserService/ListAllUserStats",
  "/memos.api.v1.IdentityProviderService/ListIdentityProviders",
  "/memos.api.v1.MemoService/GetMemo",
  "/memos.api.v1.MemoService/ListMemos",
  "/memos.api.v1.MemoService/ListMemoComments",
  "/memos.api.v1.MemoService/GetMemoByShare",
]);

export default defineEventHandler(async (event) => {
  const reqPath = event.path;

  // Only process Connect RPC API routes
  if (!reqPath.startsWith("/memos.api.v1.")) return;

  // Check if public
  if (PUBLIC_PATHS.has(reqPath)) return;

  const authHeader = getRequestHeader(event, "authorization") || "";
  const cookieHeader = getRequestHeader(event, "cookie") || "";

  const db = getDB();
  let currentUser = null;

  // Try Bearer token
  if (authHeader) {
    const token = extractBearerToken(authHeader);
    if (token) {
      if (!token.startsWith(PAT_PREFIX)) {
        // JWT access token (stateless)
        const claims = await verifyAccessToken(token);
        if (claims?.sub) {
          const userId = parseInt(claims.sub);
          const users = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, userId))
            .limit(1);
          currentUser = users[0] ?? null;
        }
      } else {
        // Personal Access Token — hash and look up in user_setting
        const tokenHash = hashPAT(token);
        const settings = await db
          .select()
          .from(userSetting)
          .where(
            and(eq(userSetting.key, "tokens"), eq(userSetting.value, tokenHash)),
          )
          .limit(1);
        if (settings[0]) {
          const users = await db
            .select()
            .from(userTable)
            .where(eq(userTable.id, settings[0].userId))
            .limit(1);
          currentUser = users[0] ?? null;
        }
      }
    }
  }

  // Fall back to refresh token from cookie
  if (!currentUser && cookieHeader) {
    const refreshToken = extractRefreshTokenFromCookie(cookieHeader);
    if (refreshToken) {
      const claims = await verifyRefreshToken(refreshToken);
      if (claims?.sub) {
        const userId = parseInt(claims.sub);
        const users = await db
          .select()
          .from(userTable)
          .where(eq(userTable.id, userId))
          .limit(1);
        currentUser = users[0] ?? null;
      }
    }
  }

  if (!currentUser) {
    throw createError({ statusCode: 401, message: "Unauthenticated" });
  }

  if (currentUser.rowStatus === "ARCHIVED") {
    throw createError({ statusCode: 401, message: "User is archived" });
  }

  event.context.user = currentUser;
});
