import { defineNitroPlugin } from "nitropack/runtime";
import cron from "node-cron";
import { getDB } from "../utils/db";
import { attachment as attachmentTable } from "../db/schema";
import { eq } from "drizzle-orm";

async function refreshS3PresignedUrls() {
  const db = getDB();
  try {
    const s3Attachments = await db
      .select({
        uid: attachmentTable.uid,
        reference: attachmentTable.reference,
      })
      .from(attachmentTable)
      .where(eq(attachmentTable.storageType, "S3_PRESIGN"));

    if (s3Attachments.length === 0) return;

    const { refreshPresignedUrls } = await import("../utils/storage");
    const updated = await refreshPresignedUrls(s3Attachments as { uid: string; reference: string }[], 3600);

    for (const [uid, newReference] of updated) {
      await db
        .update(attachmentTable)
        .set({ reference: newReference, updatedTs: new Date() })
        .where(eq(attachmentTable.uid, uid));
    }

    console.log(`[s3-presign] Refreshed ${updated.size} presigned URLs`);
  } catch (error) {
    // S3 may not be configured; silently skip
    if (!(error as Error).message?.includes("S3 not initialized")) {
      console.error("[s3-presign] Failed to refresh URLs:", error);
    }
  }
}

export default defineNitroPlugin((nitroApp) => {
  // Refresh presigned URLs every 50 minutes (before 1-hour expiry)
  const job = cron.schedule(
    "*/50 * * * *",
    () => {
      refreshS3PresignedUrls();
    },
    { scheduled: true },
  );

  nitroApp.hooks.hook("close", () => {
    job.stop();
  });
});
