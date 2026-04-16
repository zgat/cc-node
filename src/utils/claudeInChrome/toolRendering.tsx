import * as React from 'react';
import { MessageResponse } from '../../components/MessageResponse.tsx';
import { supportsHyperlinks } from '../../ink/supports-hyperlinks.ts';
import { Link, Text } from '../../ink.ts';
import { renderToolResultMessage as renderDefaultMCPToolResultMessage } from '../../tools/MCPTool/UI.tsx';
import type { MCPToolResult } from '../../utils/mcpValidation.ts';
import { truncateToWidth } from '../format.ts';
import { trackClaudeInChromeTabId } from './common.ts';
export type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * All tool names from BROWSER_TOOLS in @ant/claude-for-chrome-mcp.
 * Keep in sync with the package's BROWSER_TOOLS array (chrome-devtools-mcp).
 */
export type ChromeToolName =
  | 'navigate_page'
  | 'click'
  | 'fill'
  | 'fill_form'
  | 'hover'
  | 'press_key'
  | 'upload_file'
  | 'handle_dialog'
  | 'drag'
  | 'new_page'
  | 'close_page'
  | 'list_pages'
  | 'select_page'
  | 'wait_for'
  | 'evaluate_script'
  | 'list_console_messages'
  | 'get_console_message'
  | 'take_screenshot'
  | 'take_snapshot'
  | 'list_network_requests'
  | 'get_network_request'
  | 'performance_start_trace'
  | 'performance_stop_trace'
  | 'performance_analyze_insight';

const CHROME_EXTENSION_FOCUS_TAB_URL_BASE = 'https://clau.de/chrome/tab/';

function renderChromeToolUseMessage(
  input: Record<string, unknown>,
  toolName: ChromeToolName,
  verbose: boolean,
): React.ReactNode {
  const tabId = input.tabId;
  if (typeof tabId === 'number') {
    trackClaudeInChromeTabId(tabId);
  }

  const secondaryInfo: string[] = [];
  switch (toolName) {
    case 'navigate_page':
      if (typeof input.url === 'string') {
        try {
          const url = new URL(input.url);
          secondaryInfo.push(url.hostname);
        } catch {
          secondaryInfo.push(truncateToWidth(input.url, 30));
        }
      }
      break;
    case 'click':
      if (typeof input.selector === 'string') {
        secondaryInfo.push(`selector: ${truncateToWidth(input.selector, 30)}`);
      }
      break;
    case 'fill':
      if (typeof input.value === 'string') {
        secondaryInfo.push(`fill "${truncateToWidth(input.value, 15)}"`);
      }
      break;
    case 'fill_form':
      if (typeof input.fields === 'object' && input.fields !== null) {
        secondaryInfo.push('form filled');
      }
      break;
    case 'hover':
      if (typeof input.selector === 'string') {
        secondaryInfo.push(`hover ${truncateToWidth(input.selector, 20)}`);
      }
      break;
    case 'press_key':
      if (typeof input.key === 'string') {
        secondaryInfo.push(`key ${input.key}`);
      }
      break;
    case 'upload_file':
      if (typeof input.filePath === 'string') {
        secondaryInfo.push(`upload ${truncateToWidth(input.filePath, 20)}`);
      }
      break;
    case 'handle_dialog':
      if (typeof input.accept === 'boolean') {
        secondaryInfo.push(input.accept ? 'accept dialog' : 'dismiss dialog');
      }
      break;
    case 'drag':
      secondaryInfo.push('drag');
      break;
    case 'new_page':
      if (typeof input.url === 'string') {
        try {
          const url = new URL(input.url);
          secondaryInfo.push(url.hostname);
        } catch {
          secondaryInfo.push(truncateToWidth(input.url, 30));
        }
      }
      break;
    case 'close_page':
      secondaryInfo.push('close page');
      break;
    case 'list_pages':
      secondaryInfo.push('list pages');
      break;
    case 'select_page':
      secondaryInfo.push('select page');
      break;
    case 'wait_for':
      if (typeof input.timeout === 'number') {
        secondaryInfo.push(`wait ${input.timeout}s`);
      }
      break;
    case 'evaluate_script':
      if (verbose && typeof input.script === 'string') {
        return input.script;
      }
      return '';
    case 'list_console_messages':
      secondaryInfo.push('console messages');
      break;
    case 'get_console_message':
      secondaryInfo.push('console message');
      break;
    case 'take_screenshot':
      secondaryInfo.push('screenshot');
      break;
    case 'take_snapshot':
      secondaryInfo.push('snapshot');
      break;
    case 'list_network_requests':
      secondaryInfo.push('network requests');
      break;
    case 'get_network_request':
      secondaryInfo.push('network request');
      break;
    case 'performance_start_trace':
      secondaryInfo.push('start trace');
      break;
    case 'performance_stop_trace':
      secondaryInfo.push('stop trace');
      break;
    case 'performance_analyze_insight':
      secondaryInfo.push('analyze insight');
      break;
  }
  return secondaryInfo.join(', ') || null;
}

function renderChromeViewTabLink(input: unknown): React.ReactNode {
  if (!supportsHyperlinks()) {
    return null;
  }
  if (typeof input !== 'object' || input === null || !('tabId' in input)) {
    return null;
  }
  const tabId = typeof input.tabId === 'number' ? input.tabId : typeof input.tabId === 'string' ? parseInt(input.tabId, 10) : NaN;
  if (isNaN(tabId)) {
    return null;
  }
  const linkUrl = `${CHROME_EXTENSION_FOCUS_TAB_URL_BASE}${tabId}`;
  return <Text>
      {' '}
      <Link url={linkUrl}>
        <Text color="subtle">[View Tab]</Text>
      </Link>
    </Text>;
}

export function renderChromeToolResultMessage(
  output: MCPToolResult,
  toolName: ChromeToolName,
  verbose: boolean,
): React.ReactNode {
  if (verbose) {
    return renderDefaultMCPToolResultMessage(output, [], {
      verbose
    });
  }
  let summary: string | null = null;
  switch (toolName) {
    case 'navigate_page':
      summary = 'Navigation completed';
      break;
    case 'click':
      summary = 'Clicked';
      break;
    case 'fill':
      summary = 'Filled';
      break;
    case 'fill_form':
      summary = 'Form filled';
      break;
    case 'hover':
      summary = 'Hovered';
      break;
    case 'press_key':
      summary = 'Key pressed';
      break;
    case 'upload_file':
      summary = 'File uploaded';
      break;
    case 'handle_dialog':
      summary = 'Dialog handled';
      break;
    case 'drag':
      summary = 'Drag completed';
      break;
    case 'new_page':
      summary = 'Page created';
      break;
    case 'close_page':
      summary = 'Page closed';
      break;
    case 'list_pages':
      summary = 'Pages listed';
      break;
    case 'select_page':
      summary = 'Page selected';
      break;
    case 'wait_for':
      summary = 'Wait completed';
      break;
    case 'evaluate_script':
      summary = 'Script executed';
      break;
    case 'list_console_messages':
      summary = 'Console messages retrieved';
      break;
    case 'get_console_message':
      summary = 'Console message retrieved';
      break;
    case 'take_screenshot':
      summary = 'Screenshot captured';
      break;
    case 'take_snapshot':
      summary = 'Snapshot captured';
      break;
    case 'list_network_requests':
      summary = 'Network requests retrieved';
      break;
    case 'get_network_request':
      summary = 'Network request retrieved';
      break;
    case 'performance_start_trace':
      summary = 'Performance trace started';
      break;
    case 'performance_stop_trace':
      summary = 'Performance trace stopped';
      break;
    case 'performance_analyze_insight':
      summary = 'Performance insight analyzed';
      break;
  }
  if (summary) {
    return <MessageResponse height={1}>
        <Text dimColor>{summary}</Text>
      </MessageResponse>;
  }
  return null;
}

export function getClaudeInChromeMCPToolOverrides(toolName: string): {
  userFacingName: (input?: Record<string, unknown>) => string;
  renderToolUseMessage: (input: Record<string, unknown>, options: {
    verbose: boolean;
  }) => React.ReactNode;
  renderToolUseTag: (input: Partial<Record<string, unknown>>) => React.ReactNode;
  renderToolResultMessage: (output: string | MCPToolResult, progressMessagesForMessage: unknown[], options: {
    verbose: boolean;
  }) => React.ReactNode;
} {
  return {
    userFacingName(_input?: Record<string, unknown>) {
      return `Claude in Chrome[${toolName}]`;
    },
    renderToolUseMessage(input: Record<string, unknown>, {
      verbose
    }: {
      verbose: boolean;
    }): React.ReactNode {
      return renderChromeToolUseMessage(input, toolName as ChromeToolName, verbose);
    },
    renderToolUseTag(input: Partial<Record<string, unknown>>): React.ReactNode {
      return renderChromeViewTabLink(input);
    },
    renderToolResultMessage(output: string | MCPToolResult, _progressMessagesForMessage: unknown[], {
      verbose
    }: {
      verbose: boolean;
    }): React.ReactNode {
      if (!isMCPToolResult(output)) {
        return null;
      }
      return renderChromeToolResultMessage(output, toolName as ChromeToolName, verbose);
    }
  };
}

function isMCPToolResult(output: string | MCPToolResult): output is MCPToolResult {
  return typeof output === 'object' && output !== null;
}
