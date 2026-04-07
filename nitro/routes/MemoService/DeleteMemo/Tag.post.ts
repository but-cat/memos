import { defineEventHandler, createError } from "h3";

export default defineEventHandler((event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: "Unauthenticated" });
  throw createError({ statusCode: 501, message: "DeleteMemoTag not yet implemented" });
});
