import { defineEventHandler, setResponseHeader, createError } from "h3";

// Simple in-memory SSE hub
const sseClients = new Map<string, ((data: string) => void)[]>();

export function broadcastSSEEvent(userId: string, event: string, data: unknown) {
  const clients = sseClients.get(userId) || [];
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const send of clients) {
    try {
      send(message);
    } catch {}
  }
}

export default defineEventHandler(async (event) => {
  const currentUser = event.context.user;
  if (!currentUser) {
    throw createError({ statusCode: 401, message: "Unauthenticated" });
  }

  setResponseHeader(event, "Content-Type", "text/event-stream");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Connection", "keep-alive");
  setResponseHeader(event, "X-Accel-Buffering", "no");

  const userId = String(currentUser.id);
  const clients = sseClients.get(userId) || [];

  return new ReadableStream({
    start(controller) {
      // Send initial ping
      controller.enqueue(new TextEncoder().encode(": ping\n\n"));

      const send = (data: string) => {
        controller.enqueue(new TextEncoder().encode(data));
      };
      clients.push(send);
      sseClients.set(userId, clients);

      // Cleanup on close
      event.node.req.on("close", () => {
        const idx = clients.indexOf(send);
        if (idx > -1) clients.splice(idx, 1);
        if (clients.length === 0) sseClients.delete(userId);
      });
    },
  });
});
