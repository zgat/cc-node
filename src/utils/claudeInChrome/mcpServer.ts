import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { shutdownDatadog } from '../../services/analytics/datadog.ts'
import { shutdown1PEventLogging } from '../../services/analytics/firstPartyEventLogger.ts'
import { initializeAnalyticsSink } from '../../services/analytics/sink.ts'
import { enableConfigs } from '../config.ts'
import { logForDebugging } from '../debug.ts'

/**
 * Runs the Claude in Chrome MCP server.
 *
 * The original Anthropic implementation used a bundled Chrome extension with
 * Native Messaging. This port replaces it with the official Google
 * chrome-devtools-mcp server, which controls Chrome directly via Puppeteer
 * and the DevTools Protocol.
 */
export async function runClaudeInChromeMcpServer(): Promise<void> {
  enableConfigs()
  initializeAnalyticsSink()

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const localBin = join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'chrome-devtools-mcp')
  const command = existsSync(localBin) ? localBin : 'npx'
  const args = command === 'npx' ? ['-y', 'chrome-devtools-mcp'] : []

  logForDebugging('[Claude in Chrome] Starting chrome-devtools-mcp server')

  const child = spawn(command, args, {
    stdio: 'inherit',
  })

  let exiting = false
  const shutdownAndExit = async (): Promise<void> => {
    if (exiting) {
      return
    }
    exiting = true
    child.kill('SIGTERM')
    await shutdown1PEventLogging()
    await shutdownDatadog()
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0)
  }

  process.stdin.on('end', () => void shutdownAndExit())
  process.stdin.on('error', () => void shutdownAndExit())
  child.on('exit', () => void shutdownAndExit())
  child.on('error', (err) => {
    logForDebugging(`[Claude in Chrome] Failed to start chrome-devtools-mcp: ${err.message}`, { level: 'error' })
    void shutdownAndExit()
  })

  // Block until the child exits so the CLI flag handler doesn't return early.
  await new Promise<void>((resolve) => {
    child.on('close', () => resolve())
  })
}
