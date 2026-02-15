import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerDeleteTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "delete",
    "Delete a file or folder from the vault",
    { path: z.string().describe("Relative path to delete") },
    async ({ path }) => {
      await vault.delete(path);
      return { content: [{ type: "text" as const, text: `Deleted: ${path}` }] };
    }
  );
}
