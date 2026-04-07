import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { memo as memoTable, memoShare } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { tsToISO } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string; expiresAt?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const memoUid = body.name?.replace("memos/", "").replace("/shares", "") || "";
  const memos = await db.select({ id: memoTable.id }).from(memoTable).where(eq(memoTable.uid, memoUid)).limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  const shareUid = nanoid(16).toLowerCase();
  const [share] = await db.insert(memoShare).values({
    uid: shareUid,
    memoId: memos[0].id,
    creatorId: currentUser.id,
    expiresTs: body.expiresAt ? new Date(body.expiresAt) : null,
  }).returning();

  return {
    memoShare: {
      name: `memos/${memoUid}/shares/${share.uid}`,
      uid: share.uid,
      createTime: tsToISO(share.createdTs),
      expiresAt: share.expiresTs ? tsToISO(share.expiresTs) : null,
    },
  };
});
