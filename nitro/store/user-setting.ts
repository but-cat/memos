import { eq, and } from "drizzle-orm";
import { userSetting as userSettingTable, user as userTable } from "../db/schema";
import type { DrizzleDB } from "../utils/db";
import type {
  UserSettingKey,
  UserSettingValue,
  UserSettingRow,
  FindUserSetting,
  GeneralUserSetting,
  ShortcutItem,
  WebhookItem,
  RefreshTokenItem,
  PATItem,
} from "./types";

function parseSettingValue(key: UserSettingKey, raw: string): UserSettingValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  switch (key) {
    case "GENERAL":
      return { general: (parsed as { general?: GeneralUserSetting })?.general ?? (parsed as GeneralUserSetting) };
    case "SHORTCUTS":
      return { shortcuts: (parsed as { shortcuts?: ShortcutItem[] })?.shortcuts ?? (parsed as ShortcutItem[]) ?? [] };
    case "WEBHOOKS":
      return { webhooks: (parsed as { webhooks?: WebhookItem[] })?.webhooks ?? (parsed as WebhookItem[]) ?? [] };
    case "REFRESH_TOKENS":
      return { refreshTokens: (parsed as { refreshTokens?: RefreshTokenItem[] })?.refreshTokens ?? (parsed as RefreshTokenItem[]) ?? [] };
    case "PERSONAL_ACCESS_TOKENS":
      return { personalAccessTokens: (parsed as { personalAccessTokens?: PATItem[] })?.personalAccessTokens ?? (parsed as PATItem[]) ?? [] };
  }
}

function serializeSettingValue(value: UserSettingValue): string {
  return JSON.stringify(value);
}

function rowToUserSettingRow(row: { userId: number; key: string; value: string }): UserSettingRow {
  const key = row.key as UserSettingKey;
  return {
    userId: row.userId,
    key,
    value: parseSettingValue(key, row.value),
  };
}

export async function upsertUserSetting(
  db: DrizzleDB,
  userId: number,
  key: UserSettingKey,
  value: UserSettingValue,
): Promise<void> {
  const serialized = serializeSettingValue(value);
  await db
    .insert(userSettingTable)
    .values({ userId, key, value: serialized })
    .onConflictDoUpdate({
      target: [userSettingTable.userId, userSettingTable.key],
      set: { value: serialized },
    });
}

export async function listUserSettings(
  db: DrizzleDB,
  find: FindUserSetting,
): Promise<UserSettingRow[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.userId !== undefined) {
    conditions.push(eq(userSettingTable.userId, find.userId));
  }
  if (find.key !== undefined) {
    conditions.push(eq(userSettingTable.key, find.key));
  }

  const rows = await db
    .select()
    .from(userSettingTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToUserSettingRow);
}

export async function getUserSetting(
  db: DrizzleDB,
  find: FindUserSetting,
): Promise<UserSettingRow | null> {
  const rows = await listUserSettings(db, find);
  return rows[0] ?? null;
}

export async function getUserByPATHash(
  db: DrizzleDB,
  tokenHash: string,
): Promise<{ userId: number; pat: PATItem } | null> {
  const rows = await db
    .select()
    .from(userSettingTable)
    .where(eq(userSettingTable.key, "PERSONAL_ACCESS_TOKENS"));

  for (const row of rows) {
    const settingRow = rowToUserSettingRow(row);
    const val = settingRow.value as { personalAccessTokens: PATItem[] };
    const pats = val.personalAccessTokens ?? [];
    for (const pat of pats) {
      if (pat.tokenHash === tokenHash) {
        return { userId: row.userId, pat };
      }
    }
  }
  return null;
}
