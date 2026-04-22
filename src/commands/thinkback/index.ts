import type { Command } from '../../commands.ts'
import { checkStatsigFeatureGate_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.ts'

const thinkback = {
  type: 'local-jsx',
  name: 'think-back',
  description: 'Your 2025 CC Node Year in Review',
  isEnabled: () =>
    checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_thinkback'),
  load: () => import('./thinkback.tsx'),
} satisfies Command

export default thinkback
