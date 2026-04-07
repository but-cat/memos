import { eq, and, or, inArray, like, sql } from "drizzle-orm";
import { user as userTable } from "./db/schema";
import type { DrizzleDB } from "./db/db";
import type { User, FindUser, UpdateUser, DeleteUser } from "./types";

function rowToUser(row: typeof userTable.$inferSelect): User {
  return {
    id: row.id,
    rowStatus: row.rowStatus,
    createdTs: row.createdTs instanceof Date ? Math.floor(row.createdTs.getTime() / 1000) : Number(row.createdTs),
    updatedTs: row.updatedTs instanceof Date ? Math.floor(row.updatedTs.getTime() / 1000) : Number(row.updatedTs),
    username: row.username,
    role: row.role,
    email: row.email,
    nickname: row.nickname,
    passwordHash: row.passwordHash,
    avatarUrl: row.avatarUrl,
    description: row.description,
  };
}

export async function createUser(
  db: DrizzleDB,
  user: Omit<User, "id">,
): Promise<User> {
  const [row] = await db
    .insert(userTable)
    .values({
      rowStatus: user.rowStatus,
      createdTs: new Date(user.createdTs * 1000),
      updatedTs: new Date(user.updatedTs * 1000),
      username: user.username,
      role: user.role,
      email: user.email,
      nickname: user.nickname,
      passwordHash: user.passwordHash,
      avatarUrl: user.avatarUrl,
      description: user.description,
    })
    .returning();
  return rowToUser(row);
}

export async function listUsers(
  db: DrizzleDB,
  find: FindUser,
): Promise<User[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) {
    conditions.push(eq(userTable.id, find.id));
  }
  if (find.idList && find.idList.length > 0) {
    conditions.push(inArray(userTable.id, find.idList));
  }
  if (find.usernameList && find.usernameList.length > 0) {
    conditions.push(inArray(userTable.username, find.usernameList));
  }
  if (find.rowStatus !== undefined) {
    conditions.push(eq(userTable.rowStatus, find.rowStatus));
  }
  if (find.username !== undefined) {
    conditions.push(eq(userTable.username, find.username));
  }
  if (find.role !== undefined) {
    conditions.push(eq(userTable.role, find.role));
  }
  if (find.email !== undefined) {
    conditions.push(eq(userTable.email, find.email));
  }
  if (find.nickname !== undefined) {
    conditions.push(eq(userTable.nickname, find.nickname));
  }
  if (find.search !== undefined) {
    const pattern = `%${find.search}%`;
    conditions.push(
      or(
        like(userTable.username, pattern),
        like(userTable.nickname, pattern),
        like(userTable.email, pattern),
      )!,
    );
  }

  const baseQuery = db
    .select()
    .from(userTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const rows = find.limit !== undefined
    ? await baseQuery.limit(find.limit)
    : await baseQuery;

  return rows.map(rowToUser);
}

export async function updateUser(
  db: DrizzleDB,
  update: UpdateUser,
): Promise<User> {
  const setFields: Partial<typeof userTable.$inferInsert> = {};

  if (update.updatedTs !== undefined) {
    setFields.updatedTs = new Date(update.updatedTs * 1000);
  } else {
    setFields.updatedTs = new Date();
  }
  if (update.rowStatus !== undefined) setFields.rowStatus = update.rowStatus;
  if (update.username !== undefined) setFields.username = update.username;
  if (update.role !== undefined) setFields.role = update.role;
  if (update.email !== undefined) setFields.email = update.email;
  if (update.nickname !== undefined) setFields.nickname = update.nickname;
  if (update.avatarUrl !== undefined) setFields.avatarUrl = update.avatarUrl;
  if (update.description !== undefined) setFields.description = update.description;
  if (update.passwordHash !== undefined) setFields.passwordHash = update.passwordHash;

  const [row] = await db
    .update(userTable)
    .set(setFields)
    .where(eq(userTable.id, update.id))
    .returning();
  return rowToUser(row);
}

export async function deleteUser(
  db: DrizzleDB,
  del: DeleteUser,
): Promise<void> {
  await db.delete(userTable).where(eq(userTable.id, del.id));
}
