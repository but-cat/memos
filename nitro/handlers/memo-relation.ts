import type { H3Event } from "h3";
import { createError } from "h3";

// Memo relations are handled directly in MemoService (SetMemoRelations, etc.)
export async function handleMemoRelationService(
  method: string,
  _event: H3Event,
) {
  throw createError({
    statusCode: 404,
    message: `MemoRelationService.${method} not found — relations are handled in MemoService`,
  });
}
