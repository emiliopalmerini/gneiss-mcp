import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Vault } from "../src/vault/index.ts";

let vaultDir: string;
let vault: Vault;

beforeEach(async () => {
  vaultDir = await mkdtemp(join(tmpdir(), "gneiss-graph-"));
  vault = new Vault(vaultDir);
});

afterEach(async () => {
  await rm(vaultDir, { recursive: true });
});

describe("wikilink parsing", () => {
  it("parses simple wikilinks", async () => {
    await writeFile(join(vaultDir, "a.md"), "Link to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "Target");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "b.md" });
  });

  it("parses wikilinks with aliases", async () => {
    await writeFile(join(vaultDir, "a.md"), "Link to [[b|display text]]");
    await writeFile(join(vaultDir, "b.md"), "Target");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "b.md" });
  });

  it("parses wikilinks with headings", async () => {
    await writeFile(join(vaultDir, "a.md"), "Link to [[b#section]]");
    await writeFile(join(vaultDir, "b.md"), "Target");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "b.md" });
  });

  it("parses wikilinks with heading and alias", async () => {
    await writeFile(join(vaultDir, "a.md"), "Link to [[b#section|display]]");
    await writeFile(join(vaultDir, "b.md"), "Target");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "b.md" });
  });

  it("parses pathed wikilinks", async () => {
    await mkdir(join(vaultDir, "sub"), { recursive: true });
    await writeFile(join(vaultDir, "a.md"), "Link to [[sub/b]]");
    await writeFile(join(vaultDir, "sub", "b.md"), "Target");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "sub/b.md" });
  });
});

describe("forward links", () => {
  it("returns forward links from a note", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]] and [[c]]");
    await writeFile(join(vaultDir, "b.md"), "B content");
    await writeFile(join(vaultDir, "c.md"), "C content");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.root).toBe("a.md");
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toContainEqual({ source: "a.md", target: "b.md" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "c.md" });
  });
});

describe("backlinks", () => {
  it("returns notes that link to the root", async () => {
    await writeFile(join(vaultDir, "a.md"), "A content");
    await writeFile(join(vaultDir, "b.md"), "Links to [[a]]");
    await writeFile(join(vaultDir, "c.md"), "Also links to [[a]]");

    const result = await vault.graph("a.md", { direction: "backward" });
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toContainEqual({ source: "b.md", target: "a.md" });
    expect(result.edges).toContainEqual({ source: "c.md", target: "a.md" });
  });
});

describe("both directions", () => {
  it("returns forward and backward links", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "B content");
    await writeFile(join(vaultDir, "c.md"), "Links to [[a]]");

    const result = await vault.graph("a.md", { direction: "both" });
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toContainEqual({ source: "a.md", target: "b.md" });
    expect(result.edges).toContainEqual({ source: "c.md", target: "a.md" });
  });

  it("defaults to both directions", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "B content");
    await writeFile(join(vaultDir, "c.md"), "Links to [[a]]");

    const result = await vault.graph("a.md");
    expect(result.nodes).toHaveLength(3);
  });
});

describe("depth traversal", () => {
  it("traverses multiple hops with depth 2", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "Links to [[c]]");
    await writeFile(join(vaultDir, "c.md"), "End");

    const result = await vault.graph("a.md", { depth: 2, direction: "forward" });
    expect(result.nodes).toHaveLength(3);
    const cNode = result.nodes.find((n) => n.path === "c.md");
    expect(cNode).toBeDefined();
    expect(cNode!.depth).toBe(2);
  });

  it("does not traverse beyond depth limit", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "Links to [[c]]");
    await writeFile(join(vaultDir, "c.md"), "End");

    const result = await vault.graph("a.md", { depth: 1, direction: "forward" });
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.find((n) => n.path === "c.md")).toBeUndefined();
  });

  it("defaults to depth 1", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "Links to [[c]]");
    await writeFile(join(vaultDir, "c.md"), "End");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.nodes).toHaveLength(2);
  });
});

describe("dangling links", () => {
  it("marks links to nonexistent files as dangling", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[nonexistent]]");

    const result = await vault.graph("a.md", { direction: "forward" });
    const dangling = result.nodes.find((n) => n.path === "nonexistent");
    expect(dangling).toBeDefined();
    expect(dangling!.exists).toBe(false);
  });

  it("marks existing files as exists: true", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[b]]");
    await writeFile(join(vaultDir, "b.md"), "Exists");

    const result = await vault.graph("a.md", { direction: "forward" });
    const bNode = result.nodes.find((n) => n.path === "b.md");
    expect(bNode!.exists).toBe(true);
  });
});

describe("wikilink resolution", () => {
  it("resolves case-insensitive filenames", async () => {
    await writeFile(join(vaultDir, "a.md"), "Links to [[MyNote]]");
    await writeFile(join(vaultDir, "mynote.md"), "Content");

    const result = await vault.graph("a.md", { direction: "forward" });
    expect(result.edges).toContainEqual({ source: "a.md", target: "mynote.md" });
  });
});

describe("edge cases", () => {
  it("returns just the root node when note has no links", async () => {
    await writeFile(join(vaultDir, "lonely.md"), "No links here");

    const result = await vault.graph("lonely.md");
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]!.path).toBe("lonely.md");
    expect(result.nodes[0]!.depth).toBe(0);
    expect(result.edges).toHaveLength(0);
  });

  it("handles self-links gracefully", async () => {
    await writeFile(join(vaultDir, "self.md"), "Links to [[self]]");

    const result = await vault.graph("self.md", { direction: "forward" });
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toContainEqual({ source: "self.md", target: "self.md" });
  });

  it("throws on path traversal attempts", async () => {
    await writeFile(join(vaultDir, "a.md"), "Content");

    await expect(vault.graph("../escape")).rejects.toThrow("Path escapes vault root");
  });

  it("deduplicates multiple links to the same target", async () => {
    await writeFile(
      join(vaultDir, "a.md"),
      "Link to [[b]] and again [[b]] and [[b|alias]]"
    );
    await writeFile(join(vaultDir, "b.md"), "Content");

    const result = await vault.graph("a.md", { direction: "forward" });
    const edgesToB = result.edges.filter(
      (e) => e.source === "a.md" && e.target === "b.md"
    );
    expect(edgesToB).toHaveLength(1);
  });
});
