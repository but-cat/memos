export function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(Number(val) * 1000).toISOString();
}

export function convertMemo(memo: any) {
  let payload: any = {};
  try { payload = JSON.parse(memo.payload || "{}"); } catch { /* ignore */ }
  return {
    name: `memos/${memo.uid}`,
    uid: memo.uid,
    rowStatus: memo.rowStatus,
    creator: `users/${memo.creatorUsername ?? memo.creatorId}`,
    createTime: tsToISO(memo.createdTs),
    updateTime: tsToISO(memo.updatedTs),
    displayTime: tsToISO(memo.createdTs),
    content: memo.content,
    visibility: memo.visibility,
    pinned: Boolean(memo.pinned),
    tags: payload.tags || [],
    resources: [],
    relations: [],
    reactions: [],
    location: payload.location ?? null,
    property: payload.property ?? null,
  };
}

export function convertUser(user: any, viewerUser: any) {
  return {
    name: `users/${user.username}`,
    id: user.id,
    rowStatus: user.rowStatus,
    createTime: tsToISO(user.createdTs),
    updateTime: tsToISO(user.updatedTs),
    role: user.role,
    username: user.username,
    email: viewerUser?.id === user.id || viewerUser?.role === "ADMIN" ? user.email : "",
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    description: user.description,
  };
}

export function convertAttachment(a: any) {
  return {
    name: `attachments/${a.uid}`,
    uid: a.uid,
    createTime: tsToISO(a.createdTs),
    updateTime: tsToISO(a.updatedTs),
    filename: a.filename,
    content: a.blob ? Buffer.from(a.blob).toString("base64") : undefined,
    externalLink: a.storageType !== "LOCAL" && a.storageType !== "DATABASE" ? a.reference : undefined,
    type: a.type,
    size: a.size,
    memo: a.memoId ? `memos/${a.memoId}` : undefined,
    storageType: a.storageType,
    reference: a.reference,
  };
}

export function convertIdp(idp: any, isAdmin: boolean) {
  let config: any = {};
  try { config = JSON.parse(idp.config || "{}"); } catch { /* ignore */ }
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
