import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerSearchTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "search",
    "Search vault by filename or content. Matches file names and text inside markdown files (case-insensitive). Use this to find specific files or locate content by keyword.",
    { query: z.string().describe("Text to search for — matches against filenames and file content (case-insensitive)") },
    async ({ query }) => {
      const results = await vault.search(query);

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No results for "${query}"` }] };
      }

      const text = results
        .map((r) => {
          const matchPreview = r.matches.slice(0, 3).join("\n  ");
          const more = r.matches.length > 3 ? `\n  ...and ${r.matches.length - 3} more` : "";
          return `**${r.path}**\n  ${matchPreview}${more}`;
        })
        .join("\n\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
