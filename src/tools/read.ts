import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";

export function registerReadTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "read",
    "Read a file's content. Returns parsed frontmatter and body for markdown files.",
    { path: z.string().describe("Relative path to the file from vault root") },
    async ({ path }) => {
      const { content, frontmatter } = await vault.read(path);
      const parts: string[] = [];

      if (frontmatter && Object.keys(frontmatter).length > 0) {
        parts.push(`**Frontmatter:**\n\`\`\`yaml\n${JSON.stringify(frontmatter, null, 2)}\n\`\`\``);
      }
      parts.push(content);

      return { content: [{ type: "text" as const, text: parts.join("\n\n") }] };
    }
  );
}
