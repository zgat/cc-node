import { getIsNonInteractiveSession } from '../../bootstrap/state.ts'
import type { Command } from '../../commands.ts'

const command: Command = {
  name: 'chrome',
  description: 'CC Node in Chrome (Beta) settings',
  availability: ['claude-ai'],
  isEnabled: () => !getIsNonInteractiveSession(),
  type: 'local-jsx',
  load: () => import('./chrome.tsx'),
}

export default command
