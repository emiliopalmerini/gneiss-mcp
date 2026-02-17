import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerGraphTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "graph",
    "Traverse the [[wikilink]] graph around a note to discover connected notes. Use after finding a relevant note to explore its neighborhood.",
    {
      path: z.string().describe("Relative path to the root note"),
      depth: z.number().optional().describe("Max hops from root (default 1)"),
      direction: z
        .enum(["forward", "backward", "both"])
        .optional()
        .describe("Link direction to follow (default both)"),
    },
    async ({ path, depth, direction }) => {
      const result = await vault.graph(path, { depth, direction });

      const lines: string[] = [`**root:** ${result.root}`, ""];

      const forwardMap = new Map<string, string[]>();
      const backwardMap = new Map<string, string[]>();
      for (const edge of result.edges) {
        let fwd = forwardMap.get(edge.source);
        if (!fwd) {
          fwd = [];
          forwardMap.set(edge.source, fwd);
        }
        fwd.push(edge.target);

        let bwd = backwardMap.get(edge.target);
        if (!bwd) {
          bwd = [];
          backwardMap.set(edge.target, bwd);
        }
        bwd.push(edge.source);
      }

      const dangling: string[] = [];

      for (const node of result.nodes) {
        if (!node.exists) {
          dangling.push(node.path);
          continue;
        }

        const nodeLine = `**${node.path}** (depth ${node.depth})`;
        lines.push(nodeLine);

        const fwd = forwardMap.get(node.path);
        if (fwd && fwd.length > 0) {
          lines.push(`  → ${fwd.join(", ")}`);
        }

        const bwd = backwardMap.get(node.path);
        if (bwd && bwd.length > 0) {
          lines.push(`  ← ${bwd.join(", ")}`);
        }

        lines.push("");
      }

      if (dangling.length > 0) {
        for (const d of dangling) {
          lines.push(`⚠ dangling: [[${d}]] (no matching file)`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n").trim() }] };
    }
  );
}
