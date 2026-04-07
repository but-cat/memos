import { defineEventHandler, createError } from "h3";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  const u = currentUser;
  const tsToISO = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) return val.toISOString();
    return new Date(Number(val) * 1000).toISOString();
  };
  return {
    user: {
      name: `users/${u.username}`,
      id: u.id,
      rowStatus: u.rowStatus,
      createTime: tsToISO(u.createdTs),
      updateTime: tsToISO(u.updatedTs),
      role: u.role,
      username: u.username,
      email: u.email,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      description: u.description,
    },
  };
});
