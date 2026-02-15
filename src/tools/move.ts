import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerMoveTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "move",
    "Move a file or folder to a new location in the vault",
    {
      source: z.string().describe("Current relative path"),
      destination: z.string().describe("New relative path"),
    },
    async ({ source, destination }) => {
      await vault.move(source, destination);
      return { content: [{ type: "text" as const, text: `Moved: ${source} → ${destination}` }] };
    }
  );
}
