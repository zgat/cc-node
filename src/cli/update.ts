import chalk from 'chalk'
import { dirname } from 'path'
import { logEvent } from 'src/services/analytics/index.js'
import { getLatestCommitId } from 'src/utils/autoUpdater.js'
import { regenerateCompletionCache } from 'src/utils/completionCache.js'
import { logForDebugging } from 'src/utils/debug.js'
import { getDoctorDiagnostic } from 'src/utils/doctorDiagnostic.js'
import { execFileNoThrowWithCwd } from 'src/utils/execFileNoThrow.js'
import { findGitRoot } from 'src/utils/git.js'
import { gracefulShutdown } from 'src/utils/gracefulShutdown.js'
import { writeToStdout } from 'src/utils/process.js'
import { getInitialSettings } from 'src/utils/settings/settings.js'
import instances from '../ink/instances.js'
import { EXIT_ALT_SCREEN } from '../ink/termio/dec.js'

export async function update() {
  // claude update runs as a subcommand inside an interactive Ink session.
  // Ink uses the alternate screen, so all writeToStdout calls would land
  // there and be lost when gracefulShutdown exits alt-screen. Switch to
  // the main buffer before writing and detach Ink so unmount() doesn't
  // overwrite the output with a final render.
  instances.get(process.stdout)?.detachForShutdown()
  writeToStdout(EXIT_ALT_SCREEN)

  logEvent('tengu_update_check', {})
  writeToStdout(`Current version: ${MACRO.VERSION}\n`)

  const channel = getInitialSettings()?.autoUpdatesChannel ?? 'latest'
  writeToStdout(`Checking for updates to ${channel} version...\n`)

  logForDebugging('update: Starting update check')

  // Run diagnostic to detect potential issues
  logForDebugging('update: Running diagnostic')
  const diagnostic = await getDoctorDiagnostic()
  logForDebugging(`update: Installation type: ${diagnostic.installationType}`)
  logForDebugging(
    `update: Config install method: ${diagnostic.configInstallMethod}`,
  )

  // Check for multiple installations
  if (diagnostic.multipleInstallations.length > 1) {
    writeToStdout('\n')
    writeToStdout(chalk.yellow('Warning: Multiple installations found') + '\n')
    for (const install of diagnostic.multipleInstallations) {
      const current =
        diagnostic.installationType === install.type
          ? ' (currently running)'
          : ''
      writeToStdout(`- ${install.type} at ${install.path}${current}\n`)
    }
  }

  // Display warnings if any exist
  if (diagnostic.warnings.length > 0) {
    writeToStdout('\n')
    for (const warning of diagnostic.warnings) {
      logForDebugging(`update: Warning detected: ${warning.issue}`)

      // Don't skip PATH warnings - they're always relevant
      // The user needs to know that 'which claude' points elsewhere
      logForDebugging(`update: Showing warning: ${warning.issue}`)

      writeToStdout(chalk.yellow(`Warning: ${warning.issue}\n`))

      writeToStdout(chalk.bold(`Fix: ${warning.fix}\n`))
    }
  }

  // Git-based update for this Node.js port
  logForDebugging('update: Checking GitHub for latest commit')
  const latestCommitId = await getLatestCommitId(channel)
  logForDebugging(
    `update: Latest commit from GitHub: ${latestCommitId || 'FAILED'}`,
  )

  if (!latestCommitId) {
    process.stderr.write(chalk.red('Failed to check for updates') + '\n')
    process.stderr.write('Unable to fetch latest commit from GitHub\n')
    process.stderr.write('\n')
    process.stderr.write('Possible causes:\n')
    process.stderr.write('  • Network connectivity issues\n')
    process.stderr.write('  • GitHub API is unreachable\n')
    process.stderr.write('\n')
    process.stderr.write('Try:\n')
    process.stderr.write('  • Check your internet connection\n')
    process.stderr.write('  • Run with --debug flag for more details\n')
    await gracefulShutdown(1)
  }

  // Determine current commit id
  let currentCommitId = MACRO.COMMIT_ID
  if (!currentCommitId) {
    const scriptDir = dirname(process.argv[1] || process.cwd())
    const repoRoot = findGitRoot(scriptDir) || findGitRoot(process.cwd())
    if (repoRoot) {
      const result = await execFileNoThrowWithCwd(
        'git',
        ['rev-parse', 'HEAD'],
        { cwd: repoRoot },
      )
      if (result.code === 0) {
        currentCommitId = result.stdout.trim()
      }
    }
  }

  if (!currentCommitId) {
    process.stderr.write(chalk.red('Failed to determine current commit') + '\n')
    process.stderr.write('Are you running from a git repository?\n')
    await gracefulShutdown(1)
  }

  if (latestCommitId === currentCommitId) {
    writeToStdout(
      chalk.green(
        `CC Node is up to date (commit ${currentCommitId!.slice(0, 7)})`,
      ) + '\n',
    )
    await gracefulShutdown(0)
  }

  writeToStdout(
    `New commit available: ${latestCommitId!.slice(0, 7)} (current: ${currentCommitId!.slice(0, 7)})\n`,
  )
  writeToStdout('Pulling latest changes and rebuilding...\n')

  const scriptDir = dirname(process.argv[1] || process.cwd())
  const repoRoot = findGitRoot(scriptDir) || findGitRoot(process.cwd())

  if (!repoRoot) {
    process.stderr.write(
      chalk.red('Error: Cannot find git repository root') + '\n',
    )
    await gracefulShutdown(1)
  }

  const pullResult = await execFileNoThrowWithCwd('git', ['pull'], {
    cwd: repoRoot!,
    stdio: 'inherit',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  })

  if (pullResult.code !== 0) {
    process.stderr.write(chalk.red('Error: git pull failed') + '\n')
    process.stderr.write('Please resolve any conflicts and try again.\n')
    await gracefulShutdown(1)
  }

  const installResult = await execFileNoThrowWithCwd('npm', ['install'], {
    cwd: repoRoot!,
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      npm_config_color: 'always',
    },
  })

  if (installResult.code !== 0) {
    process.stderr.write(chalk.red('Error: npm install failed') + '\n')
    await gracefulShutdown(1)
  }

  const buildResult = await execFileNoThrowWithCwd('npm', ['run', 'build'], {
    cwd: repoRoot!,
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      npm_config_color: 'always',
    },
  })

  if (buildResult.code !== 0) {
    process.stderr.write(chalk.red('Error: npm run build failed') + '\n')
    await gracefulShutdown(1)
  }

  writeToStdout(
    chalk.green(
      `Successfully updated to commit ${latestCommitId!.slice(0, 7)}`,
    ) + '\n',
  )
  await regenerateCompletionCache()
  await gracefulShutdown(0)
}
