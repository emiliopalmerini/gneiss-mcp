import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerRenameTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "rename",
    "Rename a file or folder in the vault",
    {
      path: z.string().describe("Current relative path"),
      newName: z.string().describe("New name (without path or extension)"),
    },
    async ({ path, newName }) => {
      const newPath = await vault.rename(path, newName);
      return { content: [{ type: "text" as const, text: `Renamed: ${path} → ${newPath}` }] };
    }
  );
}
