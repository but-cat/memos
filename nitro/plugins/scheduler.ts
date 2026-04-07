import { defineNitroPlugin } from "nitropack/runtime";
import cron from "node-cron";
import { getDB } from "../utils/db";
import { memo as memoTable, attachment as attachmentTable } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";

function extractTagsFromContent(content: string): string[] {
  const tagMatches = content.match(/#([^\s#]+)/g) || [];
  return tagMatches.map((t) => t.slice(1));
}

async function rebuildMemoPayloads() {
  const db = getDB();
  try {
    const memos = await db
      .select({
        id: memoTable.id,
        content: memoTable.content,
        payload: memoTable.payload,
      })
      .from(memoTable)
      .where(eq(memoTable.rowStatus, "NORMAL"))
      .limit(100);

    for (const memo of memos) {
      let payload: { tags?: string[] } = {};
      try {
        payload = JSON.parse(memo.payload || "{}");
      } catch (err) {
        console.warn(`[scheduler] Malformed payload for memo ${memo.id}:`, err);
      }

      const tags = extractTagsFromContent(memo.content);
      const currentTags = payload.tags || [];

      if (
        JSON.stringify(tags.sort()) !== JSON.stringify([...currentTags].sort())
      ) {
        payload.tags = tags;
        await db
          .update(memoTable)
          .set({ payload: JSON.stringify(payload) })
          .where(eq(memoTable.id, memo.id));
      }
    }
  } catch (error) {
    console.error("[scheduler] Failed to rebuild memo payloads:", error);
  }
}

async function cleanOrphanedAttachments() {
  const db = getDB();
  try {
    const orphans = await db
      .select({ id: attachmentTable.id, uid: attachmentTable.uid })
      .from(attachmentTable)
      .where(and(isNull(attachmentTable.memoId)))
      .limit(50);

    if (orphans.length > 0) {
      console.log(`[scheduler] Found ${orphans.length} orphaned attachments`);
    }
  } catch (error) {
    console.error(
      "[scheduler] Failed to check orphaned attachments:",
      error,
    );
  }
}

export default defineNitroPlugin((nitroApp) => {
  // Rebuild memo payloads every 5 minutes
  const payloadJob = cron.schedule(
    "*/5 * * * *",
    () => {
      rebuildMemoPayloads();
    },
    { scheduled: true },
  );

  // Check orphaned attachments daily at 3 AM
  const cleanupJob = cron.schedule(
    "0 3 * * *",
    () => {
      cleanOrphanedAttachments();
    },
    { scheduled: true },
  );

  console.log(
    "✅ Scheduler started (payload rebuild every 5min, cleanup daily at 3AM)",
  );

  nitroApp.hooks.hook("close", () => {
    payloadJob.stop();
    cleanupJob.stop();
    console.log("✅ Scheduler stopped");
  });
});
