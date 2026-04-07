import { defineEventHandler, createError } from "h3";
import { tsToISO } from "../../utils/format";

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser) throw createError({ statusCode: 401, message: "Unauthenticated" });
  const u = currentUser;
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
