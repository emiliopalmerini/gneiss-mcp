import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerSurfaceTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "surface",
    "Discover notes relevant to a topic. Ranks results by weighted signals: tags (5), aliases (4), filename (3), summary (3), body (1). Best for exploratory queries when you're not sure what exists.",
    {
      query: z.string().describe("Topic or keywords to surface relevant notes for"),
      path: z.string().optional().describe("Restrict search to a subdirectory"),
      tags: z.array(z.string()).optional().describe("Require files matching any of these tags"),
      limit: z.number().optional().describe("Max results (default 10)"),
    },
    async ({ query, path, tags, limit }) => {
      const results = await vault.surface(query, { path, tags, limit });

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No results for "${query}"` }] };
      }

      const text = results
        .map((r) => {
          const lines = [`**${r.path}** (score: ${r.score})`];
          if (r.tags.length > 0) lines.push(`  tags: ${r.tags.join(", ")}`);
          if (r.summary) lines.push(`  summary: ${r.summary}`);
          lines.push(`  matched: ${r.matchedSignals.join(", ")}`);
          return lines.join("\n");
        })
        .join("\n\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
