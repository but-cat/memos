import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../store/db/db";
import { user as userTable, memo as memoTable, userSetting } from "../store/db/schema";
import { eq, and, count, inArray, sql } from "drizzle-orm";
import { hashPassword } from "../utils/helpers";

function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(Number(val) * 1000).toISOString();
}

function convertUser(user: any, viewerUser: any) {
  return {
    name: `users/${user.username}`,
    id: user.id,
    rowStatus: user.rowStatus,
    createTime: tsToISO(user.createdTs),
    updateTime: tsToISO(user.updatedTs),
    role: user.role,
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

export async function handleUserService(method: string, event: H3Event) {
  switch (method) {
    case "ListUsers":
      return listUsers(event);
    case "GetUser":
      return getUser(event);
    case "BatchGetUsers":
      return batchGetUsers(event);
    case "CreateUser":
      return createUser(event);
    case "UpdateUser":
      return updateUser(event);
    case "DeleteUser":
      return deleteUser(event);
    case "GetUserAvatar":
      return getUserAvatar(event);
    case "GetUserStats":
      return getUserStats(event);
    case "ListAllUserStats":
      return listAllUserStats(event);
    case "GetUserSetting":
      return getUserSetting(event);
    case "UpdateUserSetting":
      return updateUserSetting(event);
    default:
      throw createError({
        statusCode: 404,
        message: `UserService.${method} not found`,
      });
  }
}

async function listUsers(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }
  const db = getDB();
  const users = await db.select().from(userTable);
  return { users: users.map((u) => convertUser(u, currentUser)), totalSize: users.length };
}

async function getUser(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  return { user: convertUser(users[0], currentUser) };
}

async function batchGetUsers(event: H3Event) {
  const body = (await readBody(event)) as { names?: string[] };
  const currentUser = event.context.user;
  const db = getDB();

  if (!body.names?.length) return { users: [] };

  const usernames = body.names.map((u) => u.replace("users/", ""));
  const users = await db
    .select()
    .from(userTable)
    .where(inArray(userTable.username, usernames));
  return { users: users.map((u) => convertUser(u, currentUser)) };
}

async function createUser(event: H3Event) {
  const body = (await readBody(event)) as {
    user?: {
      username: string;
      password: string;
      email?: string;
      nickname?: string;
      role?: string;
    };
  };
  const currentUser = event.context.user;
  const db = getDB();

  const existingCount = await db.select({ cnt: count() }).from(userTable);
  const isFirstUser = existingCount[0].cnt === 0;

  if (!isFirstUser && (!currentUser || currentUser.role !== "ADMIN")) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const userData = body.user;
  if (!userData?.username || !userData?.password) {
    throw createError({ statusCode: 400, message: "Username and password required" });
  }

  const existing = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, userData.username))
    .limit(1);
  if (existing[0]) throw createError({ statusCode: 409, message: "Username already exists" });

  const passwordHash = await hashPassword(userData.password);
  const role: "ADMIN" | "USER" = isFirstUser
    ? "ADMIN"
    : userData.role === "ADMIN"
      ? "ADMIN"
      : "USER";

  const [newUser] = await db
    .insert(userTable)
    .values({
      username: userData.username,
      passwordHash,
      role,
      email: userData.email || "",
      nickname: userData.nickname || "",
    })
    .returning();

  return { user: convertUser(newUser, currentUser || newUser) };
}

async function updateUser(event: H3Event) {
  const body = (await readBody(event)) as {
    user?: any;
    updateMask?: { paths: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.user?.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  if (currentUser.username !== username && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  const updates: Partial<typeof userTable.$inferInsert> = {
    updatedTs: new Date(),
  };

  const paths = body.updateMask?.paths || [];
  const userData = body.user || {};

  if (paths.includes("email") || userData.email !== undefined)
    updates.email = userData.email;
  if (paths.includes("nickname") || userData.nickname !== undefined)
    updates.nickname = userData.nickname;
  if (paths.includes("avatar_url") || userData.avatarUrl !== undefined)
    updates.avatarUrl = userData.avatarUrl;
  if (paths.includes("description") || userData.description !== undefined)
    updates.description = userData.description;
  if (
    (paths.includes("password") || userData.password !== undefined) &&
    userData.password
  ) {
    updates.passwordHash = await hashPassword(userData.password);
  }
  if (paths.includes("row_status") || userData.rowStatus !== undefined) {
    updates.rowStatus =
      userData.rowStatus === "ARCHIVED" ? "ARCHIVED" : "NORMAL";
  }
  if (
    currentUser.role === "ADMIN" &&
    (paths.includes("role") || userData.role !== undefined)
  ) {
    updates.role = userData.role === "ADMIN" ? "ADMIN" : "USER";
  }

  const [updated] = await db
    .update(userTable)
    .set(updates)
    .where(eq(userTable.username, username))
    .returning();
  return { user: convertUser(updated, currentUser) };
}

async function deleteUser(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const db = getDB();
  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  await db.delete(userTable).where(eq(userTable.username, username));
  return {};
}

async function getUserAvatar(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  const users = await db
    .select({ avatarUrl: userTable.avatarUrl })
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  return { avatarUrl: users[0].avatarUrl };
}

async function getUserStats(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const username = body.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  const users = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  const userId = users[0].id;
  const memoCount = await db
    .select({ cnt: count() })
    .from(memoTable)
    .where(
      and(
        eq(memoTable.creatorId, userId),
        eq(memoTable.rowStatus, "NORMAL"),
      ),
    );

  return {
    name: `users/${username}`,
    memoCount: memoCount[0].cnt,
    tagCount: 0,
  };
}

async function listAllUserStats(_event: H3Event) {
  const db = getDB();
  // Single query: join users with memo counts grouped by user
  const rows = await db
    .select({
      username: userTable.username,
      memoCount: sql<number>`COUNT(${memoTable.id})`.as("memo_count"),
    })
    .from(userTable)
    .leftJoin(
      memoTable,
      and(
        eq(memoTable.creatorId, userTable.id),
        eq(memoTable.rowStatus, "NORMAL"),
      ),
    )
    .groupBy(userTable.id, userTable.username);

  return {
    userStats: rows.map((r) => ({
      name: `users/${r.username}`,
      memoCount: Number(r.memoCount),
    })),
  };
}

async function getUserSetting(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // name is like "users/{username}/setting"
  const username = body.name
    ?.replace("users/", "")
    ?.replace("/setting", "");
  const targetUser = username
    ? (
        await db
          .select()
          .from(userTable)
          .where(eq(userTable.username, username))
          .limit(1)
      )[0]
    : currentUser;

  if (!targetUser) throw createError({ statusCode: 404, message: "User not found" });
  if (targetUser.id !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const settings = await db
    .select()
    .from(userSetting)
    .where(eq(userSetting.userId, targetUser.id));
  const settingMap: Record<string, string> = {};
  for (const s of settings) settingMap[s.key] = s.value;

  return {
    name: `users/${targetUser.username}/setting`,
    locale: settingMap["locale"] || "en",
    appearance: settingMap["appearance"] || "system",
    memoVisibility: settingMap["memo-visibility"] || "PRIVATE",
    telegramUserId: settingMap["telegram-user-id"] || "",
  };
}

async function updateUserSetting(event: H3Event) {
  const body = (await readBody(event)) as {
    setting?: any;
    updateMask?: { paths: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const setting = body.setting || {};
  const paths = body.updateMask?.paths || [];

  const upsertSetting = async (key: string, value: string) => {
    await db
      .insert(userSetting)
      .values({ userId: currentUser.id, key, value })
      .onConflictDoUpdate({
        target: [userSetting.userId, userSetting.key],
        set: { value },
      });
  };

  if (paths.includes("locale") || setting.locale !== undefined)
    await upsertSetting("locale", setting.locale || "en");
  if (paths.includes("appearance") || setting.appearance !== undefined)
    await upsertSetting("appearance", setting.appearance || "system");
  if (
    paths.includes("memo_visibility") ||
    setting.memoVisibility !== undefined
  )
    await upsertSetting(
      "memo-visibility",
      setting.memoVisibility || "PRIVATE",
    );
  if (
    paths.includes("telegram_user_id") ||
    setting.telegramUserId !== undefined
  )
    await upsertSetting("telegram-user-id", setting.telegramUserId || "");

  const allSettings = await db
    .select()
    .from(userSetting)
    .where(eq(userSetting.userId, currentUser.id));
  const settingMap: Record<string, string> = {};
  for (const s of allSettings) settingMap[s.key] = s.value;

  return {
    name: `users/${currentUser.username}/setting`,
    locale: settingMap["locale"] || "en",
    appearance: settingMap["appearance"] || "system",
    memoVisibility: settingMap["memo-visibility"] || "PRIVATE",
    telegramUserId: settingMap["telegram-user-id"] || "",
  };
}
