import { defineEventHandler, readBody } from "h3";
import { getDB } from "../../store/db/db";
import { reaction, user as userTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) return { reactions: [] };

  const reactions = await db
    .select({ id: reaction.id, creatorId: reaction.creatorId, contentId: reaction.contentId, reactionType: reaction.reactionType, creatorUsername: userTable.username })
    .from(reaction)
    .leftJoin(userTable, eq(reaction.creatorId, userTable.id))
    .where(eq(reaction.contentId, uid));

  return {
    reactions: reactions.map((r) => ({ id: r.id, creator: `users/${r.creatorUsername}`, contentId: r.contentId, reactionType: r.reactionType })),
  };
});
