export interface Frontmatter {
  [key: string]: unknown;
}

export interface VaultEntry {
  /** Relative path from vault root */
  path: string;
  /** File or directory name without extension */
  name: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Parsed frontmatter (markdown files only) */
  frontmatter?: Frontmatter;
  /** Tags extracted from frontmatter or inline */
  tags?: string[];
}

export interface SearchResult {
  path: string;
  name: string;
  /** Matched line content */
  matches: string[];
}

export interface SurfaceResult {
  path: string;
  score: number;
  tags: string[];
  summary?: string;
  matchedSignals: string[];
}

export type EditOperation =
  | { mode: "replace"; content: string }
  | { mode: "append"; content: string }
  | { mode: "prepend"; content: string }
  | { mode: "find-replace"; find: string; replace: string; all?: boolean }
  | { mode: "patch-frontmatter"; metadata: Record<string, unknown> };
