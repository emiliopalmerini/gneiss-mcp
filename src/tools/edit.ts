import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Vault } from "../vault/index.ts";
import type { EditOperation } from "../vault/index.ts";

function buildEditOperation(params: {
  mode: string;
  content?: string;
  find?: string;
  replace?: string;
  metadata?: string;
  all?: boolean;
}): EditOperation {
  switch (params.mode) {
    case "replace":
    case "append":
    case "prepend":
      if (params.content === undefined) {
        throw new Error(`"content" is required for mode "${params.mode}"`);
      }
      return { mode: params.mode, content: params.content };

    case "find-replace":
      if (params.find === undefined || params.replace === undefined) {
        throw new Error('"find" and "replace" are required for mode "find-replace"');
      }
      return { mode: "find-replace", find: params.find, replace: params.replace, all: params.all };

    case "patch-frontmatter": {
      if (params.metadata === undefined) {
        throw new Error('"metadata" is required for mode "patch-frontmatter"');
      }
      const parsed = JSON.parse(params.metadata) as Record<string, unknown>;
      return { mode: "patch-frontmatter", metadata: parsed };
    }

    default:
      throw new Error(`Unknown edit mode: ${params.mode}`);
  }
}

export function registerEditTool(server: McpServer, vaultPath: string): void {
  const vault = new Vault(vaultPath);

  server.tool(
    "edit",
    "Edit an existing file in the vault. Supports replace, append, prepend, find-replace, and patch-frontmatter modes.",
    {
      path: z.string().describe("Relative path to the file to edit"),
      mode: z
        .enum(["replace", "append", "prepend", "find-replace", "patch-frontmatter"])
        .describe("Edit mode"),
      content: z.string().optional().describe("New content (for replace/append/prepend)"),
      find: z.string().optional().describe("String to find (for find-replace)"),
      replace: z.string().optional().describe("Replacement string (for find-replace)"),
      metadata: z
        .string()
        .optional()
        .describe("JSON string of frontmatter keys to merge (for patch-frontmatter)"),
      all: z.boolean().optional().describe("Replace all occurrences (for find-replace)"),
    },
    async (params) => {
      const operation = buildEditOperation(params);
      await vault.edit(params.path, operation);
      return { content: [{ type: "text" as const, text: `Edited: ${params.path}` }] };
    }
  );
}
