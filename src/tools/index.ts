import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTool } from "./list.ts";
import { registerTreeTool } from "./tree.ts";
import { registerReadTool } from "./read.ts";
import { registerSearchTool } from "./search.ts";
import { registerCreateTool } from "./create.ts";
import { registerMoveTool } from "./move.ts";
import { registerRenameTool } from "./rename.ts";
import { registerDeleteTool } from "./delete.ts";
import { registerEditTool } from "./edit.ts";
import { registerSurfaceTool } from "./surface.ts";
import { registerGraphTool } from "./graph.ts";

export function registerTools(server: McpServer, vaultPath: string): void {
  registerListTool(server, vaultPath);
  registerTreeTool(server, vaultPath);
  registerReadTool(server, vaultPath);
  registerSearchTool(server, vaultPath);
  registerSurfaceTool(server, vaultPath);
  registerCreateTool(server, vaultPath);
  registerMoveTool(server, vaultPath);
  registerRenameTool(server, vaultPath);
  registerDeleteTool(server, vaultPath);
  registerEditTool(server, vaultPath);
  registerGraphTool(server, vaultPath);
}
