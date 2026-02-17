import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerTreeTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "tree",
    "Display vault directory tree structure. Use to understand folder layout before navigating.",
    {
      path: z.string().optional().describe("Relative path from vault root. Omit for root."),
      depth: z.number().optional().describe("Max depth to display (default: 3)"),
    },
    async ({ path, depth }) => {
      const tree = await vault.tree(path ?? "", depth ?? 3);
      return { content: [{ type: "text" as const, text: tree || "Empty directory" }] };
    }
  );
}
