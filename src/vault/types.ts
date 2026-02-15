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
