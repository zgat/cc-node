import type { Command } from '../../commands.ts'
import { isPolicyAllowed } from '../../services/policyLimits/index.ts'
import { isEnvTruthy } from '../../utils/envUtils.ts'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.ts'

const feedback = {
  aliases: ['bug'],
  type: 'local-jsx',
  name: 'feedback',
  description: `Submit feedback about CC Node`,
  argumentHint: '[report]',
  isEnabled: () =>
    !(
      isEnvTruthy(process.env.DISABLE_FEEDBACK_COMMAND) ||
      isEnvTruthy(process.env.DISABLE_BUG_COMMAND) ||
      isEssentialTrafficOnly() ||
      process.env.USER_TYPE === 'ant' ||
      !isPolicyAllowed('allow_product_feedback')
    ),
  load: () => import('./feedback.tsx'),
} satisfies Command

export default feedback
