import { defineEventHandler } from "h3";
import { getDB } from "../../store/db/db";
import { idp as idpTable } from "../../store/db/schema";
import { convertIdp } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  const db = getDB();
  const idps = await db.select().from(idpTable);
  return { identityProviders: idps.map((i) => convertIdp(i, currentUser?.role === "ADMIN")) };
});
