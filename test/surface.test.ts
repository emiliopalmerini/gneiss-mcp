import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Vault } from "../src/vault/index.ts";

let vaultDir: string;
let vault: Vault;

beforeEach(async () => {
  vaultDir = await mkdtemp(join(tmpdir(), "gneiss-surface-"));
  vault = new Vault(vaultDir);
});

afterEach(async () => {
  await rm(vaultDir, { recursive: true });
});

function md(frontmatter: Record<string, unknown>, body: string): string {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}:\n${v.map((i) => `  - ${i}`).join("\n")}`;
      return `${k}: ${v}`;
    })
    .join("\n");
  return `---\n${yaml}\n---\n${body}`;
}

describe("surface", () => {
  it("scores tag matches with weight 5", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ tags: ["dotnet", "api"] }, "unrelated body")
    );

    const results = await vault.surface("dotnet");
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedSignals).toContain("tag:dotnet");
    // tag(5) + body should not match "dotnet" since body is "unrelated body"
    expect(results[0]!.score).toBe(5);
  });

  it("matches hierarchical tag prefixes", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ tags: ["dotnet/api"] }, "body text")
    );

    const results = await vault.surface("dotnet");
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedSignals).toContain("tag:dotnet");
  });

  it("scores alias matches with weight 4", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ aliases: ["CSharp Tutorial"] }, "nothing here")
    );

    const results = await vault.surface("csharp");
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedSignals).toContain("alias:csharp");
    expect(results[0]!.score).toBe(4);
  });

  it("scores filename matches with weight 3", async () => {
    await writeFile(
      join(vaultDir, "benchmarking.md"),
      md({}, "some body content")
    );

    const results = await vault.surface("benchmarking");
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedSignals).toContain("filename:benchmarking");
    // filename(3) + body(1) since "benchmarking" does not appear in body
    expect(results[0]!.score).toBe(3);
  });

  it("scores summary matches with weight 3", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ summary: "Overview of performance testing" }, "other content")
    );

    const results = await vault.surface("performance");
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedSignals).toContain("summary:performance");
    expect(results[0]!.score).toBe(3);
  });

  it("scores body matches with weight 1", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({}, "This discusses kubernetes deployment")
    );

    const results = await vault.surface("kubernetes");
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedSignals).toContain("body:kubernetes");
    expect(results[0]!.score).toBe(1);
  });

  it("sums scores across multiple signals", async () => {
    await writeFile(
      join(vaultDir, "dotnet.md"),
      md(
        { tags: ["dotnet"], aliases: ["dotnet guide"], summary: "A dotnet overview" },
        "Learn about dotnet here"
      )
    );

    const results = await vault.surface("dotnet");
    expect(results).toHaveLength(1);
    // tag(5) + alias(4) + filename(3) + summary(3) + body(1) = 16
    expect(results[0]!.score).toBe(16);
    expect(results[0]!.matchedSignals).toEqual(
      expect.arrayContaining([
        "tag:dotnet",
        "alias:dotnet",
        "filename:dotnet",
        "summary:dotnet",
        "body:dotnet",
      ])
    );
  });

  it("scores multiple query terms independently", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ tags: ["dotnet", "api"] }, "body text")
    );

    const results = await vault.surface("dotnet api");
    expect(results).toHaveLength(1);
    // dotnet: tag(5), api: tag(5)
    expect(results[0]!.score).toBe(10);
  });

  it("excludes files with score 0", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({}, "nothing relevant at all")
    );

    const results = await vault.surface("kubernetes");
    expect(results).toHaveLength(0);
  });

  it("sorts results by score descending", async () => {
    await writeFile(
      join(vaultDir, "high.md"),
      md({ tags: ["go"], summary: "go patterns" }, "go concurrency")
    );
    await writeFile(
      join(vaultDir, "low.md"),
      md({}, "mentions go once")
    );

    const results = await vault.surface("go");
    expect(results).toHaveLength(2);
    expect(results[0]!.path).toBe("high.md");
    expect(results[1]!.path).toBe("low.md");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it("respects limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await writeFile(
        join(vaultDir, `note${i}.md`),
        md({ tags: ["test"] }, "test content")
      );
    }

    const results = await vault.surface("test", { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("filters by path prefix", async () => {
    await mkdir(join(vaultDir, "projects"), { recursive: true });
    await writeFile(
      join(vaultDir, "projects", "note.md"),
      md({ tags: ["go"] }, "go project")
    );
    await writeFile(
      join(vaultDir, "other.md"),
      md({ tags: ["go"] }, "go elsewhere")
    );

    const results = await vault.surface("go", { path: "projects" });
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe("projects/note.md");
  });

  it("filters by required tags (OR match)", async () => {
    await writeFile(
      join(vaultDir, "a.md"),
      md({ tags: ["go", "api"] }, "content about go")
    );
    await writeFile(
      join(vaultDir, "b.md"),
      md({ tags: ["python"] }, "content about python")
    );
    await writeFile(
      join(vaultDir, "c.md"),
      md({ tags: ["rust"] }, "content about rust")
    );

    const results = await vault.surface("content", { tags: ["go", "python"] });
    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.path).sort();
    expect(paths).toEqual(["a.md", "b.md"]);
  });

  it("tag filter supports hierarchical prefix matching", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ tags: ["dotnet/api"] }, "content")
    );

    const results = await vault.surface("content", { tags: ["dotnet"] });
    expect(results).toHaveLength(1);
  });

  it("returns tags and summary in results", async () => {
    await writeFile(
      join(vaultDir, "note.md"),
      md({ tags: ["go", "concurrency"], summary: "Go concurrency patterns" }, "body")
    );

    const results = await vault.surface("go");
    expect(results[0]!.tags).toEqual(["go", "concurrency"]);
    expect(results[0]!.summary).toBe("Go concurrency patterns");
  });

  it("returns empty array for empty query", async () => {
    await writeFile(join(vaultDir, "note.md"), md({}, "content"));
    const results = await vault.surface("   ");
    expect(results).toHaveLength(0);
  });

  it("handles files without frontmatter", async () => {
    await writeFile(join(vaultDir, "plain.md"), "Just plain text about kubernetes");

    const results = await vault.surface("kubernetes");
    expect(results).toHaveLength(1);
    expect(results[0]!.tags).toEqual([]);
    expect(results[0]!.summary).toBeUndefined();
  });
});
