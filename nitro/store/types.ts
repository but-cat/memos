// ============================================================
// Common enums
// ============================================================

export type RowStatus = "NORMAL" | "ARCHIVED";
export type Role = "ADMIN" | "USER";
export type Visibility = "PUBLIC" | "PROTECTED" | "PRIVATE";
export type MemoRelationType = "REFERENCE" | "COMMENT";
export type InboxStatus = "UNREAD" | "ARCHIVED";
export type AttachmentStorageType = "DATABASE" | "LOCAL" | "S3" | "EXTERNAL";
export type IdpType = "OAUTH2";
export type UserSettingKey =
  | "GENERAL"
  | "SHORTCUTS"
  | "WEBHOOKS"
  | "REFRESH_TOKENS"
  | "PERSONAL_ACCESS_TOKENS";
export type InstanceSettingKey =
  | "BASIC"
  | "GENERAL"
  | "STORAGE"
  | "MEMO_RELATED"
  | "TAGS"
  | "NOTIFICATION";

// ============================================================
// User types
// ============================================================

export interface User {
  id: number;
  rowStatus: RowStatus;
  createdTs: number;
  updatedTs: number;
  username: string;
  role: Role;
  email: string;
  nickname: string;
  passwordHash: string;
  avatarUrl: string;
  description: string;
}

export interface UpdateUser {
  id: number;
  updatedTs?: number;
  rowStatus?: RowStatus;
  username?: string;
  role?: Role;
  email?: string;
  nickname?: string;
  password?: string;
  avatarUrl?: string;
  passwordHash?: string;
  description?: string;
}

export interface FindUser {
  id?: number;
  idList?: number[];
  usernameList?: string[];
  rowStatus?: RowStatus;
  username?: string;
  role?: Role;
  email?: string;
  nickname?: string;
  search?: string;
  filters?: string[];
  limit?: number;
}

export interface DeleteUser {
  id: number;
}

// ============================================================
// Memo payload types
// ============================================================

export interface MemoPayloadProperty {
  hasLink?: boolean;
  hasTaskList?: boolean;
  hasCode?: boolean;
  hasIncompleteTasks?: boolean;
  title?: string;
}

export interface MemoPayloadLocation {
  placeholder?: string;
  latitude?: number;
  longitude?: number;
}

export interface MemoPayload {
  property?: MemoPayloadProperty;
  location?: MemoPayloadLocation;
  tags?: string[];
}

// ============================================================
// Memo types
// ============================================================

export interface Memo {
  id: number;
  uid: string;
  rowStatus: RowStatus;
  creatorId: number;
  createdTs: number;
  updatedTs: number;
  content: string;
  visibility: Visibility;
  pinned: boolean;
  payload?: MemoPayload;
  parentUID?: string;
}

export interface FindMemo {
  id?: number;
  uid?: string;
  idList?: number[];
  uidList?: string[];
  rowStatus?: RowStatus;
  creatorId?: number;
  visibilityList?: Visibility[];
  excludeContent?: boolean;
  excludeComments?: boolean;
  filters?: string[];
  limit?: number;
  offset?: number;
  orderByPinned?: boolean;
  orderByUpdatedTs?: boolean;
  orderByTimeAsc?: boolean;
}

export interface UpdateMemo {
  id: number;
  uid?: string;
  createdTs?: number;
  updatedTs?: number;
  rowStatus?: RowStatus;
  content?: string;
  visibility?: Visibility;
  pinned?: boolean;
  payload?: MemoPayload;
}

export interface DeleteMemo {
  id: number;
}

// ============================================================
// Attachment payload types
// ============================================================

export interface StorageS3Config {
  accessKeyId?: string;
  accessKeySecret?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  usePathStyle?: boolean;
}

export interface AttachmentPayload {
  s3Object?: {
    s3Config?: StorageS3Config;
    key?: string;
    lastPresignedTime?: string;
  };
  motionMedia?: {
    family?: number;
    role?: number;
    groupId?: string;
    presentationTimestampUs?: number;
    hasEmbeddedVideo?: boolean;
  };
}

// ============================================================
// Attachment types
// ============================================================

export interface Attachment {
  id: number;
  uid: string;
  creatorId: number;
  createdTs: number;
  updatedTs: number;
  filename: string;
  blob?: Uint8Array | null;
  type: string;
  size: number;
  storageType: AttachmentStorageType;
  reference: string;
  payload?: AttachmentPayload;
  memoId?: number | null;
  memoUID?: string | null;
}

export interface FindAttachment {
  getBlob?: boolean;
  id?: number;
  uid?: string;
  creatorId?: number;
  filename?: string;
  filenameSearch?: string;
  memoId?: number;
  memoIdList?: number[];
  hasRelatedMemo?: boolean;
  storageType?: AttachmentStorageType;
  filters?: string[];
  limit?: number;
  offset?: number;
}

export interface UpdateAttachment {
  id: number;
  uid?: string;
  updatedTs?: number;
  filename?: string;
  memoId?: number | null;
  reference?: string;
  payload?: AttachmentPayload;
}

export interface DeleteAttachment {
  id: number;
  memoId?: number;
}

// ============================================================
// UserSetting types
// ============================================================

export interface GeneralUserSetting {
  locale?: string;
  memoVisibility?: string;
  theme?: string;
}

export interface ShortcutItem {
  id?: string;
  title?: string;
  filter?: string;
}

export interface WebhookItem {
  id?: string;
  title?: string;
  url?: string;
}

export interface RefreshTokenClientInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
}

export interface RefreshTokenItem {
  tokenId?: string;
  expiresAt?: string;
  createdAt?: string;
  description?: string;
  clientInfo?: RefreshTokenClientInfo;
}

export interface PATItem {
  tokenId?: string;
  tokenHash?: string;
  description?: string;
  expiresAt?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export type UserSettingValue =
  | { general: GeneralUserSetting }
  | { shortcuts: ShortcutItem[] }
  | { webhooks: WebhookItem[] }
  | { refreshTokens: RefreshTokenItem[] }
  | { personalAccessTokens: PATItem[] };

export interface UserSettingRow {
  userId: number;
  key: UserSettingKey;
  value: UserSettingValue;
}

export interface FindUserSetting {
  userId?: number;
  key?: UserSettingKey;
}

// ============================================================
// IdentityProvider types
// ============================================================

export interface OAuth2Config {
  clientId?: string;
  clientSecret?: string;
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];
  fieldMapping?: Record<string, string>;
}

export interface IdentityProvider {
  id: number;
  uid: string;
  name: string;
  type: IdpType;
  identifierFilter: string;
  config: string;
}

export interface FindIdentityProvider {
  id?: number;
  uid?: string;
}

export interface UpdateIdentityProvider {
  id: number;
  name?: string;
  identifierFilter?: string;
  config?: string;
}

export interface DeleteIdentityProvider {
  id: number;
}

// ============================================================
// Inbox types
// ============================================================

export interface InboxMessage {
  type?: "MEMO_COMMENT" | "MEMO_MENTION";
  memoComment?: { memoId?: number; relatedMemoId?: number };
  memoMention?: { memoId?: number; relatedMemoId?: number };
}

export interface Inbox {
  id: number;
  createdTs: number;
  senderId: number;
  receiverId: number;
  status: InboxStatus;
  message?: InboxMessage;
}

export interface FindInbox {
  id?: number;
  senderId?: number;
  receiverId?: number;
  status?: InboxStatus;
  messageType?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateInbox {
  id: number;
  status: InboxStatus;
}

export interface DeleteInbox {
  id: number;
}

// ============================================================
// Reaction types
// ============================================================

export interface Reaction {
  id: number;
  createdTs: number;
  creatorId: number;
  contentId: string;
  reactionType: string;
}

export interface FindReaction {
  id?: number;
  creatorId?: number;
  contentId?: string;
  contentIdList?: string[];
}

export interface DeleteReaction {
  id: number;
}

// ============================================================
// MemoRelation types
// ============================================================

export interface MemoRelation {
  memoId: number;
  relatedMemoId: number;
  type: MemoRelationType;
}

export interface FindMemoRelation {
  memoId?: number;
  relatedMemoId?: number;
  type?: MemoRelationType;
  memoFilter?: string;
  memoIdList?: number[];
}

export interface DeleteMemoRelation {
  memoId?: number;
  relatedMemoId?: number;
  type?: MemoRelationType;
}

// ============================================================
// MemoShare types
// ============================================================

export interface MemoShare {
  id: number;
  uid: string;
  memoId: number;
  creatorId: number;
  createdTs: number;
  expiresTs?: number | null;
}

export interface FindMemoShare {
  id?: number;
  uid?: string;
  memoId?: number;
}

export interface DeleteMemoShare {
  id?: number;
  uid?: string;
}

// ============================================================
// InstanceSetting types
// ============================================================

export interface InstanceBasicSetting {
  secretKey?: string;
  schemaVersion?: string;
}

export interface InstanceGeneralSetting {
  disallowUserRegistration?: boolean;
  disallowPasswordAuth?: boolean;
  additionalScript?: string;
  additionalStyle?: string;
  customProfile?: {
    title?: string;
    description?: string;
    logoUrl?: string;
  };
  weekStartDayOffset?: number;
  disallowChangeUsername?: boolean;
  disallowChangeNickname?: boolean;
}

export interface InstanceStorageSetting {
  storageType?: "DATABASE" | "LOCAL" | "S3";
  filepathTemplate?: string;
  uploadSizeLimitMb?: number;
  s3Config?: StorageS3Config;
}

export interface InstanceMemoRelatedSetting {
  displayWithUpdateTime?: boolean;
  contentLengthLimit?: number;
  enableDoubleClickEdit?: boolean;
  reactions?: string[];
}

export interface InstanceTagMetadata {
  backgroundColor?: { red?: number; green?: number; blue?: number };
  blurContent?: boolean;
}

export interface InstanceTagsSetting {
  tags?: Record<string, InstanceTagMetadata>;
}

export interface InstanceNotificationEmailSetting {
  enabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  useTls?: boolean;
  useSsl?: boolean;
}

export interface InstanceNotificationSetting {
  email?: InstanceNotificationEmailSetting;
}

export type InstanceSettingValue =
  | InstanceBasicSetting
  | InstanceGeneralSetting
  | InstanceStorageSetting
  | InstanceMemoRelatedSetting
  | InstanceTagsSetting
  | InstanceNotificationSetting;

export interface InstanceSettingRow {
  name: InstanceSettingKey;
  value: InstanceSettingValue;
  description: string;
}

export interface FindInstanceSetting {
  name: InstanceSettingKey;
}

export interface DeleteInstanceSetting {
  name: InstanceSettingKey;
}
