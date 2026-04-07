import { defineEventHandler, readBody, createError } from "h3";
import { getDB } from "../../store/db/db";
import { idp as idpTable } from "../../store/db/schema";
import { nanoid } from "nanoid";
import { convertIdp } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { identityProvider?: any };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN") throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const data = body.identityProvider || {};
  const uid = nanoid(8).toLowerCase();

  const [newIdp] = await db.insert(idpTable).values({
    uid,
    name: data.title || data.name || "",
    type: data.type || "OAUTH2",
    identifierFilter: data.identifierFilter || "",
    config: JSON.stringify(data.config || {}),
  }).returning();

  return { identityProvider: convertIdp(newIdp, true) };
});
