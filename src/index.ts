#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.ts";
import { registerResources } from "./resources/index.ts";

const server = new McpServer({
  name: "gneiss-mcp",
  version: "0.1.0",
});

const vaultPath = process.env.GNEISS_VAULT ?? process.argv[2];

if (!vaultPath) {
  console.error(
    "Usage: gneiss-mcp <vault-path> or set GNEISS_VAULT env var"
  );
  process.exit(1);
}

registerTools(server, vaultPath);
registerResources(server, vaultPath);

const transport = new StdioServerTransport();
await server.connect(transport);
