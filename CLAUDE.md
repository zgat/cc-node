# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Node.js port of the Claude Code CLI**, originally built for Bun. It is a terminal-based React application using a custom Ink renderer. The codebase is large (~1,900 files, 500K+ lines) and is organized around a tool/command architecture, a custom terminal UI renderer, and an LLM query engine.

## Build & Development Commands

- **Build all entry points**: `npm run build`
  - Uses `scripts/build.js` (esbuild) to bundle 4 entry points into `dist/`:
    - `src/main.tsx` → `dist/main.js`
    - `src/entrypoints/cli.tsx` → `dist/cli.js`
    - `src/entrypoints/mcp.ts` → `dist/mcp.js`
    - `src/entrypoints/init.ts` → `dist/init.js`
  - Build is ESM, targets `node18`, emits sourcemaps.
  - `npm run build:watch` for watch mode.
- **Run without building**: `npm run dev` (uses `tsx src/main.tsx`)
- **Type check**: `npm run typecheck` (`tsc --noEmit`)
- **No test suite**: This repository does not contain its own tests. Do not attempt to run `npm test`.

## High-Level Architecture

### 1. Entry Points

All user-facing execution flows through one of four entry points in `src/entrypoints/`:

- **`cli.tsx`**: Bootstrap entry. Handles fast-path flags (`--version`) and ablation baselines before dynamically importing `main.tsx`.
- **`main.tsx`**: Primary CLI orchestration (~800KB). Parses arguments with Commander.js, initializes OAuth/GrowthBook/telemetry, creates the Ink root, and launches the REPL or print-mode session.
- **`mcp.ts`**: MCP (Model Context Protocol) server entry point.
- **`init.ts`**: Shared initialization logic for analytics, telemetry, and trust onboarding.

### 2. Custom Ink Renderer (`src/ink/`)

This project **does not use the npm `ink` package** directly. It maintains a **forked/custom Ink implementation** inside `src/ink/`:

- `ink.tsx`: The core renderer class. Creates a React reconciler container, manages terminal frames, and schedules renders.
- `reconciler.ts`: Custom React reconciler built on `react-reconciler`.
- `root.ts`: Managed root API (`createRoot`), similar to `react-dom/createRoot`.
- `render-to-screen.ts`: Utility for rendering a single React element to an in-memory screen buffer (used for non-interactive output).

**Critical runtime requirement**: The Ink reconciler uses `updateContainerSync` and `flushSyncWork`, which require **React 19** and `react-reconciler ^0.33.0`. Do not downgrade React.

### 3. Tool System (`src/tools/`)

Every capability the agent can invoke is a self-contained tool module (~40 tools). Each tool typically exports:

- A `name` and `description` for the LLM.
- An input schema (often Zod).
- An `askUser` permission prompt (if needed).
- A `call()` or `run()` function.

Key tools include `BashTool`, `FileReadTool`, `FileWriteTool`, `FileEditTool`, `GlobTool`, `GrepTool`, `AgentTool`, `MCPTool`, `NotebookEditTool`, `EnterPlanModeTool`, `ExitPlanModeTool`, `EnterWorktreeTool`, `ExitWorktreeTool`, and `TaskCreateTool`/`TaskUpdateTool`.

Tools are registered in `src/tools.ts`.

### 4. Command System (`src/commands/`)

Slash commands (e.g., `/commit`, `/doctor`, `/memory`, `/review`) are implemented as subdirectories under `src/commands/`. They are registered in `src/commands.ts`. Commands are user-facing shortcuts invoked from the REPL, not LLM tools.

### 5. Query Engine (`src/QueryEngine.ts`)

The core LLM interaction loop (~46K lines). Handles:

- Streaming API calls to Anthropic.
- Tool-call loops (parse tool calls → execute → feed results back).
- Retry logic, token counting, thinking mode, and context compaction.

### 6. Bridge System (`src/bridge/`)

Bidirectional communication layer for IDE extensions (VS Code, JetBrains). Key files:

- `bridgeMain.ts`: Main bridge loop.
- `replBridge.ts`: REPL session bridge.
- `sessionRunner.ts`: Session execution management.

### 7. MCP Integration (`src/services/mcp/`)

MCP server connection, registry, and tool invocation. `src/entrypoints/mcp.ts` is the dedicated MCP server entry point.

### 8. Feature Flags (`src/utils/featureFlags.ts`)

Replaces Bun's `bun:bundle` compile-time feature flag system. The `feature()` function is used throughout the codebase:

```typescript
import { feature } from 'bun:bundle'
if (feature('BRIDGE_MODE')) { ... }
```

The `bun:bundle` import is aliased (via tsconfig paths and an esbuild plugin) to `src/utils/featureFlags.ts`. At build time, esbuild's `define` option replaces `FEATURE_XXX` globals with literal `true`/`false` strings, enabling dead-code elimination.

Current flags defined in `scripts/build.js`: `PROACTIVE`, `KAIROS`, `BRIDGE_MODE`, `DAEMON`, `VOICE_MODE`, `AGENT_TRIGGERS`, `MONITOR_TOOL`, `COORDINATOR_MODE`.

### 9. Build-time Aliases & Stubs

The esbuild script (`scripts/build.js`) performs several non-standard transformations:

- **`.js` → `.ts`/`.tsx` resolution**: A custom plugin resolves `import './foo.js'` to `./foo.ts` or `./foo.tsx` (mimicking Bun/TypeScript behavior).
- **`bun:bundle` alias**: Redirected to `src/utils/featureFlags.ts`.
- **Internal package stubs**: `@anthropic-ai/sandbox-runtime`, `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/mcpb`, and `@ant/*` packages are stubbed with files under `src/__stubs__/`.
- **Build target plugin**: Replaces `"external" === 'ant'` with `false` and `"external" !== 'ant'` with `true` for dead-code elimination.

### 10. State & Context

- `src/state/`: App state stores (e.g., `AppStateStore.ts`).
- `src/context.ts`: System/user context collection.
- `src/services/analytics/growthbook.ts`: Feature flags and analytics.
- `src/hooks/toolPermission/`: Permission system for tool invocations.

## Important Development Notes

- **React 19 is required**. The custom reconciler in `src/ink/` relies on APIs only present in `react-reconciler ^0.33.0` paired with React 19.
- **Module format is ESM**. `package.json` has `"type": "module"`. The build injects a `createRequire` banner for CJS compatibility.
- **Import extensions**: Source files often use `.js` extensions in imports even when the source file is `.ts` or `.tsx`. This is intentional and handled by the build plugin.
- **No linter/test runner configured**: There is no ESLint, Prettier, Jest, or Vitest configuration for the project's own source. Rely on `npm run typecheck` for validation.
