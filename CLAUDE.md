# gneiss-mcp

A general-purpose MCP server for Obsidian vaults. Structure-agnostic — vault conventions are exposed via a `CLAUDE.md` resource, not hardcoded.

## Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Tests**: Vitest

## Architecture

```
src/
├── index.ts          # Entry point, server setup
├── vault/            # Vault abstraction (filesystem operations)
│   ├── types.ts      # VaultEntry, SearchResult, Frontmatter
│   └── vault.ts      # Vault class
├── tools/            # MCP tool definitions (thin wrappers over vault)
└── resources/        # MCP resources (vault-conventions)
```

Tools are thin wrappers — business logic lives in `vault/`.

## Build & Test

```bash
bun run start               # Run the server
bun test                    # Run tests
bun run typecheck           # Type check
```

## Configuration

Vault path via env var or CLI arg:
```bash
GNEISS_VAULT=~/my-vault bun run start
# or
bun run src/index.ts ~/my-vault
```
