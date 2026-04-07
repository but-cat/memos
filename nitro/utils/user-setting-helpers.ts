import { getDB } from "../store/db/db";
import { user as userTable, userSetting } from "../store/db/schema";
import { eq, and } from "drizzle-orm";

export async function getUserSettingRow(db: ReturnType<typeof getDB>, userId: number, key: string): Promise<any> {
  const rows = await db.select().from(userSetting)
    .where(and(eq(userSetting.userId, userId), eq(userSetting.key, key)))
    .limit(1);
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

export async function upsertUserSettingRow(db: ReturnType<typeof getDB>, userId: number, key: string, value: any): Promise<void> {
  const serialized = JSON.stringify(value);
  await db.insert(userSetting).values({ userId, key, value: serialized })
    .onConflictDoUpdate({
      target: [userSetting.userId, userSetting.key],
      set: { value: serialized },
    });
}

export async function getUserByUsername(db: ReturnType<typeof getDB>, username: string) {
  const users = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
  return users[0] ?? null;
}
