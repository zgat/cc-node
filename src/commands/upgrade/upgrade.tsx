import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.ts';
import type { LocalJSXCommandOnDone } from '../../types/command.ts';
export async function call(onDone: LocalJSXCommandOnDone, _context: LocalJSXCommandContext): Promise<React.ReactNode | null> {
  onDone('OAuth subscription management is not available in this build. Use ANTHROPIC_API_KEY instead.');
  return null;
}
