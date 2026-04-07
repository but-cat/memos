import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { idp as idpTable } from "../../store/db/schema";
import { eq } from "drizzle-orm";
import { convertIdp } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();
  const uid = body.name?.replace("identityProviders/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid name" });

  const idps = await db.select().from(idpTable).where(eq(idpTable.uid, uid)).limit(1);
  if (!idps[0]) throw createError({ statusCode: 404, message: "Identity provider not found" });

  return { identityProvider: convertIdp(idps[0], currentUser?.role === "ADMIN") };
});
