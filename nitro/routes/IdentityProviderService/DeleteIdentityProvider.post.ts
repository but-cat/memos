import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { idp as idpTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const uid = body.name?.replace("identityProviders/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid name" });
  await db.delete(idpTable).where(eq(idpTable.uid, uid));
  return {};
});
