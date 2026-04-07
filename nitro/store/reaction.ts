import { eq, and, inArray } from "drizzle-orm";
import { reaction as reactionTable } from "./db/schema";
import type { DrizzleDB } from "./db/db";
import type { Reaction, FindReaction, DeleteReaction } from "./types";

function rowToReaction(row: typeof reactionTable.$inferSelect): Reaction {
  return {
    id: row.id,
    createdTs: row.createdTs instanceof Date ? Math.floor(row.createdTs.getTime() / 1000) : Number(row.createdTs),
    creatorId: row.creatorId,
    contentId: row.contentId,
    reactionType: row.reactionType,
  };
}

export async function upsertReaction(
  db: DrizzleDB,
  r: Omit<Reaction, "id">,
): Promise<Reaction> {
  const [row] = await db
    .insert(reactionTable)
    .values({
      createdTs: new Date(r.createdTs * 1000),
      creatorId: r.creatorId,
      contentId: r.contentId,
      reactionType: r.reactionType,
    })
    .onConflictDoUpdate({
      target: [reactionTable.creatorId, reactionTable.contentId, reactionTable.reactionType],
      set: { reactionType: r.reactionType },
    })
    .returning();
  return rowToReaction(row);
}

export async function listReactions(
  db: DrizzleDB,
  find: FindReaction,
): Promise<Reaction[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) conditions.push(eq(reactionTable.id, find.id));
  if (find.creatorId !== undefined) conditions.push(eq(reactionTable.creatorId, find.creatorId));
  if (find.contentId !== undefined) conditions.push(eq(reactionTable.contentId, find.contentId));
  if (find.contentIdList && find.contentIdList.length > 0) {
    conditions.push(inArray(reactionTable.contentId, find.contentIdList));
  }

  const rows = await db
    .select()
    .from(reactionTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToReaction);
}

export async function getReaction(
  db: DrizzleDB,
  find: FindReaction,
): Promise<Reaction | null> {
  const rows = await listReactions(db, find);
  return rows[0] ?? null;
}

export async function deleteReaction(
  db: DrizzleDB,
  del: DeleteReaction,
): Promise<void> {
  await db.delete(reactionTable).where(eq(reactionTable.id, del.id));
}
