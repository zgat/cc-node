import type { Command } from '../../commands.ts'

const stickers = {
  type: 'local',
  name: 'stickers',
  description: 'Order CC Node stickers',
  supportsNonInteractive: false,
  load: () => import('./stickers.ts'),
} satisfies Command

export default stickers
