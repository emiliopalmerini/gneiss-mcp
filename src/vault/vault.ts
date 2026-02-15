import { readdir, readFile, stat, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { join, relative, basename, extname, dirname } from "node:path";
import matter from "gray-matter";
import type { VaultEntry, SearchResult, Frontmatter } from "./types.ts";

export class Vault {
  constructor(readonly root: string) {}

  /** List entries in a directory (relative path from vault root). */
  async list(dirPath = ""): Promise<VaultEntry[]> {
    const fullPath = join(this.root, dirPath);
    const entries = await readdir(fullPath, { withFileTypes: true });

    const results: VaultEntry[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      results.push({
        path: relative(this.root, join(fullPath, entry.name)),
        name: entry.isDirectory()
          ? entry.name
          : basename(entry.name, extname(entry.name)),
        isDirectory: entry.isDirectory(),
      });
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Build a tree structure of the vault. */
  async tree(dirPath = "", depth = 3): Promise<string> {
    const lines: string[] = [];
    await this.buildTree(join(this.root, dirPath), "", depth, lines);
    return lines.join("\n");
  }

  private async buildTree(
    fullPath: string,
    prefix: string,
    depth: number,
    lines: string[]
  ): Promise<void> {
    if (depth <= 0) return;

    const entries = await readdir(fullPath, { withFileTypes: true });
    const visible = entries.filter((e) => !e.name.startsWith("."));
    visible.sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < visible.length; i++) {
      const entry = visible[i]!;
      const isLast = i === visible.length - 1;
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${entry.name}`);

      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        await this.buildTree(
          join(fullPath, entry.name),
          newPrefix,
          depth - 1,
          lines
        );
      }
    }
  }

  /** Read a file's content. Returns parsed frontmatter + body for markdown. */
  async read(filePath: string): Promise<{
    content: string;
    frontmatter?: Frontmatter;
  }> {
    const fullPath = join(this.root, filePath);
    const raw = await readFile(fullPath, "utf-8");

    if (extname(filePath) === ".md") {
      const { data, content } = matter(raw);
      return { content, frontmatter: data as Frontmatter };
    }
    return { content: raw };
  }

  /** Search for text across all markdown files. */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    await this.searchDir(this.root, lowerQuery, results);
    return results;
  }

  private async searchDir(
    dirPath: string,
    query: string,
    results: SearchResult[]
  ): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.searchDir(fullPath, query, results);
      } else if (extname(entry.name) === ".md") {
        const content = await readFile(fullPath, "utf-8");
        const matches: string[] = [];

        for (const line of content.split("\n")) {
          if (line.toLowerCase().includes(query)) {
            matches.push(line.trim());
          }
        }

        if (matches.length > 0) {
          results.push({
            path: relative(this.root, fullPath),
            name: basename(entry.name, ".md"),
            matches,
          });
        }
      }
    }
  }

  /** Create a file or directory. */
  async create(
    targetPath: string,
    content?: string
  ): Promise<string> {
    const fullPath = join(this.root, targetPath);

    if (targetPath.endsWith("/")) {
      await mkdir(fullPath, { recursive: true });
    } else {
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content ?? "", "utf-8");
    }
    return targetPath;
  }

  /** Move a file or directory. */
  async move(sourcePath: string, destPath: string): Promise<void> {
    await rename(join(this.root, sourcePath), join(this.root, destPath));
  }

  /** Rename a file or directory. */
  async rename(filePath: string, newName: string): Promise<string> {
    const dir = dirname(filePath);
    const ext = extname(filePath);
    const newPath = join(dir, ext ? `${newName}${ext}` : newName);
    await rename(join(this.root, filePath), join(this.root, newPath));
    return newPath;
  }

  /** Delete a file or directory. */
  async delete(targetPath: string): Promise<void> {
    const fullPath = join(this.root, targetPath);
    const s = await stat(fullPath);
    await rm(fullPath, { recursive: s.isDirectory() });
  }
}
