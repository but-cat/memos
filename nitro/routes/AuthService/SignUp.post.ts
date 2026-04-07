import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable, systemSetting } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../utils/helpers";
import { convertUser } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { username: string; password: string };
  const db = getDB();

  const existingUsers = await db.select({ id: userTable.id }).from(userTable).limit(1);
  const isFirstUser = existingUsers.length === 0;

  if (!isFirstUser) {
    const setting = await db.select().from(systemSetting).where(eq(systemSetting.name, "GENERAL")).limit(1);
    let disallowed = true;
    if (setting[0]) {
      try {
        const generalSetting = JSON.parse(setting[0].value) as { disallowUserRegistration?: boolean };
        disallowed = generalSetting.disallowUserRegistration !== false;
      } catch { /* keep default */ }
    }
    if (disallowed) throw createError({ statusCode: 403, message: "Signup is not allowed" });
  }

  const existingUser = await db.select().from(userTable).where(eq(userTable.username, body.username)).limit(1);
  if (existingUser[0]) throw createError({ statusCode: 409, message: "Username already exists" });

  const passwordHash = await hashPassword(body.password);
  const role = isFirstUser ? "ADMIN" : "USER";

  const [newUser] = await db.insert(userTable).values({
    username: body.username,
    passwordHash,
    role: role as "ADMIN" | "USER",
  }).returning();

  return { user: convertUser(newUser, newUser) };
});
