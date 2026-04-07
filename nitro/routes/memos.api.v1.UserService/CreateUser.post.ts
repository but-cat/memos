import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable } from "../../store/db/schema";
import { eq, count } from "drizzle-orm";
import { hashPassword } from "../../utils/helpers";
import { convertUser } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    user?: { username: string; password: string; email?: string; nickname?: string; role?: string };
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

  const existing = await db.select().from(userTable).where(eq(userTable.username, userData.username)).limit(1);
  if (existing[0]) throw createError({ statusCode: 409, message: "Username already exists" });

  const passwordHash = await hashPassword(userData.password);
  const role: "ADMIN" | "USER" = isFirstUser ? "ADMIN" : userData.role === "ADMIN" ? "ADMIN" : "USER";

  const [newUser] = await db.insert(userTable).values({
    username: userData.username,
    passwordHash,
    role,
    email: userData.email || "",
    nickname: userData.nickname || "",
  }).returning();

  return { user: convertUser(newUser, currentUser || newUser) };
});
