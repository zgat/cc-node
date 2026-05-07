import type { Command } from '../../commands.ts'

const memory: Command = {
  type: 'local-jsx',
  name: 'memory',
  description: 'Edit CC Node memory files',
  load: () => import('./memory.tsx'),
}

export default memory
