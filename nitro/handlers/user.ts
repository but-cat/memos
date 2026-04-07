import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../store/db/db";
import { user as userTable, memo as memoTable, userSetting, inbox as inboxTable } from "../store/db/schema";
import { eq, and, count, inArray, sql } from "drizzle-orm";
import { hashPassword } from "../utils/helpers";
import { generatePAT, hashPAT, generateTokenId } from "../utils/jwt";

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
    case "ListUserSettings":
      return listUserSettings(event);
    case "ListPersonalAccessTokens":
      return listPersonalAccessTokens(event);
    case "CreatePersonalAccessToken":
      return createPersonalAccessToken(event);
    case "DeletePersonalAccessToken":
      return deletePersonalAccessToken(event);
    case "ListUserWebhooks":
      return listUserWebhooks(event);
    case "CreateUserWebhook":
      return createUserWebhook(event);
    case "UpdateUserWebhook":
      return updateUserWebhook(event);
    case "DeleteUserWebhook":
      return deleteUserWebhook(event);
    case "ListUserNotifications":
      return listUserNotifications(event);
    case "UpdateUserNotification":
      return updateUserNotification(event);
    case "DeleteUserNotification":
      return deleteUserNotification(event);
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

// ── helpers ──────────────────────────────────────────────────────────────────

async function getUserSettingRow(db: ReturnType<typeof getDB>, userId: number, key: string): Promise<any> {
  const rows = await db
    .select()
    .from(userSetting)
    .where(and(eq(userSetting.userId, userId), eq(userSetting.key, key)))
    .limit(1);
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].value);
  } catch {
    return null;
  }
}

async function upsertUserSettingRow(db: ReturnType<typeof getDB>, userId: number, key: string, value: any): Promise<void> {
  const serialized = JSON.stringify(value);
  await db
    .insert(userSetting)
    .values({ userId, key, value: serialized })
    .onConflictDoUpdate({
      target: [userSetting.userId, userSetting.key],
      set: { value: serialized },
    });
}

async function getUserByUsername(db: ReturnType<typeof getDB>, username: string) {
  const users = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
  return users[0] ?? null;
}

// ── listUserSettings ─────────────────────────────────────────────────────────

async function listUserSettings(event: H3Event) {
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

  const rows = await db.select().from(userSetting).where(eq(userSetting.userId, targetUser.id));

  const userSettings = rows.map((row) => {
    let parsed: any = null;
    try { parsed = JSON.parse(row.value); } catch { /* ignore */ }
    return {
      name: `users/${username}/settings/${row.key}`,
      userId: row.userId,
      key: row.key,
      value: parsed,
    };
  });

  return { userSettings };
}

// ── Personal Access Tokens ───────────────────────────────────────────────────

async function listPersonalAccessTokens(event: H3Event) {
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
}

async function createPersonalAccessToken(event: H3Event) {
  const body = (await readBody(event)) as {
    parent?: string;
    description?: string;
    expiresInDays?: number;
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.parent?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid parent" });

  if (currentUser.username !== username) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const rawToken = generatePAT();
  const tokenHash = hashPAT(rawToken);
  const tokenId = generateTokenId();
  const now = new Date().toISOString();
  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 86400 * 1000).toISOString()
      : null;

  const setting = await getUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS");
  const tokens: any[] = setting?.personalAccessTokens ?? [];
  tokens.push({
    tokenId,
    tokenHash,
    description: body.description || "",
    expiresAt,
    createdAt: now,
    lastUsedAt: null,
  });
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
}

async function deletePersonalAccessToken(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // name: "users/{username}/personalAccessTokens/{tokenId}"
  const parts = (body.name || "").split("/");
  const username = parts[1];
  const tokenId = parts[3];
  if (!username || !tokenId) throw createError({ statusCode: 400, message: "Invalid name" });

  if (currentUser.username !== username) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const setting = await getUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS");
  const tokens: any[] = setting?.personalAccessTokens ?? [];
  const filtered = tokens.filter((t: any) => t.tokenId !== tokenId);
  await upsertUserSettingRow(db, currentUser.id, "PERSONAL_ACCESS_TOKENS", { personalAccessTokens: filtered });

  return {};
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

async function listUserWebhooks(event: H3Event) {
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

  const setting = await getUserSettingRow(db, targetUser.id, "WEBHOOKS");
  const webhooks: any[] = setting?.webhooks ?? [];

  return {
    webhooks: webhooks.map((w: any) => ({
      name: `users/${username}/webhooks/${w.id}`,
      displayName: w.title || "",
      url: w.url || "",
    })),
  };
}

async function createUserWebhook(event: H3Event) {
  const body = (await readBody(event)) as {
    parent?: string;
    webhook?: { displayName?: string; url?: string };
  };
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

  const id = crypto.randomUUID();
  const setting = await getUserSettingRow(db, targetUser.id, "WEBHOOKS");
  const webhooks: any[] = setting?.webhooks ?? [];
  webhooks.push({ id, title: body.webhook.displayName || "", url: body.webhook.url });
  await upsertUserSettingRow(db, targetUser.id, "WEBHOOKS", { webhooks });

  return {
    name: `users/${username}/webhooks/${id}`,
    displayName: body.webhook.displayName || "",
    url: body.webhook.url,
  };
}

async function updateUserWebhook(event: H3Event) {
  const body = (await readBody(event)) as {
    webhook?: { name?: string; displayName?: string; url?: string };
    updateMask?: { paths?: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // webhook.name: "users/{username}/webhooks/{id}"
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
  if (paths.length === 0 || paths.includes("display_name")) {
    wh.title = body.webhook?.displayName ?? wh.title;
  }
  if (paths.length === 0 || paths.includes("url")) {
    wh.url = body.webhook?.url ?? wh.url;
  }
  webhooks[idx] = wh;
  await upsertUserSettingRow(db, targetUser.id, "WEBHOOKS", { webhooks });

  return {
    name: `users/${username}/webhooks/${wh.id}`,
    displayName: wh.title,
    url: wh.url,
  };
}

async function deleteUserWebhook(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // name: "users/{username}/webhooks/{id}"
  const parts = (body.name || "").split("/");
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
  const filtered = webhooks.filter((w: any) => w.id !== webhookId);
  await upsertUserSettingRow(db, targetUser.id, "WEBHOOKS", { webhooks: filtered });

  return {};
}

// ── Notifications (Inbox) ────────────────────────────────────────────────────

async function listUserNotifications(event: H3Event) {
  const body = (await readBody(event)) as { parent?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.parent?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid parent" });

  if (currentUser.username !== username) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const rows = await db
    .select()
    .from(inboxTable)
    .where(eq(inboxTable.receiverId, currentUser.id));

  if (!rows.length) return { notifications: [] };

  // Batch-fetch sender users.
  const senderIds = [...new Set(rows.map((r) => r.senderId))];
  const senders = await db
    .select({ id: userTable.id, username: userTable.username })
    .from(userTable)
    .where(inArray(userTable.id, senderIds));
  const senderMap = new Map(senders.map((u) => [u.id, u.username]));

  // Batch-fetch referenced memos.
  const memoIds = new Set<number>();
  for (const row of rows) {
    try {
      const msg = JSON.parse(row.message);
      if (msg.memoComment) {
        memoIds.add(msg.memoComment.memoId);
        memoIds.add(msg.memoComment.relatedMemoId);
      }
      if (msg.memoMention) {
        memoIds.add(msg.memoMention.memoId);
      }
    } catch { /* ignore */ }
  }

  const memoList = memoIds.size > 0
    ? await db
        .select({ id: memoTable.id, uid: memoTable.uid, content: memoTable.content })
        .from(memoTable)
        .where(inArray(memoTable.id, [...memoIds]))
    : [];
  const memoMap = new Map(memoList.map((m) => [m.id, m]));

  const notifications: any[] = [];
  for (const row of rows) {
    let msg: any = {};
    try { msg = JSON.parse(row.message); } catch { continue; }

    const senderUsername = senderMap.get(row.senderId);
    const base = {
      name: `users/${username}/notifications/${row.id}`,
      status: row.status,
      createTime: row.createdTs instanceof Date ? row.createdTs.toISOString() : new Date(Number(row.createdTs) * 1000).toISOString(),
      sender: `users/${senderUsername ?? row.senderId}`,
      type: msg.type,
    };

    if (msg.type === "MEMO_COMMENT" && msg.memoComment) {
      const memo = memoMap.get(msg.memoComment.memoId);
      const relatedMemo = memoMap.get(msg.memoComment.relatedMemoId);
      if (!memo || !relatedMemo) continue;
      notifications.push({
        ...base,
        memoComment: {
          memo: `memos/${memo.uid}`,
          relatedMemo: `memos/${relatedMemo.uid}`,
          memoSnippet: (memo.content || "").slice(0, 100),
          relatedMemoSnippet: (relatedMemo.content || "").slice(0, 100),
        },
      });
    } else if (msg.type === "MEMO_MENTION" && msg.memoMention) {
      const memo = memoMap.get(msg.memoMention.memoId);
      if (!memo) continue;
      notifications.push({
        ...base,
        memoMention: {
          memo: `memos/${memo.uid}`,
          memoSnippet: (memo.content || "").slice(0, 100),
        },
      });
    } else {
      notifications.push(base);
    }
  }

  return { notifications };
}

async function updateUserNotification(event: H3Event) {
  const body = (await readBody(event)) as {
    notification?: { name?: string; status?: string };
    updateMask?: { paths?: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // name: "users/{username}/notifications/{id}"
  const parts = (body.notification?.name || "").split("/");
  const username = parts[1];
  const notifId = parseInt(parts[3], 10);
  if (!username || isNaN(notifId)) throw createError({ statusCode: 400, message: "Invalid notification name" });

  if (currentUser.username !== username) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const status = body.notification?.status || "UNREAD";
  await db
    .update(inboxTable)
    .set({ status })
    .where(and(eq(inboxTable.id, notifId), eq(inboxTable.receiverId, currentUser.id)));

  return {
    name: `users/${username}/notifications/${notifId}`,
    status,
  };
}

async function deleteUserNotification(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // name: "users/{username}/notifications/{id}"
  const parts = (body.name || "").split("/");
  const username = parts[1];
  const notifId = parseInt(parts[3], 10);
  if (!username || isNaN(notifId)) throw createError({ statusCode: 400, message: "Invalid notification name" });

  if (currentUser.username !== username) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  await db
    .delete(inboxTable)
    .where(and(eq(inboxTable.id, notifId), eq(inboxTable.receiverId, currentUser.id)));

  return {};
}
