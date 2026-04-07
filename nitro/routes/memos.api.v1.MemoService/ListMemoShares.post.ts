import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, memoShare } from "../../store/db/schema";
import { eq, and } from "drizzle-orm";
import { tsToISO } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const memoUid = body.name?.replace("memos/", "").replace("/shares", "") || "";
  const memos = await db.select({ id: memoTable.id }).from(memoTable).where(eq(memoTable.uid, memoUid)).limit(1);
  if (!memos[0]) return { memoShares: [] };

  const shares = await db.select().from(memoShare).where(and(eq(memoShare.memoId, memos[0].id), eq(memoShare.creatorId, currentUser.id)));

  return {
    memoShares: shares.map((s) => ({
      name: `memos/${memoUid}/shares/${s.uid}`,
      uid: s.uid,
      createTime: tsToISO(s.createdTs),
      expiresAt: s.expiresTs ? tsToISO(s.expiresTs) : null,
    })),
  };
});
