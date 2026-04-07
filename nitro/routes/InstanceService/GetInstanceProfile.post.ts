import { defineEventHandler } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (_event) => {
  const db = getDB();
  const admins = await db.select({ username: userTable.username }).from(userTable).where(eq(userTable.role, "ADMIN")).limit(1);

  return {
    version: process.env.MEMOS_VERSION || "0.26.0",
    demo: process.env.MEMOS_DEMO === "true",
    instanceUrl: process.env.INSTANCE_URL || "",
    admin: admins[0] ? `users/${admins[0].username}` : null,
  };
});
