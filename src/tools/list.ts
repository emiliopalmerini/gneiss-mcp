import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerListTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "list",
    "List files and folders in a single vault directory (non-recursive). Use to browse a known location.",
    { path: z.string().optional().describe("Relative path from vault root. Omit for root.") },
    async ({ path }) => {
      const entries = await vault.list(path ?? "");
      const text = entries
        .map((e) => `${e.isDirectory ? "📁" : "📄"} ${e.path}`)
        .join("\n");
      return { content: [{ type: "text" as const, text: text || "Empty directory" }] };
    }
  );
}
