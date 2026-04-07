import { eq, and } from "drizzle-orm";
import { idp as idpTable } from "./db/schema";
import type { DrizzleDB } from "./db/db";
import type {
  IdentityProvider,
  FindIdentityProvider,
  UpdateIdentityProvider,
  DeleteIdentityProvider,
  IdpType,
} from "./types";

function rowToIdp(row: typeof idpTable.$inferSelect): IdentityProvider {
  return {
    id: row.id,
    uid: row.uid,
    name: row.name,
    type: row.type as IdpType,
    identifierFilter: row.identifierFilter,
    config: row.config,
  };
}

export async function createIdentityProvider(
  db: DrizzleDB,
  create: Omit<IdentityProvider, "id">,
): Promise<IdentityProvider> {
  const [row] = await db
    .insert(idpTable)
    .values({
      uid: create.uid,
      name: create.name,
      type: create.type,
      identifierFilter: create.identifierFilter,
      config: create.config,
    })
    .returning();
  return rowToIdp(row);
}

export async function listIdentityProviders(
  db: DrizzleDB,
  find: FindIdentityProvider,
): Promise<IdentityProvider[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (find.id !== undefined) conditions.push(eq(idpTable.id, find.id));
  if (find.uid !== undefined) conditions.push(eq(idpTable.uid, find.uid));

  const rows = await db
    .select()
    .from(idpTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return rows.map(rowToIdp);
}

export async function updateIdentityProvider(
  db: DrizzleDB,
  update: UpdateIdentityProvider,
): Promise<IdentityProvider> {
  const setFields: Partial<typeof idpTable.$inferInsert> = {};

  if (update.name !== undefined) setFields.name = update.name;
  if (update.identifierFilter !== undefined) setFields.identifierFilter = update.identifierFilter;
  if (update.config !== undefined) setFields.config = update.config;

  const [row] = await db
    .update(idpTable)
    .set(setFields)
    .where(eq(idpTable.id, update.id))
    .returning();
  return rowToIdp(row);
}

export async function deleteIdentityProvider(
  db: DrizzleDB,
  del: DeleteIdentityProvider,
): Promise<void> {
  await db.delete(idpTable).where(eq(idpTable.id, del.id));
}
