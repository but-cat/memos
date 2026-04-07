import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { idp as idpTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { convertIdp } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { identityProvider?: any; updateMask?: { paths: string[] } };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const uid = body.identityProvider?.name?.replace("identityProviders/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid name" });

  const updates: Record<string, string> = {};
  const data = body.identityProvider || {};
  if (data.title || data.name) updates.name = data.title || data.name;
  if (data.identifierFilter !== undefined) updates.identifierFilter = data.identifierFilter;
  if (data.config !== undefined) updates.config = JSON.stringify(data.config);

  const [updated] = await db.update(idpTable).set(updates).where(eq(idpTable.uid, uid)).returning();
  return { identityProvider: convertIdp(updated, true) };
});
