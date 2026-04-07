import { defineEventHandler, deleteCookie } from "h3";
import { REFRESH_TOKEN_COOKIE } from "../../utils/jwt";

export default defineEventHandler((event) => {
  deleteCookie(event, REFRESH_TOKEN_COOKIE);
  return {};
});
