import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Vault } from "../src/vault/vault.ts";

let vaultDir: string;
let vault: Vault;

beforeEach(async () => {
  vaultDir = await mkdtemp(join(tmpdir(), "gneiss-test-"));
  vault = new Vault(vaultDir);
});

afterEach(async () => {
  await rm(vaultDir, { recursive: true });
});

/** Helper to create a file with content inside the temp vault. */
async function createFile(path: string, content: string): Promise<void> {
  const full = join(vaultDir, path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content, "utf-8");
}

/** Helper to create a directory inside the temp vault. */
async function createDir(path: string): Promise<void> {
  await mkdir(join(vaultDir, path), { recursive: true });
}

describe("Vault.list", () => {
  it("lists files and folders at vault root", async () => {
    await createFile("note.md", "hello");
    await createDir("projects");

    const entries = await vault.list();

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "note", isDirectory: false }),
        expect.objectContaining({ name: "projects", isDirectory: true }),
      ])
    );
  });

  it("lists entries in a subdirectory", async () => {
    await createFile("projects/alpha.md", "# Alpha");
    await createFile("projects/beta.md", "# Beta");

    const entries = await vault.list("projects");

    expect(entries).toHaveLength(2);
    expect(entries[0]!.name).toBe("alpha");
    expect(entries[1]!.name).toBe("beta");
  });

  it("skips hidden files and folders", async () => {
    await createFile(".obsidian/config.json", "{}");
    await createFile("visible.md", "content");

    const entries = await vault.list();

    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("visible");
  });

  it("returns empty array for empty directory", async () => {
    const entries = await vault.list();
    expect(entries).toEqual([]);
  });

  it("returns paths relative to vault root", async () => {
    await createFile("deep/nested/note.md", "content");

    const entries = await vault.list("deep/nested");

    expect(entries[0]!.path).toBe("deep/nested/note.md");
  });
});

describe("Vault.tree", () => {
  it("renders a tree with files and folders", async () => {
    await createFile("notes/daily.md", "today");
    await createFile("notes/weekly.md", "this week");
    await createFile("readme.md", "root file");

    const tree = await vault.tree();

    expect(tree).toContain("notes");
    expect(tree).toContain("daily.md");
    expect(tree).toContain("weekly.md");
    expect(tree).toContain("readme.md");
    expect(tree).toContain("├── ");
    expect(tree).toContain("└── ");
  });

  it("respects depth limit", async () => {
    await createFile("a/b/c/deep.md", "deep");

    const shallow = await vault.tree("", 1);

    expect(shallow).toContain("a");
    expect(shallow).not.toContain("b");
  });

  it("returns empty string for empty directory", async () => {
    const tree = await vault.tree();
    expect(tree).toBe("");
  });
});

describe("Vault.read", () => {
  it("reads markdown with frontmatter", async () => {
    const md = `---
tags:
  - project
  - active
status: in-progress
---

# My Project

Some content here.`;

    await createFile("project.md", md);

    const result = await vault.read("project.md");

    expect(result.frontmatter).toEqual({
      tags: ["project", "active"],
      status: "in-progress",
    });
    expect(result.content).toContain("# My Project");
    expect(result.content).toContain("Some content here.");
  });

  it("reads markdown without frontmatter", async () => {
    await createFile("plain.md", "# Just a heading\n\nNo frontmatter.");

    const result = await vault.read("plain.md");

    expect(result.frontmatter).toEqual({});
    expect(result.content).toContain("# Just a heading");
  });

  it("reads non-markdown files as plain text", async () => {
    await createFile("data.json", '{"key": "value"}');

    const result = await vault.read("data.json");

    expect(result.frontmatter).toBeUndefined();
    expect(result.content).toBe('{"key": "value"}');
  });

  it("throws on non-existent file", async () => {
    await expect(vault.read("ghost.md")).rejects.toThrow();
  });
});

describe("Vault.search", () => {
  it("finds matching lines across files", async () => {
    await createFile("meetings/standup.md", "# Standup\nDiscussed the API refactor.");
    await createFile("meetings/retro.md", "# Retro\nTeam velocity improved.");
    await createFile("projects/api.md", "# API\nRefactor the authentication layer.");

    const results = await vault.search("refactor");

    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.path);
    expect(paths).toContain("meetings/standup.md");
    expect(paths).toContain("projects/api.md");
  });

  it("is case-insensitive", async () => {
    await createFile("note.md", "TypeScript is great");

    const results = await vault.search("typescript");

    expect(results).toHaveLength(1);
    expect(results[0]!.matches[0]).toBe("TypeScript is great");
  });

  it("returns empty array when nothing matches", async () => {
    await createFile("note.md", "hello world");

    const results = await vault.search("nonexistent");

    expect(results).toEqual([]);
  });

  it("only searches markdown files", async () => {
    await createFile("data.json", '{"query": "refactor"}');
    await createFile("note.md", "no match here");

    const results = await vault.search("refactor");

    expect(results).toEqual([]);
  });

  it("skips hidden directories", async () => {
    await createFile(".obsidian/plugins.md", "refactor this plugin");
    await createFile("visible.md", "nothing here");

    const results = await vault.search("refactor");

    expect(results).toEqual([]);
  });

  it("returns multiple matching lines per file", async () => {
    await createFile(
      "note.md",
      "first mention of API\nsomething else\nAPI again here"
    );

    const results = await vault.search("api");

    expect(results).toHaveLength(1);
    expect(results[0]!.matches).toHaveLength(2);
  });
});

describe("Vault.create", () => {
  it("creates a markdown file with content", async () => {
    await vault.create("new-note.md", "# Hello\n\nWorld.");

    const content = await readFile(join(vaultDir, "new-note.md"), "utf-8");
    expect(content).toBe("# Hello\n\nWorld.");
  });

  it("creates a file with empty content by default", async () => {
    await vault.create("empty.md");

    const content = await readFile(join(vaultDir, "empty.md"), "utf-8");
    expect(content).toBe("");
  });

  it("creates nested directories for files", async () => {
    await vault.create("deep/nested/note.md", "content");

    const content = await readFile(
      join(vaultDir, "deep/nested/note.md"),
      "utf-8"
    );
    expect(content).toBe("content");
  });

  it("creates a directory with trailing slash", async () => {
    await vault.create("new-folder/");

    const entries = await vault.list();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "new-folder", isDirectory: true }),
      ])
    );
  });

  it("returns the created path", async () => {
    const result = await vault.create("notes/idea.md", "an idea");
    expect(result).toBe("notes/idea.md");
  });
});

describe("Vault.move", () => {
  it("moves a file to a new location", async () => {
    await createFile("old.md", "content");
    await createDir("archive");

    await vault.move("old.md", "archive/old.md");

    const entries = await vault.list("archive");
    expect(entries[0]!.name).toBe("old");
    await expect(vault.read("old.md")).rejects.toThrow();
  });

  it("moves a directory", async () => {
    await createFile("src/a.md", "a");
    await createFile("src/b.md", "b");

    await vault.move("src", "dest");

    const entries = await vault.list("dest");
    expect(entries).toHaveLength(2);
    await expect(vault.list("src")).rejects.toThrow();
  });
});

describe("Vault.rename", () => {
  it("renames a markdown file preserving extension", async () => {
    await createFile("old-name.md", "content");

    const newPath = await vault.rename("old-name.md", "new-name");

    expect(newPath).toBe("new-name.md");
    const result = await vault.read("new-name.md");
    expect(result.content).toContain("content");
  });

  it("renames a directory", async () => {
    await createFile("old-dir/note.md", "inside");

    const newPath = await vault.rename("old-dir", "new-dir");

    expect(newPath).toBe("new-dir");
    const entries = await vault.list("new-dir");
    expect(entries[0]!.name).toBe("note");
  });

  it("renames a file in a subdirectory", async () => {
    await createFile("projects/draft.md", "wip");

    const newPath = await vault.rename("projects/draft.md", "final");

    expect(newPath).toBe("projects/final.md");
  });
});

describe("Vault path traversal protection", () => {
  it("allows valid relative paths", async () => {
    await createFile("subdir/note.md", "content");

    const result = await vault.read("subdir/note.md");
    expect(result.content).toContain("content");
  });

  it("blocks ../ escape on read", async () => {
    await expect(vault.read("../etc/passwd")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on list", async () => {
    await expect(vault.list("../")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on create", async () => {
    await expect(vault.create("../outside.md", "bad")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on move source", async () => {
    await createFile("legit.md", "ok");
    await expect(vault.move("../outside.md", "legit.md")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on move dest", async () => {
    await createFile("legit.md", "ok");
    await expect(vault.move("legit.md", "../outside.md")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on rename", async () => {
    await createFile("legit.md", "ok");
    await expect(vault.rename("../outside.md", "new")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on delete", async () => {
    await expect(vault.delete("../outside")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks ../ escape on tree", async () => {
    await expect(vault.tree("../")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks deeply nested escape", async () => {
    await expect(vault.read("../../../etc/passwd")).rejects.toThrow(
      "Path escapes vault root"
    );
  });

  it("blocks path that starts valid but resolves outside", async () => {
    await createDir("subdir");
    await expect(vault.read("subdir/../../..")).rejects.toThrow(
      "Path escapes vault root"
    );
  });
});

describe("Vault.edit", () => {
  describe("replace mode", () => {
    it("replaces body, preserves frontmatter for markdown", async () => {
      await createFile(
        "note.md",
        "---\ntags: [a]\n---\n\nOriginal body."
      );

      await vault.edit("note.md", { mode: "replace", content: "New body." });

      const result = await vault.read("note.md");
      expect(result.content.trim()).toBe("New body.");
      expect(result.frontmatter).toEqual({ tags: ["a"] });
    });

    it("works for non-markdown files", async () => {
      await createFile("data.txt", "old content");

      await vault.edit("data.txt", { mode: "replace", content: "new content" });

      const result = await vault.read("data.txt");
      expect(result.content).toBe("new content");
    });
  });

  describe("append mode", () => {
    it("appends to end of file", async () => {
      await createFile("note.md", "---\ntitle: Test\n---\n\nExisting.");

      await vault.edit("note.md", { mode: "append", content: "\n\nAppended." });

      const result = await vault.read("note.md");
      expect(result.content).toContain("Existing.");
      expect(result.content.trimEnd().endsWith("Appended.")).toBe(true);
    });
  });

  describe("prepend mode", () => {
    it("inserts after frontmatter for markdown", async () => {
      await createFile(
        "note.md",
        "---\ntitle: Test\n---\n\nExisting content."
      );

      await vault.edit("note.md", { mode: "prepend", content: "Prepended.\n\n" });

      const result = await vault.read("note.md");
      expect(result.content).toMatch(/^Prepended\.\n\n.*Existing content\./s);
      expect(result.frontmatter).toEqual({ title: "Test" });
    });

    it("inserts at start for non-markdown", async () => {
      await createFile("data.txt", "existing");

      await vault.edit("data.txt", { mode: "prepend", content: "prepended\n" });

      const result = await vault.read("data.txt");
      expect(result.content).toBe("prepended\nexisting");
    });

    it("inserts at start for markdown without frontmatter", async () => {
      await createFile("plain.md", "# Heading\n\nBody.");

      await vault.edit("plain.md", { mode: "prepend", content: "Top.\n\n" });

      const result = await vault.read("plain.md");
      expect(result.content).toMatch(/^Top\.\n\n.*# Heading/s);
    });
  });

  describe("find-replace mode", () => {
    it("replaces first occurrence by default", async () => {
      await createFile("note.md", "foo bar foo baz");

      await vault.edit("note.md", {
        mode: "find-replace",
        find: "foo",
        replace: "qux",
      });

      const result = await vault.read("note.md");
      expect(result.content).toBe("qux bar foo baz");
    });

    it("replaces all occurrences when all: true", async () => {
      await createFile("note.md", "foo bar foo baz");

      await vault.edit("note.md", {
        mode: "find-replace",
        find: "foo",
        replace: "qux",
        all: true,
      });

      const result = await vault.read("note.md");
      expect(result.content).toBe("qux bar qux baz");
    });

    it("throws when find string not found", async () => {
      await createFile("note.md", "hello world");

      await expect(
        vault.edit("note.md", {
          mode: "find-replace",
          find: "missing",
          replace: "x",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("patch-frontmatter mode", () => {
    it("merges keys into existing frontmatter", async () => {
      await createFile(
        "note.md",
        "---\ntitle: Old\nstatus: draft\n---\n\nBody."
      );

      await vault.edit("note.md", {
        mode: "patch-frontmatter",
        metadata: { status: "published", category: "blog" },
      });

      const result = await vault.read("note.md");
      expect(result.frontmatter).toEqual({
        title: "Old",
        status: "published",
        category: "blog",
      });
      expect(result.content).toContain("Body.");
    });

    it("adds frontmatter to plain markdown", async () => {
      await createFile("plain.md", "# Heading\n\nBody.");

      await vault.edit("plain.md", {
        mode: "patch-frontmatter",
        metadata: { tags: ["new"] },
      });

      const result = await vault.read("plain.md");
      expect(result.frontmatter).toEqual({ tags: ["new"] });
      expect(result.content).toContain("# Heading");
    });

    it("throws for non-markdown files", async () => {
      await createFile("data.txt", "text");

      await expect(
        vault.edit("data.txt", {
          mode: "patch-frontmatter",
          metadata: { key: "val" },
        })
      ).rejects.toThrow("non-markdown");
    });
  });

  it("blocks path traversal", async () => {
    await expect(
      vault.edit("../outside.md", { mode: "replace", content: "bad" })
    ).rejects.toThrow("Path escapes vault root");
  });

  it("throws on non-existent file", async () => {
    await expect(
      vault.edit("ghost.md", { mode: "replace", content: "x" })
    ).rejects.toThrow();
  });
});

describe("Vault.delete", () => {
  it("deletes a file", async () => {
    await createFile("trash.md", "delete me");

    await vault.delete("trash.md");

    await expect(vault.read("trash.md")).rejects.toThrow();
  });

  it("deletes a directory recursively", async () => {
    await createFile("folder/a.md", "a");
    await createFile("folder/b.md", "b");

    await vault.delete("folder");

    await expect(vault.list("folder")).rejects.toThrow();
  });

  it("throws on non-existent path", async () => {
    await expect(vault.delete("ghost.md")).rejects.toThrow();
  });
});
