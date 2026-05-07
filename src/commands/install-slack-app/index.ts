import type { Command } from '../../commands.ts'

const installSlackApp = {
  type: 'local',
  name: 'install-slack-app',
  description: 'Install the CC Node Slack app',
  availability: ['claude-ai'],
  supportsNonInteractive: false,
  load: () => import('./install-slack-app.ts'),
} satisfies Command

export default installSlackApp
