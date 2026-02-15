import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerCreateTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "create",
    "Create a new file or folder in the vault. Use trailing slash for folders.",
    {
      path: z.string().describe("Relative path. End with / for folder."),
      content: z.string().optional().describe("File content (ignored for folders)"),
    },
    async ({ path, content }) => {
      const created = await vault.create(path, content);
      return { content: [{ type: "text" as const, text: `Created: ${created}` }] };
    }
  );
}
