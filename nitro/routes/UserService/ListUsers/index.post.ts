import { defineEventHandler, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { user as userTable } from "../../../store/db/schema";
import { convertUser } from "../../../utils/format";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }
  const db = getDB();
  const users = await db.select().from(userTable);
  return { users: users.map((u) => convertUser(u, currentUser)), totalSize: users.length };
});
