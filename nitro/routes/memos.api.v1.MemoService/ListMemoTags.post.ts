import { defineEventHandler, readBody } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, user as userTable } from "../../store/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { parent?: string; filter?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const conditions: any[] = [eq(memoTable.rowStatus, "NORMAL")];

  if (body.parent && body.parent !== "memos/-") {
    const username = body.parent.replace("users/", "");
    const users = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.username, username)).limit(1);
    if (users[0]) conditions.push(eq(memoTable.creatorId, users[0].id));
  }

  if (!currentUser) conditions.push(eq(memoTable.visibility, "PUBLIC"));

  const memos = await db.select({ payload: memoTable.payload }).from(memoTable).where(and(...conditions));

  const tagCounts: Record<string, number> = {};
  for (const m of memos) {
    try {
      const payload = JSON.parse(m.payload || "{}");
      for (const tag of payload.tags || []) { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }
    } catch { /* ignore */ }
  }

  return { tagAmounts: tagCounts };
});
