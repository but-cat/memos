import { defineEventHandler, setResponseHeader, getRouterParam, createError } from "h3";
import { Feed } from "feed";
import { getDB } from "../../store/db/db";
import { memo as memoTable, user as userTable } from "../../store/db/schema";
import { eq, and, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, "username");
  if (!username) throw createError({ statusCode: 400, message: "Username required" });

  const db = getDB();

  const users = await db
    .select()
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1);
  if (!users[0]) throw createError({ statusCode: 404, message: "User not found" });

  const memos = await db
    .select()
    .from(memoTable)
    .where(
      and(
        eq(memoTable.creatorId, users[0].id),
        eq(memoTable.visibility, "PUBLIC"),
        eq(memoTable.rowStatus, "NORMAL"),
      ),
    )
    .orderBy(desc(memoTable.createdTs))
    .limit(20);

  const instanceUrl = process.env.INSTANCE_URL || "http://localhost:8081";
  const displayName = users[0].nickname || users[0].username;

  const latestDate =
    memos[0]?.createdTs instanceof Date
      ? memos[0].createdTs
      : memos[0]
        ? new Date(Number(memos[0].createdTs) * 1000)
        : new Date();

  const feed = new Feed({
    title: `${displayName}'s Memos`,
    description: users[0].description || "",
    id: `${instanceUrl}/u/${username}`,
    link: `${instanceUrl}/u/${username}`,
    updated: latestDate,
    copyright: "",
  });

  for (const memo of memos) {
    const createTime =
      memo.createdTs instanceof Date
        ? memo.createdTs
        : new Date(Number(memo.createdTs) * 1000);
    feed.addItem({
      title: memo.content.slice(0, 80) || "Memo",
      id: `${instanceUrl}/memos/${memo.uid}`,
      link: `${instanceUrl}/memos/${memo.uid}`,
      content: memo.content,
      date: createTime,
    });
  }

  setResponseHeader(event, "Content-Type", "application/rss+xml; charset=utf-8");
  return feed.rss2();
});
