#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerTools } from "./tools/index.ts";
import { registerResources } from "./resources/index.ts";

const vaultArg = process.env.GNEISS_VAULT ?? process.argv[2];

if (!vaultArg) {
  console.error(
    "Usage: GNEISS_VAULT=<vault-path> bun run src/http.ts or bun run src/http.ts <vault-path>"
  );
  process.exit(1);
}

const vaultPath: string = vaultArg;

function createServer(): McpServer {
  const server = new McpServer({
    name: "gneiss-mcp",
    version: "0.1.0",
  });
  registerTools(server, vaultPath);
  registerResources(server, vaultPath);
  return server;
}

// Stateful session management: one transport per session
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

async function handleMcp(req: Request): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id");

  // Existing session — reuse transport
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!.handleRequest(req);
  }

  // New initialize request — create transport + server
  if (!sessionId && req.method === "POST") {
    const body = await req.json();
    if (isInitializeRequest(body)) {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          sessions.set(id, transport);
          console.log(`Session created: ${id}`);
        },
        onsessionclosed: (id) => {
          sessions.delete(id);
          console.log(`Session closed: ${id}`);
        },
      });

      const server = createServer();
      await server.connect(transport);
      return transport.handleRequest(req, { parsedBody: body });
    }
  }

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: no valid session" },
      id: null,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

const port = parseInt(process.env.PORT ?? "3001", 10);

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/mcp") {
      return handleMcp(req);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`gneiss-mcp HTTP server listening on http://localhost:${port}/mcp`);
console.log(`Vault: ${vaultPath}`);
