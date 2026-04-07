import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../store/db/db";
import { memoShare, memo as memoTable } from "../store/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(Number(val) * 1000).toISOString();
}

export async function handleMemoShareService(method: string, event: H3Event) {
  switch (method) {
    case "CreateMemoShare":
      return createMemoShare(event);
    case "DeleteMemoShare":
      return deleteMemoShare(event);
    case "ListMemoShares":
      return listMemoShares(event);
    default:
      throw createError({
        statusCode: 404,
        message: `MemoShareService.${method} not found`,
      });
  }
}

async function createMemoShare(event: H3Event) {
  const body = (await readBody(event)) as {
    name?: string;
    expiresAt?: string;
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  // name is like "memos/{uid}/shares"
  const memoUid = body.name?.replace("memos/", "").replace("/shares", "") || "";
  const memos = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, memoUid))
    .limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  const shareUid = nanoid(16).toLowerCase();
  const [share] = await db
    .insert(memoShare)
    .values({
      uid: shareUid,
      memoId: memos[0].id,
      creatorId: currentUser.id,
      expiresTs: body.expiresAt ? new Date(body.expiresAt) : null,
    })
    .returning();

  return {
    memoShare: {
      name: `memos/${memoUid}/shares/${share.uid}`,
      uid: share.uid,
      createTime: tsToISO(share.createdTs),
      expiresAt: share.expiresTs ? tsToISO(share.expiresTs) : null,
    },
  };
}

async function deleteMemoShare(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const shareUid = body.name?.split("/shares/").pop() || "";
  const db = getDB();
  await db
    .delete(memoShare)
    .where(
      and(eq(memoShare.uid, shareUid), eq(memoShare.creatorId, currentUser.id)),
    );
  return {};
}

async function listMemoShares(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const memoUid =
    body.name?.replace("memos/", "").replace("/shares", "") || "";
  const memos = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, memoUid))
    .limit(1);
  if (!memos[0]) return { memoShares: [] };

  const shares = await db
    .select()
    .from(memoShare)
    .where(
      and(
        eq(memoShare.memoId, memos[0].id),
        eq(memoShare.creatorId, currentUser.id),
      ),
    );

  return {
    memoShares: shares.map((s) => ({
      name: `memos/${memoUid}/shares/${s.uid}`,
      uid: s.uid,
      createTime: tsToISO(s.createdTs),
      expiresAt: s.expiresTs ? tsToISO(s.expiresTs) : null,
    })),
  };
}
