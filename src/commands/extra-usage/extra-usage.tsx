import React from 'react';
import type { LocalJSXCommandContext } from '../../commands.ts';
import type { LocalJSXCommandOnDone } from '../../types/command.ts';
import { runExtraUsage } from './extra-usage-core.ts';
export async function call(onDone: LocalJSXCommandOnDone, _context: LocalJSXCommandContext): Promise<React.ReactNode | null> {
  const result = await runExtraUsage();
  if (result.type === 'message') {
    onDone(result.value);
    return null;
  }
  // Login removed — just show a message
  onDone('OAuth login is not available in this build. Use ANTHROPIC_API_KEY instead.');
  return null;
}
