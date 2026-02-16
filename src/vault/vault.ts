import { readdir, readFile, stat, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { join, resolve, relative, basename, extname, dirname } from "node:path";
import matter from "gray-matter";
import type { VaultEntry, SearchResult, SurfaceResult, GraphResult, Frontmatter, EditOperation } from "./types.ts";

export class Vault {
  constructor(readonly root: string) {}

  /** Resolve a user-supplied path and ensure it stays within the vault root. */
  private resolveSafe(userPath: string): string {
    const resolvedRoot = resolve(this.root);
    const resolvedPath = resolve(this.root, userPath);
    if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + "/")) {
      throw new Error(`Path escapes vault root: ${userPath}`);
    }
    return resolvedPath;
  }

  /** List entries in a directory (relative path from vault root). */
  async list(dirPath = ""): Promise<VaultEntry[]> {
    const fullPath = this.resolveSafe(dirPath);
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
    await this.buildTree(this.resolveSafe(dirPath), "", depth, lines);
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
    const fullPath = this.resolveSafe(filePath);
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
    const fullPath = this.resolveSafe(targetPath);

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
    await rename(this.resolveSafe(sourcePath), this.resolveSafe(destPath));
  }

  /** Rename a file or directory. */
  async rename(filePath: string, newName: string): Promise<string> {
    const sourceFullPath = this.resolveSafe(filePath);
    const dir = dirname(filePath);
    const ext = extname(filePath);
    const newPath = join(dir, ext ? `${newName}${ext}` : newName);
    const destFullPath = this.resolveSafe(newPath);
    await rename(sourceFullPath, destFullPath);
    return newPath;
  }

  /** Delete a file or directory. */
  async delete(targetPath: string): Promise<void> {
    const fullPath = this.resolveSafe(targetPath);
    const s = await stat(fullPath);
    await rm(fullPath, { recursive: s.isDirectory() });
  }

  /** Edit an existing file with the given operation. */
  async edit(filePath: string, operation: EditOperation): Promise<void> {
    const fullPath = this.resolveSafe(filePath);
    const raw = await readFile(fullPath, "utf-8");
    const isMd = extname(filePath) === ".md";

    let result: string;

    switch (operation.mode) {
      case "replace": {
        if (isMd) {
          const { data } = matter(raw);
          result = matter.stringify(operation.content, data);
        } else {
          result = operation.content;
        }
        break;
      }

      case "append": {
        result = raw + operation.content;
        break;
      }

      case "prepend": {
        if (isMd) {
          const { data, content } = matter(raw);
          const hasData = Object.keys(data).length > 0;
          if (hasData) {
            result = matter.stringify(operation.content + content, data);
          } else {
            result = operation.content + raw;
          }
        } else {
          result = operation.content + raw;
        }
        break;
      }

      case "find-replace": {
        if (!raw.includes(operation.find)) {
          throw new Error(`Find string not found: "${operation.find}"`);
        }
        if (operation.all) {
          result = raw.replaceAll(operation.find, operation.replace);
        } else {
          result = raw.replace(operation.find, operation.replace);
        }
        break;
      }

      case "patch-frontmatter": {
        if (!isMd) {
          throw new Error("patch-frontmatter is only supported for non-markdown files");
        }
        const { data, content } = matter(raw);
        const merged = { ...data, ...operation.metadata };
        result = matter.stringify(content, merged);
        break;
      }
    }

    await writeFile(fullPath, result, "utf-8");
  }

  /** Surface notes relevant to a query using multi-signal scoring. */
  async surface(
    query: string,
    options: { path?: string; tags?: string[]; limit?: number } = {}
  ): Promise<SurfaceResult[]> {
    const limit = options.limit ?? 10;
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const startDir = options.path ? this.resolveSafe(options.path) : this.root;
    const files: { relPath: string; fullPath: string }[] = [];
    await this.collectMarkdownFiles(startDir, files);

    const results: SurfaceResult[] = [];

    for (const file of files) {
      const raw = await readFile(file.fullPath, "utf-8");
      const { data, content } = matter(raw);

      const tags: string[] = Array.isArray(data.tags)
        ? data.tags.map(String)
        : [];
      const aliases: string[] = Array.isArray(data.aliases)
        ? data.aliases.map(String)
        : [];
      const summary: string | undefined =
        typeof data.summary === "string" ? data.summary : undefined;
      const fileName = basename(file.relPath, ".md");

      // Tag filter: file must match at least one required tag (OR, with prefix matching)
      if (options.tags && options.tags.length > 0) {
        const hasMatch = options.tags.some((reqTag) =>
          tags.some(
            (t) =>
              t.toLowerCase() === reqTag.toLowerCase() ||
              t.toLowerCase().startsWith(reqTag.toLowerCase() + "/")
          )
        );
        if (!hasMatch) continue;
      }

      const matchedSignals: string[] = [];
      let score = 0;

      for (const term of terms) {
        // Tags (weight 5)
        if (
          tags.some(
            (t) =>
              t.toLowerCase() === term ||
              t.toLowerCase().startsWith(term + "/")
          )
        ) {
          score += 5;
          matchedSignals.push(`tag:${term}`);
        }

        // Aliases (weight 4)
        if (aliases.some((a) => a.toLowerCase().includes(term))) {
          score += 4;
          matchedSignals.push(`alias:${term}`);
        }

        // Filename (weight 3)
        if (fileName.toLowerCase().includes(term)) {
          score += 3;
          matchedSignals.push(`filename:${term}`);
        }

        // Summary (weight 3)
        if (summary && summary.toLowerCase().includes(term)) {
          score += 3;
          matchedSignals.push(`summary:${term}`);
        }

        // Body (weight 1)
        if (content.toLowerCase().includes(term)) {
          score += 1;
          matchedSignals.push(`body:${term}`);
        }
      }

      if (score > 0) {
        results.push({
          path: file.relPath,
          score,
          tags,
          summary,
          matchedSignals,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private async collectMarkdownFiles(
    dirPath: string,
    files: { relPath: string; fullPath: string }[]
  ): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.collectMarkdownFiles(fullPath, files);
      } else if (extname(entry.name) === ".md") {
        files.push({ relPath: relative(this.root, fullPath), fullPath });
      }
    }
  }

  /** Extract wikilink targets from markdown content. */
  private parseWikilinks(content: string): string[] {
    const re = /\[\[([^\]|#]+)[^\]]*\]\]/g;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      seen.add(match[1]!.trim());
    }
    return [...seen];
  }

  /** Resolve a wikilink target to a vault-relative path. */
  private resolveWikilink(
    target: string,
    fileIndex: Map<string, string>
  ): string | null {
    let normalized = target;
    if (normalized.toLowerCase().endsWith(".md")) {
      normalized = normalized.slice(0, -3);
    }

    // If target contains a path separator, try exact relative path
    if (target.includes("/")) {
      const withExt = normalized + ".md";
      // Check fileIndex for exact path match
      for (const [, path] of fileIndex) {
        if (path === withExt || path.toLowerCase() === withExt.toLowerCase()) {
          return path;
        }
      }
    }

    // Fallback: match by basename (case-insensitive)
    return fileIndex.get(normalized.toLowerCase()) ?? null;
  }

  /** Build forward link index and file basename→path lookup. */
  private async buildLinkIndex(): Promise<{
    forward: Map<string, string[]>;
    fileIndex: Map<string, string>;
  }> {
    const files: { relPath: string; fullPath: string }[] = [];
    await this.collectMarkdownFiles(this.root, files);

    // Build basename→path lookup (case-insensitive)
    const fileIndex = new Map<string, string>();
    for (const file of files) {
      const name = basename(file.relPath, ".md").toLowerCase();
      fileIndex.set(name, file.relPath);
    }

    // Build forward link map
    const forward = new Map<string, string[]>();
    for (const file of files) {
      const raw = await readFile(file.fullPath, "utf-8");
      const targets = this.parseWikilinks(raw);
      const resolved: string[] = [];
      for (const target of targets) {
        const path = this.resolveWikilink(target, fileIndex);
        resolved.push(path ?? target);
      }
      forward.set(file.relPath, resolved);
    }

    return { forward, fileIndex };
  }

  /** Traverse the link graph around a root note. */
  async graph(
    path: string,
    options: { depth?: number; direction?: "forward" | "backward" | "both" } = {}
  ): Promise<GraphResult> {
    const rootPath = relative(this.root, this.resolveSafe(path));
    const depth = options.depth ?? 1;
    const direction = options.direction ?? "both";

    const { forward, fileIndex } = await this.buildLinkIndex();

    // Build backward map
    const backward = new Map<string, string[]>();
    for (const [source, targets] of forward) {
      for (const target of targets) {
        let list = backward.get(target);
        if (!list) {
          list = [];
          backward.set(target, list);
        }
        list.push(source);
      }
    }

    // All known file paths for existence checks
    const allPaths = new Set(fileIndex.values());

    const nodes = new Map<string, number>(); // path → depth
    const edges: { source: string; target: string }[] = [];
    const queue: { path: string; depth: number }[] = [{ path: rootPath, depth: 0 }];
    nodes.set(rootPath, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= depth) continue;

      const nextDepth = current.depth + 1;
      const neighbors: { source: string; target: string }[] = [];

      if (direction === "forward" || direction === "both") {
        for (const target of forward.get(current.path) ?? []) {
          neighbors.push({ source: current.path, target });
        }
      }

      if (direction === "backward" || direction === "both") {
        for (const source of backward.get(current.path) ?? []) {
          neighbors.push({ source, target: current.path });
        }
      }

      for (const edge of neighbors) {
        const neighbor = edge.source === current.path ? edge.target : edge.source;

        // Record edge (deduplicate by checking both directions)
        const edgeExists = edges.some(
          (e) => e.source === edge.source && e.target === edge.target
        );
        if (!edgeExists) {
          edges.push(edge);
        }

        // Queue neighbor if not yet visited
        if (!nodes.has(neighbor)) {
          nodes.set(neighbor, nextDepth);
          queue.push({ path: neighbor, depth: nextDepth });
        }
      }
    }

    return {
      root: rootPath,
      nodes: [...nodes.entries()].map(([p, d]) => ({
        path: p,
        depth: d,
        exists: allPaths.has(p),
      })),
      edges,
    };
  }
}
