import type { Command } from '../../commands.ts'

const plan = {
  type: 'local-jsx',
  name: 'plan',
  description: 'Enable plan mode or view the current session plan',
  argumentHint: '[open|<description>]',
  load: () => import('./plan.tsx'),
} satisfies Command

export default plan
