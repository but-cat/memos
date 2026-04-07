import {
  sqliteTable,
  text,
  integer,
  blob,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const systemSetting = sqliteTable("system_setting", {
  name: text("name").notNull(),
  value: text("value").notNull(),
  description: text("description").notNull().default(""),
});

export const user = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdTs: integer("created_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedTs: integer("updated_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  rowStatus: text("row_status", { enum: ["NORMAL", "ARCHIVED"] })
    .notNull()
    .default("NORMAL"),
  username: text("username").notNull().unique(),
  role: text("role", { enum: ["ADMIN", "USER"] }).notNull().default("USER"),
  email: text("email").notNull().default(""),
  nickname: text("nickname").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url").notNull().default(""),
  description: text("description").notNull().default(""),
});

export const userSetting = sqliteTable(
  "user_setting",
  {
    userId: integer("user_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("user_setting_user_id_key_unique").on(t.userId, t.key)],
);

export const memo = sqliteTable("memo", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  creatorId: integer("creator_id").notNull(),
  createdTs: integer("created_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedTs: integer("updated_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  rowStatus: text("row_status", { enum: ["NORMAL", "ARCHIVED"] })
    .notNull()
    .default("NORMAL"),
  content: text("content").notNull().default(""),
  visibility: text("visibility", {
    enum: ["PUBLIC", "PROTECTED", "PRIVATE"],
  })
    .notNull()
    .default("PRIVATE"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  payload: text("payload").notNull().default("{}"),
});

export const memoRelation = sqliteTable(
  "memo_relation",
  {
    memoId: integer("memo_id").notNull(),
    relatedMemoId: integer("related_memo_id").notNull(),
    type: text("type").notNull(),
  },
  (t) => [
    uniqueIndex("memo_relation_unique").on(
      t.memoId,
      t.relatedMemoId,
      t.type,
    ),
  ],
);

export const attachment = sqliteTable("attachment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  creatorId: integer("creator_id").notNull(),
  createdTs: integer("created_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedTs: integer("updated_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  filename: text("filename").notNull().default(""),
  blob: blob("blob"),
  type: text("type").notNull().default(""),
  size: integer("size").notNull().default(0),
  memoId: integer("memo_id"),
  storageType: text("storage_type").notNull().default(""),
  reference: text("reference").notNull().default(""),
  payload: text("payload").notNull().default("{}"),
});

export const idp = sqliteTable("idp", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  identifierFilter: text("identifier_filter").notNull().default(""),
  config: text("config").notNull().default("{}"),
});

export const inbox = sqliteTable("inbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdTs: integer("created_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull().default("{}"),
});

export const reaction = sqliteTable(
  "reaction",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdTs: integer("created_ts", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    creatorId: integer("creator_id").notNull(),
    contentId: text("content_id").notNull(),
    reactionType: text("reaction_type").notNull(),
  },
  (t) => [
    uniqueIndex("reaction_unique").on(
      t.creatorId,
      t.contentId,
      t.reactionType,
    ),
  ],
);

export const memoShare = sqliteTable("memo_share", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uid: text("uid").notNull().unique(),
  memoId: integer("memo_id").notNull(),
  creatorId: integer("creator_id").notNull(),
  createdTs: integer("created_ts", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresTs: integer("expires_ts", { mode: "timestamp" }),
});
