import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { inbox as inboxTable } from "../../store/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const parts = (body.name || "").split("/");
  const username = parts[1];
  const notifId = parseInt(parts[3], 10);
  if (!username || isNaN(notifId)) throw createError({ statusCode: 400, message: "Invalid notification name" });

  if (currentUser.username !== username) throw createError({ statusCode: 403, message: "Permission denied" });

  await db.delete(inboxTable).where(and(eq(inboxTable.id, notifId), eq(inboxTable.receiverId, currentUser.id)));
  return {};
});
