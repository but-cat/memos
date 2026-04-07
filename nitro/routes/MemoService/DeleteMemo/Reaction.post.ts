import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { reaction } from "../../../store/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { reactionId?: number };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  if (!body.reactionId) throw createError({ statusCode: 400, message: "Invalid reaction id" });

  const db = getDB();
  await db.delete(reaction).where(and(eq(reaction.id, body.reactionId), eq(reaction.creatorId, currentUser.id)));
  return {};
});
