import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../src/resources/index.ts";

let vaultDir: string;

beforeEach(async () => {
  vaultDir = await mkdtemp(join(tmpdir(), "gneiss-test-"));
});

afterEach(async () => {
  await rm(vaultDir, { recursive: true });
});

function getResourceCallback(server: McpServer, uri: string) {
  const resource = (server as any)._registeredResources[uri];
  if (!resource) throw new Error(`Resource ${uri} not registered`);
  return resource.readCallback as (params: { uri: string }) => Promise<{
    contents: { uri: string; text: string }[];
  }>;
}

describe("vault-conventions resource", () => {
  it("returns CLAUDE.md content when present", async () => {
    await writeFile(
      join(vaultDir, "CLAUDE.md"),
      "# Vault Conventions\n\nUse folders for categories.",
      "utf-8"
    );

    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerResources(server, vaultDir);

    const readCallback = getResourceCallback(server, "gneiss://conventions");
    const result = await readCallback({ uri: "gneiss://conventions" });

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]!.text).toContain("# Vault Conventions");
    expect(result.contents[0]!.text).toContain("Use folders for categories.");
  });

  it("returns fallback message when CLAUDE.md is missing", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerResources(server, vaultDir);

    const readCallback = getResourceCallback(server, "gneiss://conventions");
    const result = await readCallback({ uri: "gneiss://conventions" });

    expect(result.contents[0]!.text).toContain("No CLAUDE.md found");
  });
});
