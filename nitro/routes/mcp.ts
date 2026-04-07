import { defineEventHandler, readBody, setResponseHeader } from "h3";
import { getDB } from "../store/db/db";
import { memo, attachment as attachmentTable } from "../store/db/schema";
import { eq, and, like, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as JsonRpcRequest;

  setResponseHeader(event, "Content-Type", "application/json");

  const respond = (result: unknown) => ({
    jsonrpc: "2.0",
    id: body.id,
    result,
  });

  const respondError = (code: number, message: string) => ({
    jsonrpc: "2.0",
    id: body.id,
    error: { code, message },
  });

  switch (body.method) {
    case "initialize":
      return respond({
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: {
          name: "memos-mcp-server",
          version: process.env.MEMOS_VERSION || "0.26.0",
        },
      });

    case "tools/list":
      return respond({
        tools: [
          {
            name: "search_memos",
            description: "Search through memos",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query" },
                limit: { type: "number", description: "Max results" },
              },
              required: ["query"],
            },
          },
          {
            name: "create_memo",
            description: "Create a new memo",
            inputSchema: {
              type: "object",
              properties: {
                content: { type: "string", description: "Memo content" },
                visibility: {
                  type: "string",
                  enum: ["PUBLIC", "PROTECTED", "PRIVATE"],
                },
              },
              required: ["content"],
            },
          },
        ],
      });

    case "tools/call": {
      const toolName = body.params?.name;
      const toolArgs = (body.params?.arguments || {}) as Record<string, unknown>;
      const currentUser = event.context.user;

      if (toolName === "search_memos") {
        const db = getDB();
        const conditions: ReturnType<typeof eq>[] = [eq(memo.rowStatus, "NORMAL")];

        if (!currentUser) {
          conditions.push(eq(memo.visibility, "PUBLIC"));
        }

        if (toolArgs.query) {
          // Escape SQL LIKE special characters (%, _, \) and use ESCAPE clause
          const escapedQuery = String(toolArgs.query).replace(/[%_\\]/g, "\\$&");
          conditions.push(sql`${memo.content} LIKE ${"%" + escapedQuery + "%"} ESCAPE '\\'`);
        }

        const memos = await db
          .select()
          .from(memo)
          .where(and(...conditions))
          .orderBy(desc(memo.createdTs))
          .limit(typeof toolArgs.limit === "number" ? toolArgs.limit : 10);

        return respond({
          content: [
            {
              type: "text",
              text: memos
                .map((m) => `[${m.uid}] ${m.content.slice(0, 200)}`)
                .join("\n\n"),
            },
          ],
        });
      }

      if (toolName === "create_memo") {
        if (!currentUser) {
          return respondError(-32600, "Authentication required");
        }

        const db = getDB();
        const uid = nanoid(8).toLowerCase();
        const content = typeof toolArgs.content === "string" ? toolArgs.content : "";
        const tagMatches = content.match(/#([^\s#]+)/g) || [];
        const tags = tagMatches.map((t: string) => t.slice(1));
        const payload = { tags };
        const visibility =
          typeof toolArgs.visibility === "string" &&
          ["PUBLIC", "PROTECTED", "PRIVATE"].includes(toolArgs.visibility)
            ? (toolArgs.visibility as "PUBLIC" | "PROTECTED" | "PRIVATE")
            : "PRIVATE";

        const [newMemo] = await db
          .insert(memo)
          .values({
            uid,
            creatorId: currentUser.id,
            content,
            visibility,
            payload: JSON.stringify(payload),
          })
          .returning();

        return respond({
          content: [
            {
              type: "text",
              text: `Created memo: memos/${newMemo.uid}\n${newMemo.content}`,
            },
          ],
        });
      }

      return respondError(-32601, `Unknown tool: ${toolName}`);
    }

    case "resources/list":
      return respond({ resources: [] });

    case "notifications/initialized":
      return respond({});

    default:
      return respondError(-32601, `Method not found: ${body.method}`);
  }
});
