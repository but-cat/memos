import type { H3Event } from "h3";
import { readBody, createError } from "h3";
import { getDB } from "../store/db/db";
import { idp as idpTable } from "../store/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

function convertIdp(idp: any, isAdmin: boolean) {
  let config: any = {};
  try {
    config = JSON.parse(idp.config || "{}");
  } catch {
    // ignore
  }
  if (!isAdmin && config.clientSecret) {
    config.clientSecret = "";
  }
  return {
    name: `identityProviders/${idp.uid}`,
    uid: idp.uid,
    title: idp.name,
    type: idp.type,
    identifierFilter: idp.identifierFilter,
    config,
  };
}

export async function handleIdpService(method: string, event: H3Event) {
  switch (method) {
    case "ListIdentityProviders":
      return listIdentityProviders(event);
    case "GetIdentityProvider":
      return getIdentityProvider(event);
    case "CreateIdentityProvider":
      return createIdentityProvider(event);
    case "UpdateIdentityProvider":
      return updateIdentityProvider(event);
    case "DeleteIdentityProvider":
      return deleteIdentityProvider(event);
    default:
      throw createError({
        statusCode: 404,
        message: `IdentityProviderService.${method} not found`,
      });
  }
}

async function listIdentityProviders(event: H3Event) {
  const currentUser = event.context.user;
  const db = getDB();
  const idps = await db.select().from(idpTable);
  return {
    identityProviders: idps.map((i) =>
      convertIdp(i, currentUser?.role === "ADMIN"),
    ),
  };
}

async function getIdentityProvider(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  const db = getDB();
  const uid = body.name?.replace("identityProviders/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid name" });
  const idps = await db
    .select()
    .from(idpTable)
    .where(eq(idpTable.uid, uid))
    .limit(1);
  if (!idps[0])
    throw createError({ statusCode: 404, message: "Identity provider not found" });
  return {
    identityProvider: convertIdp(idps[0], currentUser?.role === "ADMIN"),
  };
}

async function createIdentityProvider(event: H3Event) {
  const body = (await readBody(event)) as { identityProvider?: any };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN")
    throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const data = body.identityProvider || {};
  const uid = nanoid(8).toLowerCase();

  const [newIdp] = await db
    .insert(idpTable)
    .values({
      uid,
      name: data.title || data.name || "",
      type: data.type || "OAUTH2",
      identifierFilter: data.identifierFilter || "",
      config: JSON.stringify(data.config || {}),
    })
    .returning();

  return { identityProvider: convertIdp(newIdp, true) };
}

async function updateIdentityProvider(event: H3Event) {
  const body = (await readBody(event)) as {
    identityProvider?: any;
    updateMask?: { paths: string[] };
  };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN")
    throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const uid = body.identityProvider?.name?.replace("identityProviders/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid name" });

  const updates: Record<string, string> = {};
  const data = body.identityProvider || {};
  if (data.title || data.name) updates.name = data.title || data.name;
  if (data.identifierFilter !== undefined)
    updates.identifierFilter = data.identifierFilter;
  if (data.config !== undefined) updates.config = JSON.stringify(data.config);

  const [updated] = await db
    .update(idpTable)
    .set(updates)
    .where(eq(idpTable.uid, uid))
    .returning();
  return { identityProvider: convertIdp(updated, true) };
}

async function deleteIdentityProvider(event: H3Event) {
  const body = (await readBody(event)) as { name?: string };
  const currentUser = event.context.user;
  if (!currentUser || currentUser.role !== "ADMIN")
    throw createError({ statusCode: 403, message: "Admin required" });

  const db = getDB();
  const uid = body.name?.replace("identityProviders/", "");
  if (!uid) throw createError({ statusCode: 400, message: "Invalid name" });
  await db.delete(idpTable).where(eq(idpTable.uid, uid));
  return {};
}
