# CC Node

A Node.js-compatible port of CC Node, originally built for Bun. This version uses **esbuild** for bundling and runs on standard Node.js 18+.

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

## Installation

```bash
# Clone and install dependencies
git clone git@github.com:zgat/cc-node.git
cd cc-node
npm install

# Build and link the global `ccnode` command
npm run build
npm link
```

## Quick Start

```bash
# Run in interactive mode
ccnode

# Run a one-shot prompt
ccnode -p "Hello, ccnode"

# Build after making changes
npm run build

# Type check
npm run typecheck

# Dev mode (no build needed)
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_MODEL` | Model ID for API requests |
| `ANTHROPIC_BASE_URL` | Custom API endpoint |
| `ANTHROPIC_AUTH_TOKEN` | API authentication token |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Maximum context window size |

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
- **Color diff rendering**: The npm package `color-diff-napi` is a placeholder with no real native code. This port uses `src/native-ts/color-diff/index.ts` — a pure TypeScript implementation that uses `highlight.js` for syntax highlighting and the `diff` package for word-level diffs, producing ANSI-colored terminal output aligned with the original Rust module.
- **Claude in Chrome**: The original `@ant/claude-for-chrome-mcp` (private Chrome extension + Native Messaging) has been replaced with the official Google `chrome-devtools-mcp` server, which controls Chrome directly via Puppeteer and the DevTools Protocol.
- **Removed internal placeholder dependencies**: `audio-capture-napi` was removed (voice falls back to SoX/arecord), `modifiers-napi` was removed with a safe runtime fallback, and the dead `@anthropic-ai/claude-agent-sdk` type import was cleaned up.
- **Keybinding change**: The "think" toggle keybinding has been remapped from `Cmd+T` (`meta+t`) to `Tab` (`tab`).
- **Computer Use (TODO)**: The `@ant/computer-use-mcp`, `@ant/computer-use-input`, and `@ant/computer-use-swift` packages are Anthropic-internal native modules and are currently stubbed. Real Computer Use functionality (GUI automation, screenshots, native input) is not yet implemented in this port.
- **No test suite** in this repository

