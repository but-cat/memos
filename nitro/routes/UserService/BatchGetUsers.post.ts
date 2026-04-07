import { defineEventHandler, readBody } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable } from "../../store/db/schema";
import { inArray } from "drizzle-orm";
import { convertUser } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { names?: string[] };
  const currentUser = event.context.user;
  const db = getDB();

  if (!body.names?.length) return { users: [] };

  const usernames = body.names.map((u) => u.replace("users/", ""));
  const users = await db.select().from(userTable).where(inArray(userTable.username, usernames));
  return { users: users.map((u) => convertUser(u, currentUser)) };
});
