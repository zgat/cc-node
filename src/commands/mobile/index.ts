import type { Command } from '../../commands.ts'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: 'Show QR code to download the CC Node mobile app',
  load: () => import('./mobile.tsx'),
} satisfies Command

export default mobile
