import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { env } from '../../utils/env.js'

export type ClawdPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right'

type Props = {
  pose?: ClawdPose
}

type Segments = {
  r1: string
  r2: string
  r3: string
}

const POSES: Record<ClawdPose, Segments> = {
  default: {
    r1: '███████',
    r2: '█▙███▟█',
    r3: '███████',
  },
  'look-left': {
    r1: '███████',
    r2: '█▛███▛█',
    r3: '███████',
  },
  'look-right': {
    r1: '███████',
    r2: '█▜███▜█',
    r3: '███████',
  },
  'arms-up': {
    r1: '███████',
    r2: '█▙███▟█',
    r3: '███████',
  },
}

const APPLE_EYES: Record<ClawdPose, string> = {
  default: ' ▗   ▖ ',
  'look-left': ' ▘   ▘ ',
  'look-right': ' ▝   ▝ ',
  'arms-up': ' ▗   ▖ ',
}

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  if (env.terminal === 'Apple_Terminal') {
    return <AppleTerminalClawd pose={pose} />
  }
  const p = POSES[pose]
  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="clawd_body" backgroundColor="clawd_background">
        {p.r1}
      </Text>
      <Text color="clawd_body" backgroundColor="clawd_background">
        {p.r2}
      </Text>
      <Text color="clawd_body" backgroundColor="clawd_background">
        {p.r3}
      </Text>
    </Box>
  )
}

function AppleTerminalClawd({ pose }: { pose: ClawdPose }): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center">
      <Text backgroundColor="clawd_body">{' '.repeat(9)}</Text>
      <Text>
        <Text color="clawd_body">▗</Text>
        <Text color="clawd_background" backgroundColor="clawd_body">
          {APPLE_EYES[pose]}
        </Text>
        <Text color="clawd_body">▖</Text>
      </Text>
      <Text color="clawd_body">{'  ▘▘ ▝▝  '}</Text>
    </Box>
  )
}
