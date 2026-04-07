import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../store/db/db";
import {
  memo as memoTable,
  memoRelation,
  memoShare,
  reaction,
  user as userTable,
  attachment as attachmentTable,
} from "../store/db/schema";
import { eq, and, or, desc, lt, count, inArray, sql, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { extractTags } from "../utils/helpers";

function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(Number(val) * 1000).toISOString();
}

function convertMemo(memo: any) {
  let payload: any = {};
  try {
    payload = JSON.parse(memo.payload || "{}");
  } catch {
    // ignore
  }

  return {
    name: `memos/${memo.uid}`,
    uid: memo.uid,
    rowStatus: memo.rowStatus,
    creator: `users/${memo.creatorUsername ?? memo.creatorId}`,
    createTime: tsToISO(memo.createdTs),
    updateTime: tsToISO(memo.updatedTs),
    displayTime: tsToISO(memo.createdTs),
    content: memo.content,
    visibility: memo.visibility,
    pinned: Boolean(memo.pinned),
    tags: payload.tags || [],
    resources: [],
    relations: [],
    reactions: [],
    location: payload.location ?? null,
    property: payload.property ?? null,
  };
}

export async function handleMemoService(method: string, event: H3Event) {
  switch (method) {
    case "CreateMemo":
      return createMemo(event);
    case "ListMemos":
      return listMemos(event);
    case "GetMemo":
      return getMemo(event);
    case "UpdateMemo":
      return updateMemo(event);
    case "DeleteMemo":
      return deleteMemo(event);
    case "SetMemoResources":
    case "SetMemoAttachments":
      return setMemoAttachments(event);
    case "ListMemoAttachments":
      return listMemoAttachments(event);
    case "CreateMemoShare":
      return createMemoShare(event);
    case "ListMemoShares":
      return listMemoShares(event);
    case "DeleteMemoShare":
      return deleteMemoShare(event);
    case "ListMemoComments":
      return listMemoComments(event);
    case "CreateMemoComment":
      return createMemoComment(event);
    case "GetMemoByShare":
      return getMemoByShare(event);
    case "ListMemoTags":
      return listMemoTags(event);
    case "RenameMemoTag":
      return renameMemoTag(event);
    case "DeleteMemoTag":
      return deleteMemoTag(event);
    case "SetMemoRelations":
      return setMemoRelations(event);
    case "ListMemoRelations":
      return listMemoRelations(event);
    case "UpsertMemoReaction":
      return upsertMemoReaction(event);
    case "DeleteMemoReaction":
      return deleteMemoReaction(event);
    case "ListMemoReactions":
      return listMemoReactions(event);
    default:
      throw createError({
        statusCode: 404,
        message: `MemoService.${method} not found`,
      });
  }
}

async function createMemo(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const body = (await readBody(event)) as { memo?: any; memoId?: string };
  const db = getDB();

  const uid = body.memoId || nanoid(8).toLowerCase();
  const memoData = body.memo || {};

  const payload: any = { tags: [], property: {} };
  if (memoData.location) payload.location = memoData.location;

  const tagMatches = extractTags(memoData.content || "");
  payload.tags = tagMatches;

  const insertData: any = {
    uid,
    creatorId: currentUser.id,
    content: memoData.content || "",
    visibility: memoData.visibility || "PRIVATE",
    pinned: memoData.pinned || false,
    payload: JSON.stringify(payload),
  };
  if (memoData.createTime) insertData.createdTs = new Date(memoData.createTime);
  if (memoData.updateTime) insertData.updatedTs = new Date(memoData.updateTime);

  const [newMemo] = await db.insert(memoTable).values(insertData).returning();

  return {
    memo: convertMemo({ ...newMemo, creatorUsername: currentUser.username }),
  };
}

async function listMemos(event: H3Event) {
  const body = (await readBody(event)) as {
    pageSize?: number;
    pageToken?: string;
    filter?: string;
    state?: string;
  };
  const currentUser = event.context.user;
  const db = getDB();

  const pageSize = Math.min(body.pageSize || 20, 100);
  const conditions: any[] = [];

  if (!currentUser) {
    conditions.push(eq(memoTable.visibility, "PUBLIC"));
  } else if (currentUser.role !== "ADMIN") {
    conditions.push(
      or(
        eq(memoTable.visibility, "PUBLIC"),
        eq(memoTable.visibility, "PROTECTED"),
        and(
          eq(memoTable.visibility, "PRIVATE"),
          eq(memoTable.creatorId, currentUser.id),
        ),
      ),
    );
  }

  if (body.state === "ARCHIVED") {
    conditions.push(eq(memoTable.rowStatus, "ARCHIVED"));
  } else {
    conditions.push(eq(memoTable.rowStatus, "NORMAL"));
  }

  if (body.filter) {
    const creatorMatch = body.filter.match(/creator\s*==\s*"([^"]+)"/);
    if (creatorMatch) {
      const username = creatorMatch[1].replace("users/", "");
      const users = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.username, username))
        .limit(1);
      if (users[0]) conditions.push(eq(memoTable.creatorId, users[0].id));
    }
    const tagMatch = body.filter.match(/tag\s*==\s*"([^"]+)"/);
    if (tagMatch) {
      const tagParam = `%"${tagMatch[1]}"%`;
      conditions.push(
        sql`json_extract(${memoTable.payload}, '$.tags') LIKE ${tagParam}`,
      );
    }
  }

  if (body.pageToken) {
    conditions.push(lt(memoTable.id, parseInt(body.pageToken)));
  }

  const memos = await db
    .select({
      id: memoTable.id,
      uid: memoTable.uid,
      creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs,
      updatedTs: memoTable.updatedTs,
      rowStatus: memoTable.rowStatus,
      content: memoTable.content,
      visibility: memoTable.visibility,
      pinned: memoTable.pinned,
      payload: memoTable.payload,
      creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(memoTable.pinned), desc(memoTable.createdTs))
    .limit(pageSize + 1);

  const hasMore = memos.length > pageSize;
  const resultMemos = hasMore ? memos.slice(0, pageSize) : memos;
  const nextPageToken =
    hasMore ? String(resultMemos[resultMemos.length - 1].id) : "";

  return {
    memos: resultMemos.map(convertMemo),
    nextPageToken,
  };
}

async function getMemo(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db
    .select({
      id: memoTable.id,
      uid: memoTable.uid,
      creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs,
      updatedTs: memoTable.updatedTs,
      rowStatus: memoTable.rowStatus,
      content: memoTable.content,
      visibility: memoTable.visibility,
      pinned: memoTable.pinned,
      payload: memoTable.payload,
      creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(eq(memoTable.uid, uid))
    .limit(1);

  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });
  const memo = memos[0];

  if (
    memo.visibility === "PRIVATE" &&
    (!currentUser || currentUser.id !== memo.creatorId)
  ) {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }
  if (memo.visibility === "PROTECTED" && !currentUser) {
    throw createError({ statusCode: 401, message: "Unauthenticated" });
  }

  return { memo: convertMemo(memo) };
}

async function updateMemo(event: H3Event) {
  const body = (await readBody(event)) as {
    memo?: any;
    updateMask?: { paths: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.memo?.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const existing = await db
    .select()
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!existing[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  if (existing[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const memoData = body.memo || {};
  const updates: Partial<typeof memoTable.$inferInsert> = {
    updatedTs: new Date(),
  };

  if (memoData.content !== undefined) {
    updates.content = memoData.content;
    const payload: any = {};
    try {
      Object.assign(payload, JSON.parse(existing[0].payload || "{}"));
    } catch {
      // ignore
    }
    const tagMatches = extractTags(memoData.content);
    payload.tags = tagMatches;
    updates.payload = JSON.stringify(payload);
  }
  if (memoData.visibility !== undefined) updates.visibility = memoData.visibility;
  if (memoData.pinned !== undefined) updates.pinned = memoData.pinned;
  if (memoData.rowStatus !== undefined) updates.rowStatus = memoData.rowStatus;

  const [updated] = await db
    .update(memoTable)
    .set(updates)
    .where(eq(memoTable.uid, uid))
    .returning();
  return {
    memo: convertMemo({ ...updated, creatorUsername: currentUser.username }),
  };
}

async function deleteMemo(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db
    .select()
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  if (memos[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  await db.delete(memoTable).where(eq(memoTable.uid, uid));
  return {};
}

async function listMemoComments(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("memos/", "").replace("/comments", "");
  if (!uid) return { memos: [] };

  const parent = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!parent[0]) return { memos: [] };

  const relations = await db
    .select()
    .from(memoRelation)
    .where(
      and(
        eq(memoRelation.relatedMemoId, parent[0].id),
        eq(memoRelation.type, "COMMENT"),
      ),
    );

  if (!relations.length) return { memos: [] };

  const commentIds = relations.map((r) => r.memoId);
  const comments = await db
    .select({
      id: memoTable.id,
      uid: memoTable.uid,
      creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs,
      updatedTs: memoTable.updatedTs,
      rowStatus: memoTable.rowStatus,
      content: memoTable.content,
      visibility: memoTable.visibility,
      pinned: memoTable.pinned,
      payload: memoTable.payload,
      creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(inArray(memoTable.id, commentIds));

  return { memos: comments.map(convertMemo) };
}

async function createMemoComment(event: H3Event) {
  const body = (await readBody(event)) as {
    name?: string;
    comment?: any;
    commentId?: string;
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const parentUid = body.name
    ?.replace("memos/", "")
    .replace("/comments", "");
  if (!parentUid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const parent = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, parentUid))
    .limit(1);
  if (!parent[0]) throw createError({ statusCode: 404, message: "Parent memo not found" });

  const uid = body.commentId || nanoid(8).toLowerCase();
  const memoData = body.comment || {};

  const [newMemo] = await db
    .insert(memoTable)
    .values({
      uid,
      creatorId: currentUser.id,
      content: memoData.content || "",
      visibility: memoData.visibility || "PRIVATE",
      payload: JSON.stringify({ tags: [] }),
    })
    .returning();

  await db.insert(memoRelation).values({
    memoId: newMemo.id,
    relatedMemoId: parent[0].id,
    type: "COMMENT",
  });

  return {
    memo: convertMemo({ ...newMemo, creatorUsername: currentUser.username }),
  };
}

async function getMemoByShare(event: H3Event) {
  const body = (await readBody(event)) as { shareToken?: string };
  const db = getDB();

  const share = await db
    .select()
    .from(memoShare)
    .where(eq(memoShare.uid, body.shareToken || ""))
    .limit(1);
  if (!share[0]) throw createError({ statusCode: 404, message: "Share not found" });

  const expTs = share[0].expiresTs;
  if (expTs) {
    const expDate = expTs instanceof Date ? expTs : new Date(Number(expTs) * 1000);
    if (new Date() > expDate) {
      throw createError({ statusCode: 410, message: "Share expired" });
    }
  }

  const memos = await db
    .select({
      id: memoTable.id,
      uid: memoTable.uid,
      creatorId: memoTable.creatorId,
      createdTs: memoTable.createdTs,
      updatedTs: memoTable.updatedTs,
      rowStatus: memoTable.rowStatus,
      content: memoTable.content,
      visibility: memoTable.visibility,
      pinned: memoTable.pinned,
      payload: memoTable.payload,
      creatorUsername: userTable.username,
    })
    .from(memoTable)
    .leftJoin(userTable, eq(memoTable.creatorId, userTable.id))
    .where(eq(memoTable.id, share[0].memoId))
    .limit(1);

  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });
  return { memo: convertMemo(memos[0]) };
}

async function listMemoTags(event: H3Event) {
  const body = (await readBody(event)) as {
    parent?: string;
    filter?: string;
  };
  const currentUser = event.context.user;
  const db = getDB();

  const conditions: any[] = [eq(memoTable.rowStatus, "NORMAL")];

  if (body.parent && body.parent !== "memos/-") {
    const username = body.parent.replace("users/", "");
    const users = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, username))
      .limit(1);
    if (users[0]) conditions.push(eq(memoTable.creatorId, users[0].id));
  }

  if (!currentUser) {
    conditions.push(eq(memoTable.visibility, "PUBLIC"));
  }

  const memos = await db
    .select({ payload: memoTable.payload })
    .from(memoTable)
    .where(and(...conditions));

  const tagCounts: Record<string, number> = {};
  for (const m of memos) {
    try {
      const payload = JSON.parse(m.payload || "{}");
      for (const tag of payload.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    } catch {
      // ignore
    }
  }

  return { tagAmounts: tagCounts };
}

async function renameMemoTag(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  throw createError({ statusCode: 501, message: "RenameMemoTag not yet implemented" });
}

async function deleteMemoTag(event: H3Event) {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  throw createError({ statusCode: 501, message: "DeleteMemoTag not yet implemented" });
}

async function setMemoRelations(event: H3Event) {
  const body = (await readBody(event)) as {
    name?: string;
    relations?: any[];
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  await db
    .delete(memoRelation)
    .where(eq(memoRelation.memoId, memos[0].id));

  const relUids = (body.relations || [])
    .map((rel) => rel.relatedMemo?.replace("memos/", ""))
    .filter(Boolean) as string[];

  if (relUids.length > 0) {
    const relMemos = await db
      .select({ id: memoTable.id, uid: memoTable.uid })
      .from(memoTable)
      .where(inArray(memoTable.uid, relUids));

    const relMemoMap = new Map(relMemos.map((m) => [m.uid, m.id]));

    for (const rel of body.relations || []) {
      const relUid = rel.relatedMemo?.replace("memos/", "");
      if (!relUid) continue;
      const relMemoId = relMemoMap.get(relUid);
      if (!relMemoId) continue;
      await db
        .insert(memoRelation)
        .values({
          memoId: memos[0].id,
          relatedMemoId: relMemoId,
          type: rel.type || "REFERENCE",
        })
        .onConflictDoNothing();
    }
  }

  return {};
}

async function listMemoRelations(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) return { relations: [] };

  const memos = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!memos[0]) return { relations: [] };

  const relations = await db
    .select({
      type: memoRelation.type,
      relatedUid: memoTable.uid,
    })
    .from(memoRelation)
    .leftJoin(memoTable, eq(memoRelation.relatedMemoId, memoTable.id))
    .where(eq(memoRelation.memoId, memos[0].id));

  return {
    relations: relations.map((r) => ({
      memo: `memos/${uid}`,
      relatedMemo: `memos/${r.relatedUid}`,
      type: r.type,
    })),
  };
}

async function upsertMemoReaction(event: H3Event) {
  const body = (await readBody(event)) as {
    name?: string;
    reaction?: { reactionType: string };
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid || !body.reaction?.reactionType)
    throw createError({ statusCode: 400, message: "Invalid request" });

  const [r] = await db
    .insert(reaction)
    .values({
      creatorId: currentUser.id,
      contentId: uid,
      reactionType: body.reaction.reactionType,
    })
    .onConflictDoNothing()
    .returning();

  return {
    reaction: r
      ? {
          id: r.id,
          creator: `users/${currentUser.username}`,
          contentId: uid,
          reactionType: r.reactionType,
        }
      : null,
  };
}

async function deleteMemoReaction(event: H3Event) {
  const body = (await readBody(event)) as { reactionId?: number };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  if (!body.reactionId)
    throw createError({ statusCode: 400, message: "Invalid reaction id" });

  const db = getDB();
  await db
    .delete(reaction)
    .where(
      and(
        eq(reaction.id, body.reactionId),
        eq(reaction.creatorId, currentUser.id),
      ),
    );
  return {};
}

async function listMemoReactions(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) return { reactions: [] };

  const reactions = await db
    .select({
      id: reaction.id,
      creatorId: reaction.creatorId,
      contentId: reaction.contentId,
      reactionType: reaction.reactionType,
      creatorUsername: userTable.username,
    })
    .from(reaction)
    .leftJoin(userTable, eq(reaction.creatorId, userTable.id))
    .where(eq(reaction.contentId, uid));

  return {
    reactions: reactions.map((r) => ({
      id: r.id,
      creator: `users/${r.creatorUsername}`,
      contentId: r.contentId,
      reactionType: r.reactionType,
    })),
  };
}

async function setMemoAttachments(event: H3Event) {
  const body = (await readBody(event)) as {
    name?: string;
    attachments?: Array<{ name: string }>;
  };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db
    .select({ id: memoTable.id, creatorId: memoTable.creatorId })
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });
  if (memos[0].creatorId !== currentUser.id && currentUser.role !== "ADMIN") {
    throw createError({ statusCode: 403, message: "Permission denied" });
  }

  const requestedUids = (body.attachments || [])
    .map((a) => a.name?.replace("attachments/", ""))
    .filter(Boolean) as string[];

  // Detach all currently-linked attachments for this memo.
  await db
    .update(attachmentTable)
    .set({ memoId: null })
    .where(eq(attachmentTable.memoId, memos[0].id));

  // Link the requested attachments.
  if (requestedUids.length > 0) {
    await db
      .update(attachmentTable)
      .set({ memoId: memos[0].id })
      .where(inArray(attachmentTable.uid, requestedUids));
  }

  return {};
}

async function listMemoAttachments(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();

  const uid = body.name?.replace("memos/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid memo name" });

  const memos = await db
    .select({ id: memoTable.id, visibility: memoTable.visibility, creatorId: memoTable.creatorId })
    .from(memoTable)
    .where(eq(memoTable.uid, uid))
    .limit(1);
  if (!memos[0]) throw createError({ statusCode: 404, message: "Memo not found" });

  const memo = memos[0];
  if (memo.visibility === "PRIVATE") {
    if (!currentUser || (currentUser.id !== memo.creatorId && currentUser.role !== "ADMIN")) {
      throw createError({ statusCode: 403, message: "Permission denied" });
    }
  } else if (memo.visibility === "PROTECTED" && !currentUser) {
    throw createError({ statusCode: 401, message: "Unauthenticated" });
  }

  const attachments = await db
    .select({
      uid: attachmentTable.uid,
      createdTs: attachmentTable.createdTs,
      filename: attachmentTable.filename,
      type: attachmentTable.type,
      size: attachmentTable.size,
      storageType: attachmentTable.storageType,
      reference: attachmentTable.reference,
    })
    .from(attachmentTable)
    .where(eq(attachmentTable.memoId, memo.id));

  return {
    attachments: attachments.map((a) => ({
      name: `attachments/${a.uid}`,
      uid: a.uid,
      createTime: tsToISO(a.createdTs),
      filename: a.filename,
      type: a.type,
      size: a.size,
      storageType: a.storageType,
      reference: a.reference,
    })),
  };
}

async function createMemoShare(event: H3Event) {
  const body = (await readBody(event)) as { name?: string; expiresAt?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
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

async function listMemoShares(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const memoUid = body.name?.replace("memos/", "").replace("/shares", "") || "";
  const memos = await db
    .select({ id: memoTable.id })
    .from(memoTable)
    .where(eq(memoTable.uid, memoUid))
    .limit(1);
  if (!memos[0]) return { memoShares: [] };

  const shares = await db
    .select()
    .from(memoShare)
    .where(and(eq(memoShare.memoId, memos[0].id), eq(memoShare.creatorId, currentUser.id)));

  return {
    memoShares: shares.map((s) => ({
      name: `memos/${memoUid}/shares/${s.uid}`,
      uid: s.uid,
      createTime: tsToISO(s.createdTs),
      expiresAt: s.expiresTs ? tsToISO(s.expiresTs) : null,
    })),
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
    .where(and(eq(memoShare.uid, shareUid), eq(memoShare.creatorId, currentUser.id)));
  return {};
}
