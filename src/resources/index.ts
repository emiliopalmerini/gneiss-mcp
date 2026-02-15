import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function registerResources(
  server: McpServer,
  vaultPath: string
): void {
  server.resource(
    "vault-conventions",
    "gneiss://conventions",
    {
      description:
        "Vault organizational conventions and structure. Read this first to understand how the vault is organized.",
      mimeType: "text/markdown",
    },
    async () => {
      const conventionsPath = join(vaultPath, "CLAUDE.md");
      try {
        const content = await readFile(conventionsPath, "utf-8");
        return { contents: [{ uri: "gneiss://conventions", text: content }] };
      } catch {
        return {
          contents: [
            {
              uri: "gneiss://conventions",
              text: "No CLAUDE.md found in vault root. This vault has no documented conventions.",
            },
          ],
        };
      }
    }
  );
}
