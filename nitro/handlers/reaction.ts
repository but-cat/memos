import type { H3Event } from "h3";
import { createError } from "h3";

// Reactions are handled directly in MemoService (UpsertMemoReaction, etc.)
export async function handleReactionService(method: string, _event: H3Event) {
  throw createError({
    statusCode: 404,
    message: `ReactionService.${method} not found — reactions are handled in MemoService`,
  });
}
