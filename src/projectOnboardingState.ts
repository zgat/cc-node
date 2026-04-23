import memoize from 'lodash-es/memoize.js'
import { join } from 'path'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from './utils/config.ts'
import { getCwd } from './utils/cwd.ts'
import { isDirEmpty } from './utils/file.ts'
import { getFsImplementation } from './utils/fsOperations.ts'

export type Step = {
  key: string
  text: string
  isComplete: boolean
  isCompletable: boolean
  isEnabled: boolean
}

export function getSteps(): Step[] {
  const fs = getFsImplementation()
  const cwd = getCwd()
  const hasCcnodeMd =
    fs.existsSync(join(cwd, 'ccnode.md')) ||
    fs.existsSync(join(cwd, 'CLAUDE.md')) ||
    fs.existsSync(join(cwd, '.ccnode.md')) ||
    fs.existsSync(join(cwd, '.CLAUDE.md')) ||
    fs.existsSync(join(cwd, '.claude', 'ccnode.md')) ||
    fs.existsSync(join(cwd, '.claude', 'CLAUDE.md'))
  const isWorkspaceDirEmpty = isDirEmpty(cwd)

  return [
    {
      key: 'workspace',
      text: 'Ask CC Node to create a new app or clone a repository',
      isComplete: false,
      isCompletable: true,
      isEnabled: isWorkspaceDirEmpty,
    },
    {
      key: 'claudemd',
      text: 'Run /init to create a ccnode.md file with instructions for CC Node',
      isComplete: hasCcnodeMd,
      isCompletable: true,
      isEnabled: !isWorkspaceDirEmpty,
    },
  ]
}

export function isProjectOnboardingComplete(): boolean {
  return getSteps()
    .filter(({ isCompletable, isEnabled }) => isCompletable && isEnabled)
    .every(({ isComplete }) => isComplete)
}

export function maybeMarkProjectOnboardingComplete(): void {
  // Short-circuit on cached config — isProjectOnboardingComplete() hits
  // the filesystem, and REPL.tsx calls this on every prompt submit.
  if (getCurrentProjectConfig().hasCompletedProjectOnboarding) {
    return
  }
  if (isProjectOnboardingComplete()) {
    saveCurrentProjectConfig(current => ({
      ...current,
      hasCompletedProjectOnboarding: true,
    }))
  }
}

export const shouldShowProjectOnboarding = memoize((): boolean => {
  const projectConfig = getCurrentProjectConfig()
  // Short-circuit on cached config before isProjectOnboardingComplete()
  // hits the filesystem — this runs during first render.
  if (
    projectConfig.hasCompletedProjectOnboarding ||
    projectConfig.projectOnboardingSeenCount >= 4 ||
    process.env.IS_DEMO
  ) {
    return false
  }

  return !isProjectOnboardingComplete()
})

export function incrementProjectOnboardingSeenCount(): void {
  saveCurrentProjectConfig(current => ({
    ...current,
    projectOnboardingSeenCount: current.projectOnboardingSeenCount + 1,
  }))
}
