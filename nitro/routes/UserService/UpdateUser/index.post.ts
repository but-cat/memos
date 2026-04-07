import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { user as userTable } from "../../../store/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../../utils/helpers";
import { convertUser } from "../../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { user?: any; updateMask?: { paths: string[] } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.user?.name?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid user name" });

  if (currentUser.username !== username && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const users = await db.select().from(userTable).where(eq(userTable.username, username)).limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  const updates: Partial<typeof userTable.$inferInsert> = { updatedTs: new Date() };
  const paths = body.updateMask?.paths || [];
  const userData = body.user || {};

  if (paths.includes("email") || userData.email !== undefined) updates.email = userData.email;
  if (paths.includes("nickname") || userData.nickname !== undefined) updates.nickname = userData.nickname;
  if (paths.includes("avatar_url") || userData.avatarUrl !== undefined) updates.avatarUrl = userData.avatarUrl;
  if (paths.includes("description") || userData.description !== undefined) updates.description = userData.description;
  if ((paths.includes("password") || userData.password !== undefined) && userData.password) {
    updates.passwordHash = await hashPassword(userData.password);
  }
  if (paths.includes("row_status") || userData.rowStatus !== undefined) {
    updates.rowStatus = userData.rowStatus === "ARCHIVED" ? "ARCHIVED" : "NORMAL";
  }
  if (currentUser.role === "ADMIN" && (paths.includes("role") || userData.role !== undefined)) {
    updates.role = userData.role === "ADMIN" ? "ADMIN" : "USER";
  }

  const [updated] = await db.update(userTable).set(updates).where(eq(userTable.username, username)).returning();
  return { user: convertUser(updated, currentUser) };
});
