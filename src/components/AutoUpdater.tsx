import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { useInterval } from 'usehooks-ts'
import { dirname } from 'path'
import { useUpdateNotification } from '../hooks/useUpdateNotification.ts'
import { Box, Text } from '../ink.ts'
import {
  type AutoUpdaterResult,
  getLatestCommitId,
  type InstallStatus,
} from '../utils/autoUpdater.ts'
import { regenerateCompletionCache } from '../utils/completionCache.ts'
import { getGlobalConfig, isAutoUpdaterDisabled } from '../utils/config.ts'
import { logForDebugging } from '../utils/debug.ts'
import { execFileNoThrowWithCwd } from '../utils/execFileNoThrow.ts'
import { findGitRoot } from '../utils/git.ts'
import { getInitialSettings } from '../utils/settings/settings.ts'

type Props = {
  isUpdating: boolean
  onChangeIsUpdating: (isUpdating: boolean) => void
  onAutoUpdaterResult: (autoUpdaterResult: AutoUpdaterResult) => void
  autoUpdaterResult: AutoUpdaterResult | null
  showSuccessMessage: boolean
  verbose: boolean
}

export function AutoUpdater({
  isUpdating,
  onChangeIsUpdating,
  onAutoUpdaterResult,
  autoUpdaterResult,
  showSuccessMessage,
  verbose,
}: Props): React.ReactNode {
  const [commits, setCommits] = useState<{
    current?: string | null
    latest?: string | null
  }>({})
  const updateSemver = useUpdateNotification(autoUpdaterResult?.version)

  // Track latest isUpdating value in a ref so the memoized checkForUpdates
  // callback always sees the current value.
  const isUpdatingRef = useRef(isUpdating)
  isUpdatingRef.current = isUpdating

  const checkForUpdates = React.useCallback(async () => {
    if (isUpdatingRef.current) {
      return
    }
    if ("production" === 'test' || "production" === 'development') {
      logForDebugging('AutoUpdater: Skipping update check in test/dev environment')
      return
    }

    const currentCommit = MACRO.COMMIT_ID
    const channel = getInitialSettings()?.autoUpdatesChannel ?? 'latest'
    const latestCommit = await getLatestCommitId(channel)
    const isDisabled = isAutoUpdaterDisabled()

    setCommits({ current: currentCommit, latest: latestCommit })

    if (
      !isDisabled &&
      currentCommit &&
      latestCommit &&
      currentCommit !== latestCommit
    ) {
      const startTime = Date.now()
      onChangeIsUpdating(true)

      const scriptDir = dirname(process.argv[1] || process.cwd())
      const repoRoot = findGitRoot(scriptDir) || findGitRoot(process.cwd())

      if (!repoRoot) {
        logForDebugging('AutoUpdater: Could not find git repository root')
        onChangeIsUpdating(false)
        onAutoUpdaterResult({
          version: latestCommit,
          status: 'install_failed',
        })
        return
      }

      // 1. git pull
      const pullResult = await execFileNoThrowWithCwd('git', ['pull'], {
        cwd: repoRoot,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      })
      if (pullResult.code !== 0) {
        logForDebugging(`AutoUpdater: git pull failed: ${pullResult.stderr}`)
        onChangeIsUpdating(false)
        onAutoUpdaterResult({
          version: latestCommit,
          status: 'install_failed',
        })
        return
      }

      // 2. npm install
      const installResult = await execFileNoThrowWithCwd('npm', ['install'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
          npm_config_color: 'always',
        },
      })
      if (installResult.code !== 0) {
        logForDebugging(
          `AutoUpdater: npm install failed: ${installResult.stderr}`,
        )
        onChangeIsUpdating(false)
        onAutoUpdaterResult({
          version: latestCommit,
          status: 'install_failed',
        })
        return
      }

      // 3. npm run build
      const buildResult = await execFileNoThrowWithCwd(
        'npm',
        ['run', 'build'],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            FORCE_COLOR: '1',
            npm_config_color: 'always',
          },
        },
      )
      if (buildResult.code !== 0) {
        logForDebugging(
          `AutoUpdater: npm run build failed: ${buildResult.stderr}`,
        )
        onChangeIsUpdating(false)
        onAutoUpdaterResult({
          version: latestCommit,
          status: 'install_failed',
        })
        return
      }

      // 4. Clean up caches
      try {
        await regenerateCompletionCache()
      } catch (e) {
        logForDebugging(
          `AutoUpdater: regenerateCompletionCache failed: ${e}`,
        )
      }

      onChangeIsUpdating(false)
      logEvent('tengu_auto_updater_success', {
        fromVersion:
          currentCommit as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        toVersion:
          latestCommit as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        durationMs: Date.now() - startTime,
        wasMigrated: false,
        installationType: 'git' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      onAutoUpdaterResult({ version: latestCommit, status: 'success' })
    }
    // isUpdating intentionally omitted from deps; we read isUpdatingRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAutoUpdaterResult, onChangeIsUpdating])

  // Initial check
  useEffect(() => {
    void checkForUpdates()
  }, [checkForUpdates])

  // Check every 30 minutes
  useInterval(checkForUpdates, 30 * 60 * 1000)

  if (!autoUpdaterResult?.version && (!commits.current || !commits.latest)) {
    return null
  }
  if (!autoUpdaterResult?.version && !isUpdating) {
    return null
  }

  return (
    <Box flexDirection="row" gap={1}>
      {verbose && (
        <Text dimColor wrap="truncate">
          currentCommit: {commits.current?.slice(0, 7)} · latestCommit:{' '}
          {commits.latest?.slice(0, 7)}
        </Text>
      )}
      {isUpdating ? (
        <Box>
          <Text color="text" dimColor wrap="truncate">
            Auto-updating…
          </Text>
        </Box>
      ) : (
        autoUpdaterResult?.status === 'success' &&
        showSuccessMessage &&
        updateSemver && (
          <Text color="success" wrap="truncate">
            ✓ Update installed · Restart to apply
          </Text>
        )
      )}
      {(autoUpdaterResult?.status === 'install_failed' ||
        autoUpdaterResult?.status === 'no_permissions') && (
        <Text color="error" wrap="truncate">
          ✗ Auto-update failed · Try <Text bold>claude update</Text>
        </Text>
      )}
    </Box>
  )
}
