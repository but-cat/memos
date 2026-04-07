import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../../store/db/db";
import { memoShare } from "../../../store/db/schema";
import { eq, and } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const shareUid = body.name?.split("/shares/").pop() || "";
  const db = getDB();
  await db.delete(memoShare).where(and(eq(memoShare.uid, shareUid), eq(memoShare.creatorId, currentUser.id)));
  return {};
});
