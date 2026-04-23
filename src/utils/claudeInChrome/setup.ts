import { BROWSER_TOOLS } from '@ant/claude-for-chrome-mcp'
import { join } from 'path'
import {
  getIsNonInteractiveSession,
  getSessionBypassPermissionsMode,
} from '../../bootstrap/state.ts'
import type { ScopedMcpServerConfig } from '../../services/mcp/types.ts'
import { isInBundledMode } from '../bundledMode.ts'
import { getGlobalConfig } from '../config.ts'
import {
  isEnvDefinedFalsy,
  isEnvTruthy,
} from '../envUtils.ts'
import { CLAUDE_IN_CHROME_MCP_SERVER_NAME } from './common.ts'
import { getChromeSystemPrompt } from './prompt.ts'

export function shouldEnableClaudeInChrome(chromeFlag?: boolean): boolean {
  // Disable by default in non-interactive sessions (e.g., SDK, CI)
  if (getIsNonInteractiveSession() && chromeFlag !== true) {
    return false
  }

  // Check CLI flags
  if (chromeFlag === true) {
    return true
  }
  if (chromeFlag === false) {
    return false
  }

  // Check environment variables
  if (isEnvTruthy(process.env.CLAUDE_CODE_ENABLE_CFC)) {
    return true
  }
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ENABLE_CFC)) {
    return false
  }

  // Check default config settings
  const config = getGlobalConfig()
  if (config.claudeInChromeDefaultEnabled !== undefined) {
    return config.claudeInChromeDefaultEnabled
  }

  return false
}

let shouldAutoEnable: boolean | undefined = undefined

export function shouldAutoEnableClaudeInChrome(): boolean {
  if (shouldAutoEnable !== undefined) {
    return shouldAutoEnable
  }

  // chrome-devtools-mcp does not require a Chrome extension;
  // auto-enable when the user has opted in via config or env.
  shouldAutoEnable = shouldEnableClaudeInChrome()

  return shouldAutoEnable
}

/**
 * chrome-devtools-mcp does not require a Chrome extension.
 * Kept as a stub for backward compatibility with UI code.
 */
export async function isChromeExtensionInstalled(): Promise<boolean> {
  return true
}

/**
 * Setup Claude in Chrome MCP server and tools
 *
 * Uses the official Google chrome-devtools-mcp server (spawned via
 * --claude-in-chrome-mcp) instead of the original  Chrome extension
 * + Native Messaging stack.
 *
 * @returns MCP config and allowed tools
 */
export function setupClaudeInChrome(): {
  mcpConfig: Record<string, ScopedMcpServerConfig>
  allowedTools: string[]
  systemPrompt: string
} {
  const isNativeBuild = isInBundledMode()
  const allowedTools = BROWSER_TOOLS.map(
    tool => `mcp__claude-in-chrome__${tool.name}`,
  )

  const env: Record<string, string> = {}
  if (getSessionBypassPermissionsMode()) {
    env.CLAUDE_CHROME_PERMISSION_MODE = 'skip_all_permission_checks'
  }
  const hasEnv = Object.keys(env).length > 0

  if (isNativeBuild) {
    return {
      mcpConfig: {
        [CLAUDE_IN_CHROME_MCP_SERVER_NAME]: {
          type: 'stdio' as const,
          command: process.execPath,
          args: ['--claude-in-chrome-mcp'],
          scope: 'dynamic' as const,
          ...(hasEnv && { env }),
        },
      },
      allowedTools,
      systemPrompt: getChromeSystemPrompt(),
    }
  } else {
    const cliPath = join(process.cwd(), 'dist', 'cli.js')

    const mcpConfig = {
      [CLAUDE_IN_CHROME_MCP_SERVER_NAME]: {
        type: 'stdio' as const,
        command: process.execPath,
        args: [`${cliPath}`, '--claude-in-chrome-mcp'],
        scope: 'dynamic' as const,
        ...(hasEnv && { env }),
      },
    }

    return {
      mcpConfig,
      allowedTools,
      systemPrompt: getChromeSystemPrompt(),
    }
  }
}
