# Claude Code - Node.js Port

A Node.js-compatible port of the Claude Code CLI, originally built for Bun. This version uses **esbuild** for bundling and runs on standard Node.js 18+.

## Features

- Terminal-based React UI using a custom [Ink](https://github.com/vadimdemedes/ink) renderer
- 40+ agent tools (Bash, FileEdit, Glob, Grep, Agent, MCP, NotebookEdit, etc.)
- 50+ slash commands (`/commit`, `/review`, `/doctor`, `/memory`, etc.)
- MCP (Model Context Protocol) server support
- IDE bridge mode (VS Code / JetBrains extensions)
- Multi-agent coordination and task management

## Requirements

- **Node.js >= 18.0.0**
- **React 19** + **react-reconciler ^0.33.0** (required by the custom Ink reconciler)

## Quick Start

```bash
# Install dependencies
npm install

# Build all entry points
npm run build

# Run in interactive mode
node dist/cli.js

# Run a one-shot prompt
node dist/cli.js -p "Hello, Claude"

# Type check
npm run typecheck

# Dev mode (no build needed)
npm run dev
```

## Build Outputs

The build script (`scripts/build.js`) bundles 4 entry points:

| Source | Output |
|--------|--------|
| `src/main.tsx` | `dist/main.js` |
| `src/entrypoints/cli.tsx` | `dist/cli.js` |
| `src/entrypoints/mcp.ts` | `dist/mcp.js` |
| `src/entrypoints/init.ts` | `dist/init.js` |

## Architecture

- **`src/ink/`** — Custom Ink renderer fork with a React 19 reconciler
- **`src/tools/`** — Agent tool implementations (~40 tools)
- **`src/commands/`** — Slash command implementations (~50 commands)
- **`src/QueryEngine.ts`** — Core LLM streaming and tool-call loop
- **`src/bridge/`** — IDE extension bridge
- **`src/services/mcp/`** — MCP server management
- **`src/utils/featureFlags.ts`** — Compile-time feature flag replacement for `bun:bundle`

## Development Notes

- **ESM only**: `package.json` sets `"type": "module"`
- **Import extensions**: Source uses `.js` extensions in imports even for `.ts`/`.tsx` files; the esbuild plugin handles resolution
- **Feature flags**: esbuild `define` replaces flags like `FEATURE_BRIDGE_MODE` at build time for dead-code elimination
- **No test suite** in this repository

## License

Original Claude Code source remains the property of Anthropic. This repository is an independent port maintained for research and compatibility purposes.
