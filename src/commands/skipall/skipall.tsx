import * as React from 'react';
import type { LocalJSXCommandContext } from '../../commands.ts';
import type { LocalJSXCommandOnDone } from '../../types/command.ts';
import { applyPermissionUpdate } from '../../utils/permissions/PermissionUpdate.ts';
import { transitionPermissionMode } from '../../utils/permissions/permissionSetup.ts';

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  const { getAppState, setAppState } = context;
  const appState = getAppState();
  const currentMode = appState.toolPermissionContext.mode;

  if (currentMode === 'bypassPermissions') {
    setAppState(prev => {
      const next = transitionPermissionMode(
        prev.toolPermissionContext.mode,
        'default',
        prev.toolPermissionContext,
      );
      return {
        ...prev,
        toolPermissionContext: applyPermissionUpdate(
          { ...next, mode: 'default' },
          { type: 'setMode', mode: 'default', destination: 'session' },
        ),
      };
    });
    onDone('Bypass permission mode disabled.');
    return null;
  }

  setAppState(prev => {
    const next = transitionPermissionMode(
      prev.toolPermissionContext.mode,
      'bypassPermissions',
      prev.toolPermissionContext,
    );
    return {
      ...prev,
      toolPermissionContext: applyPermissionUpdate(
        {
          ...next,
          mode: 'bypassPermissions',
          isBypassPermissionsModeAvailable: true,
        },
        {
          type: 'setMode',
          mode: 'bypassPermissions',
          destination: 'session',
        },
      ),
    };
  });

  onDone('Bypass permission mode enabled. /skipall again to disable.');
  return null;
}
