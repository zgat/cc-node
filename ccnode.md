# CC Node

This file provides guidance to CC Node when working with code in this repository.

## Project Overview

This is **CC Node**, a terminal-based AI coding assistant using a custom Ink renderer. Originally ported from Anthropic's Claude Code CLI. The codebase is large (~1,900 files, 500K+ lines) and is organized around a tool/command architecture, a custom terminal UI renderer, and an LLM query engine.

## Build & Development Commands

- **Build all entry points**: `npm run build`
  - Uses `scripts/build.js` (esbuild) to bundle 4 entry points into `dist/`:
    - `src/main.tsx` → `dist/main.js`
    - `src/entrypoints/cli.tsx` → `dist/cli.js`
    - `src/entrypoints/mcp.ts` → `dist/mcp.js`
    - `src/entrypoints/init.ts` → `dist/init.js`
  - Build is ESM, targets `node18`, emits sourcemaps.
  - Sets `NODE_OPTIONS='--max-old-space-size=8192'` by default for the large codebase.
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

### 3. UI Architecture (`src/components/`, `src/screens/`, `src/hooks/`)

The terminal UI is built with React components rendered through the custom Ink reconciler:

- **`src/screens/`**: Top-level screens — `REPL.tsx` (main interactive loop), `Doctor.tsx` (diagnostics), `ResumeConversation.tsx`.
- **`src/components/`**: Reusable UI components organized by feature: messages, diff views, dialogs, settings, permissions, MCP, skills, etc.
- **`src/hooks/`**: ~100 React hooks for terminal UI behavior — input handling (`useTextInput`, `useVimInput`), tool permissions (`useCanUseTool`), IDE integration, voice, SSH sessions, task management, and more.
- **`src/hooks/toolPermission/`**: Permission system for tool invocations. Contains `PermissionContext.ts` and handlers for each tool type.

### 4. Tool System (`src/tools/`)

Every capability the agent can invoke is a self-contained tool module (~40 tools). Each tool typically exports:

- A `name` and `description` for the LLM.
- An input schema (often Zod).
- An `askUser` permission prompt (if needed).
- A `call()` or `run()` function.

Key tools include `BashTool`, `FileReadTool`, `FileWriteTool`, `FileEditTool`, `GlobTool`, `GrepTool`, `AgentTool`, `MCPTool`, `NotebookEditTool`, `EnterPlanModeTool`, `ExitPlanModeTool`, `EnterWorktreeTool`, `ExitWorktreeTool`, and `TaskCreateTool`/`TaskUpdateTool`.

Tools are registered in `src/tools.ts`.

### 5. Command System (`src/commands/`)

Slash commands (e.g., `/commit`, `/doctor`, `/memory`, `/review`) are implemented as subdirectories or files under `src/commands/`. They are registered in `src/commands.ts`. Commands are user-facing shortcuts invoked from the REPL, not LLM tools.

### 6. Skills System (`src/skills/`)

User-invocable skills that extend agent capabilities:

- `bundled/`: Built-in skill definitions.
- `bundledSkills.ts`: Registration of bundled skills.
- `loadSkillsDir.ts`: Dynamically loads skills from directories.
- `mcpSkills.ts` / `mcpSkillBuilders.ts`: Skills provided by MCP servers.
- `runSkillGenerator.ts`: Generates skill runners.

### 7. Query Engine (`src/QueryEngine.ts`)

The core LLM interaction loop (~46K lines). Handles:

- Streaming API calls to Anthropic.
- Tool-call loops (parse tool calls → execute → feed results back).
- Retry logic, token counting, thinking mode, and context compaction.

### 8. Bridge System (`src/bridge/`)

Bidirectional communication layer for IDE extensions (VS Code, JetBrains). Key files:

- `bridgeMain.ts`: Main bridge loop.
- `replBridge.ts`: REPL session bridge.
- `sessionRunner.ts`: Session execution management.

### 9. Bridge Server (`bridge-server/`)

A **separate self-hosted server** (Node.js + Express + WebSocket) for managing CC Node sessions across multiple machines without Anthropic cloud. Has its own `package.json`, build, and frontend. See `bridge-server/README.md` for its architecture and API reference.

### 10. MCP Integration (`src/services/mcp/`)

MCP server connection, registry, and tool invocation. `src/entrypoints/mcp.ts` is the dedicated MCP server entry point.

### 11. Services Layer (`src/services/`)

Backend services for analytics, OAuth, MCP, LSP integration, plugins, session memory/transcripts, prompt suggestions, rate limiting, voice streaming, and tool use summaries.

### 12. Feature Flags (`src/utils/featureFlags.ts`)

Replaces Bun's `bun:bundle` compile-time feature flag system. The `feature()` function is used throughout the codebase:

```typescript
import { feature } from 'bun:bundle'
if (feature('BRIDGE_MODE')) { ... }
```

The `bun:bundle` import is aliased (via tsconfig paths and an esbuild plugin) to `src/utils/featureFlags.ts`. At build time, esbuild's `define` option replaces `FEATURE_XXX` globals with literal `true`/`false` strings, enabling dead-code elimination.

Current flags: `PROACTIVE`, `KAIROS`, `BRIDGE_MODE`, `DAEMON`, `VOICE_MODE`, `AGENT_TRIGGERS`, `MONITOR_TOOL`, `COORDINATOR_MODE`.

### 13. Build-time Aliases & Stubs

The esbuild script (`scripts/build.js`) performs several non-standard transformations:

- **`.js` → `.ts`/`.tsx` resolution**: A custom plugin resolves `import './foo.js'` to `./foo.ts` or `./foo.tsx` (mimicking Bun/TypeScript behavior).
- **`bun:bundle` alias**: Redirected to `src/utils/featureFlags.ts`.
- **`react/compiler-runtime` alias**: Redirected to `react-compiler-runtime` package.
- **Internal package stubs**: `@anthropic-ai/sandbox-runtime`, `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/mcpb`, and `@ant/*` packages are stubbed with files under `src/__stubs__/`.
- **Build target plugin**: Replaces `"external" === 'ant'` with `false` and `"external" !== 'ant'` with `true` for dead-code elimination.
- **MACRO constants** injected at build time: `VERSION`, `COMMIT_ID`, `BUILD_TIME`, `FEEDBACK_CHANNEL`, `ISSUES_EXPLAINER`, `NATIVE_PACKAGE_URL`, `PACKAGE_URL`, `VERSION_CHANGELOG`.

### 14. State & Context

- `src/state/`: App state stores (e.g., `AppStateStore.ts`).
- `src/context.ts`: System/user context collection.
- `src/services/analytics/growthbook.ts`: Feature flags and analytics.
- `src/hooks/toolPermission/`: Permission system for tool invocations.

## Important Development Notes

- **React 19 is required**. The custom reconciler in `src/ink/` relies on APIs only present in `react-reconciler ^0.33.0` paired with React 19.
- **Module format is ESM**. `package.json` has `"type": "module"`. The build injects a `createRequire` banner for CJS compatibility.
- **Import extensions**: Source files use `.js` extensions in imports even when the source file is `.ts` or `.tsx`. This is intentional and handled by the build plugin. Always use `.js` extensions in new imports.
- **No linter/test runner configured**: There is no ESLint, Prettier, Jest, or Vitest configuration. Rely on `npm run typecheck` for validation.
- **Color diff rendering**: The npm package `color-diff-napi` is a placeholder with no real native code. This port uses `src/native-ts/color-diff/index.ts` — a pure TypeScript implementation using `highlight.js` for syntax highlighting and the `diff` package for word-level diffs, producing ANSI-colored terminal output.
- **Browser automation**: The original `@ant/claude-for-chrome-mcp` (private Chrome extension + Native Messaging) has been replaced with the official Google `chrome-devtools-mcp` server, which controls Chrome directly via Puppeteer and the DevTools Protocol.
- **Removed internal placeholder dependencies**: `audio-capture-napi` was removed (voice falls back to SoX/arecord), `modifiers-napi` was removed with a safe runtime fallback, and the dead `@anthropic-ai/claude-agent-sdk` type import was cleaned up.
- **Keybinding change**: The "think" toggle keybinding has been remapped from `Cmd+T` (`meta+t`) to `Tab` (`tab`).
- **Computer Use (TODO)**: The `@ant/computer-use-mcp`, `@ant/computer-use-input`, and `@ant/computer-use-swift` packages are Anthropic-internal native modules and are currently stubbed. Real Computer Use functionality (GUI automation, screenshots, native input) is not yet implemented in this port.
- **Build memory**: `npm run build` defaults to 8GB heap. Override with `NODE_OPTIONS="--max-old-space-size=4096" npm run build` if needed.
