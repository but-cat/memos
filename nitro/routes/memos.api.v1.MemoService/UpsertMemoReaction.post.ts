import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { reaction } from "../../store/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string; reaction?: { reactionType: string } };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid || !body.reaction?.reactionType) throw createError({ statusCode: 400, message: "Invalid request" });

  const [r] = await db.insert(reaction).values({
    creatorId: currentUser.id,
    contentId: uid,
    reactionType: body.reaction.reactionType,
  }).onConflictDoNothing().returning();

  return {
    reaction: r ? { id: r.id, creator: `users/${currentUser.username}`, contentId: uid, reactionType: r.reactionType } : null,
  };
});
