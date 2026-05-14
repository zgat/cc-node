import type { Command } from '../../commands.ts'

const skipall: Command = {
  type: 'local-jsx',
  name: 'skipall',
  description: 'Bypass all permission prompts (-s mode)',
  load: () => import('./skipall.tsx'),
}

export default skipall
