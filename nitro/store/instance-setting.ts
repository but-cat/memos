import { eq } from "drizzle-orm";
import { systemSetting } from "../db/schema";
import type { DrizzleDB } from "../utils/db";
import type {
  InstanceSettingKey,
  InstanceSettingValue,
  InstanceSettingRow,
  FindInstanceSetting,
  InstanceBasicSetting,
  InstanceGeneralSetting,
  InstanceStorageSetting,
  InstanceMemoRelatedSetting,
  InstanceTagsSetting,
  InstanceNotificationSetting,
} from "./types";

const DEFAULT_REACTIONS = ["👍", "👎", "❤️", "🎉", "😄", "😕", "😢", "😡"];

function parseSettingValue(name: InstanceSettingKey, raw: string): InstanceSettingValue {
  try {
    return JSON.parse(raw) as InstanceSettingValue;
  } catch {
    return {} as InstanceSettingValue;
  }
}

export async function upsertInstanceSetting(
  db: DrizzleDB,
  name: InstanceSettingKey,
  value: InstanceSettingValue,
): Promise<void> {
  const serialized = JSON.stringify(value);
  await db
    .insert(systemSetting)
    .values({ name, value: serialized, description: "" })
    .onConflictDoUpdate({
      target: [systemSetting.name],
      set: { value: serialized },
    });
}

export async function listInstanceSettings(
  db: DrizzleDB,
  find?: FindInstanceSetting,
): Promise<InstanceSettingRow[]> {
  let rows: { name: string; value: string; description: string }[];

  if (find?.name) {
    rows = await db
      .select()
      .from(systemSetting)
      .where(eq(systemSetting.name, find.name));
  } else {
    rows = await db.select().from(systemSetting);
  }

  return rows.map((row) => ({
    name: row.name as InstanceSettingKey,
    value: parseSettingValue(row.name as InstanceSettingKey, row.value),
    description: row.description,
  }));
}

export async function getInstanceSetting(
  db: DrizzleDB,
  find: FindInstanceSetting,
): Promise<InstanceSettingRow | null> {
  const rows = await listInstanceSettings(db, find);
  return rows[0] ?? null;
}

export async function getInstanceBasicSetting(
  db: DrizzleDB,
): Promise<InstanceBasicSetting> {
  const row = await getInstanceSetting(db, { name: "BASIC" });
  return (row?.value ?? {}) as InstanceBasicSetting;
}

export async function getInstanceGeneralSetting(
  db: DrizzleDB,
): Promise<InstanceGeneralSetting> {
  const row = await getInstanceSetting(db, { name: "GENERAL" });
  return (row?.value ?? {}) as InstanceGeneralSetting;
}

export async function getInstanceStorageSetting(
  db: DrizzleDB,
): Promise<InstanceStorageSetting> {
  const row = await getInstanceSetting(db, { name: "STORAGE" });
  const defaults: InstanceStorageSetting = {
    storageType: "DATABASE",
    filepathTemplate: "assets/{timestamp}_{uuid}_{filename}",
    uploadSizeLimitMb: 30,
  };
  return Object.assign({}, defaults, row?.value ?? {}) as InstanceStorageSetting;
}

export async function getInstanceMemoRelatedSetting(
  db: DrizzleDB,
): Promise<InstanceMemoRelatedSetting> {
  const row = await getInstanceSetting(db, { name: "MEMO_RELATED" });
  const defaults: InstanceMemoRelatedSetting = {
    contentLengthLimit: 8192,
    reactions: DEFAULT_REACTIONS,
  };
  return Object.assign({}, defaults, row?.value ?? {}) as InstanceMemoRelatedSetting;
}

export async function getInstanceTagsSetting(
  db: DrizzleDB,
): Promise<InstanceTagsSetting> {
  const row = await getInstanceSetting(db, { name: "TAGS" });
  return (row?.value ?? { tags: {} }) as InstanceTagsSetting;
}

export async function getInstanceNotificationSetting(
  db: DrizzleDB,
): Promise<InstanceNotificationSetting> {
  const row = await getInstanceSetting(db, { name: "NOTIFICATION" });
  return (row?.value ?? {}) as InstanceNotificationSetting;
}
