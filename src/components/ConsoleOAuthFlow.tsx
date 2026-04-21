import React, { useEffect } from 'react'
import { Box, Text } from '../ink.ts'

// OAuth removed in the Node.js port — stub for build compatibility
export function ConsoleOAuthFlow({ onDone }: { onDone?: () => void; mode?: string; startingMessage?: string; forceLoginMethod?: string }): React.ReactNode {
  useEffect(() => {
    onDone?.()
  }, [onDone])
  return (
    <Box flexDirection="column">
      <Text color="warning">OAuth login is not available in this build.</Text>
      <Text>Set ANTHROPIC_API_KEY environment variable instead.</Text>
    </Box>
  )
}
