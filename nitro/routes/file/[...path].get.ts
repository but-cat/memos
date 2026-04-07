import {
  defineEventHandler,
  getRouterParam,
  setResponseHeader,
  sendStream,
  sendRedirect,
  createError,
} from "h3";
import { getDB } from "../../store/db/db";
import { attachment as attachmentTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

export default defineEventHandler(async (event) => {
  const filePath = getRouterParam(event, "path") || "";
  const db = getDB();

  // Try to find attachment by uid derived from filename
  const uid = filePath.split("/").pop()?.split(".")[0] || "";

  const attachments = await db
    .select()
    .from(attachmentTable)
    .where(eq(attachmentTable.uid, uid))
    .limit(1);

  if (attachments[0]) {
    const attachment = attachments[0];

    // Database storage
    if (attachment.storageType === "DATABASE" && attachment.blob) {
      setResponseHeader(
        event,
        "Content-Type",
        attachment.type || "application/octet-stream",
      );
      setResponseHeader(event, "Content-Length", String(attachment.size));
      setResponseHeader(event, "Cache-Control", "public, max-age=31536000");
      return attachment.blob;
    }

    // Local file storage
    if (attachment.storageType === "LOCAL" && attachment.reference) {
      const dataDir = process.env.DATA_DIR || "./data";
      const fullPath = path.join(dataDir, attachment.reference);

      try {
        const stats = await stat(fullPath);
        setResponseHeader(
          event,
          "Content-Type",
          attachment.type || "application/octet-stream",
        );
        setResponseHeader(event, "Content-Length", String(stats.size));
        setResponseHeader(event, "Cache-Control", "public, max-age=31536000");

        const stream = createReadStream(fullPath);
        return sendStream(event, stream);
      } catch {
        throw createError({ statusCode: 404, message: "File not found" });
      }
    }

    // External storage (S3 redirect)
    if (attachment.reference) {
      return sendRedirect(event, attachment.reference, 302);
    }
  }

  // Fallback: serve from local data directory
  const dataDir = process.env.DATA_DIR || "./data";
  const fullPath = path.join(dataDir, filePath);

  try {
    const stats = await stat(fullPath);
    if (!stats.isFile())
      throw createError({ statusCode: 404, message: "Not a file" });

    const stream = createReadStream(fullPath);
    return sendStream(event, stream);
  } catch {
    throw createError({ statusCode: 404, message: "File not found" });
  }
});
