import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { user as userTable, memo as memoTable, inbox as inboxTable } from "../../store/db/schema";
import { eq, inArray } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { parent?: string };
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });

  const db = getDB();
  const username = body.parent?.replace("users/", "");
  if (!username) throw createError({ statusCode: 400, message: "Invalid parent" });

  if (currentUser.username !== username) throw createError({ statusCode: 403, message: "Permission denied" });

  const rows = await db.select().from(inboxTable).where(eq(inboxTable.receiverId, currentUser.id));
  if (!rows.length) return { notifications: [] };

  const senderIds = [...new Set(rows.map((r) => r.senderId))];
  const senders = await db.select({ id: userTable.id, username: userTable.username }).from(userTable)
    .where(inArray(userTable.id, senderIds));
  const senderMap = new Map(senders.map((u) => [u.id, u.username]));

  const memoIds = new Set<number>();
  for (const row of rows) {
    try {
      const msg = JSON.parse(row.message);
      if (msg.memoComment) { memoIds.add(msg.memoComment.memoId); memoIds.add(msg.memoComment.relatedMemoId); }
      if (msg.memoMention) { memoIds.add(msg.memoMention.memoId); }
    } catch { /* ignore */ }
  }

  const memoList = memoIds.size > 0
    ? await db.select({ id: memoTable.id, uid: memoTable.uid, content: memoTable.content }).from(memoTable)
        .where(inArray(memoTable.id, [...memoIds]))
    : [];
  const memoMap = new Map(memoList.map((m) => [m.id, m]));

  const notifications: any[] = [];
  for (const row of rows) {
    let msg: any = {};
    try { msg = JSON.parse(row.message); } catch { continue; }

    const senderUsername = senderMap.get(row.senderId);
    const base = {
      name: `users/${username}/notifications/${row.id}`,
      status: row.status,
      createTime: row.createdTs instanceof Date ? row.createdTs.toISOString() : new Date(Number(row.createdTs) * 1000).toISOString(),
      sender: `users/${senderUsername ?? row.senderId}`,
      type: msg.type,
    };

    if (msg.type === "MEMO_COMMENT" && msg.memoComment) {
      const memo = memoMap.get(msg.memoComment.memoId);
      const relatedMemo = memoMap.get(msg.memoComment.relatedMemoId);
      if (!memo || !relatedMemo) continue;
      notifications.push({ ...base, memoComment: { memo: `memos/${memo.uid}`, relatedMemo: `memos/${relatedMemo.uid}`, memoSnippet: (memo.content || "").slice(0, 100), relatedMemoSnippet: (relatedMemo.content || "").slice(0, 100) } });
    } else if (msg.type === "MEMO_MENTION" && msg.memoMention) {
      const memo = memoMap.get(msg.memoMention.memoId);
      if (!memo) continue;
      notifications.push({ ...base, memoMention: { memo: `memos/${memo.uid}`, memoSnippet: (memo.content || "").slice(0, 100) } });
    } else {
      notifications.push(base);
    }
  }

  return { notifications };
});
