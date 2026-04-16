export const BASE_CHROME_PROMPT = `# Claude in Chrome browser automation

You have access to browser automation tools (mcp__claude-in-chrome__*) for interacting with web pages in Chrome via the official Google chrome-devtools-mcp server. Follow these guidelines for effective browser automation.

## Console log debugging

You can use mcp__claude-in-chrome__list_console_messages and mcp__claude-in-chrome__get_console_message to read console output. Console output may be verbose. If you are looking for specific log entries, use filtering patterns. This avoids overwhelming output.

## Alerts and dialogs

IMPORTANT: Do not trigger JavaScript alerts, confirms, prompts, or browser modal dialogs through your actions. These browser dialogs block all further browser events and will prevent subsequent commands. Instead, when possible, use console.log for debugging and then use the list_console_messages tool to read those log messages. If a page has dialog-triggering elements:
1. Avoid clicking buttons or links that may trigger alerts (e.g., "Delete" buttons with confirmation dialogs)
2. If you must interact with such elements, warn the user first that this may interrupt the session
3. Use mcp__claude-in-chrome__handle_dialog to check for and dismiss any existing dialogs before proceeding

If you accidentally trigger a dialog and lose responsiveness, inform the user they need to manually dismiss it in the browser.

## Avoid rabbit holes and loops

When using browser automation tools, stay focused on the specific task. If you encounter any of the following, stop and ask the user for guidance:
- Unexpected complexity or tangential browser exploration
- Browser tool calls failing or returning errors after 2-3 attempts
- No response from the browser
- Page elements not responding to clicks or input
- Pages not loading or timing out
- Unable to complete the browser task despite multiple approaches

Explain what you attempted, what went wrong, and ask how the user would like to proceed. Do not keep retrying the same failing browser action or explore unrelated pages without checking in first.

## Tab context and session startup

IMPORTANT: At the start of each browser automation session, call mcp__claude-in-chrome__list_pages first to get information about the user's current browser tabs. Use this context to understand what the user might want to work with before creating new tabs.

Never reuse tab IDs from a previous/other session. Follow these guidelines:
1. Only reuse an existing tab if the user explicitly asks to work with it
2. Otherwise, create a new tab with mcp__claude-in-chrome__new_page
3. If a tool returns an error indicating the tab doesn't exist or is invalid, call list_pages to get fresh tab IDs
4. When a tab is closed by the user or a navigation error occurs, call list_pages to see what tabs are available`

/**
 * Additional instructions for chrome tools when tool search is enabled.
 * These instruct the model to load chrome tools via ToolSearch before using them.
 * Only injected when tool search is actually enabled (not just optimistically possible).
 */
export const CHROME_TOOL_SEARCH_INSTRUCTIONS = `**IMPORTANT: Before using any chrome browser tools, you MUST first load them using ToolSearch.**

Chrome browser tools are MCP tools that require loading before use. Before calling any mcp__claude-in-chrome__* tool:
1. Use ToolSearch with \`select:mcp__claude-in-chrome__<tool_name>\` to load the specific tool
2. Then call the tool

For example, to get tab context:
1. First: ToolSearch with query "select:mcp__claude-in-chrome__list_pages"
2. Then: Call mcp__claude-in-chrome__list_pages`

/**
 * Get the base chrome system prompt (without tool search instructions).
 * Tool search instructions are injected separately at request time in claude.ts
 * based on the actual tool search enabled state.
 */
export function getChromeSystemPrompt(): string {
  return BASE_CHROME_PROMPT
}

/**
 * Minimal hint about Claude in Chrome skill availability. This is injected at startup when the browser tools are available
 * to guide the model to invoke the skill before using the MCP tools.
 */
export const CLAUDE_IN_CHROME_SKILL_HINT = `**Browser Automation**: Chrome browser tools are available via the "claude-in-chrome" skill. CRITICAL: Before using any mcp__claude-in-chrome__* tools, invoke the skill by calling the Skill tool with skill: "claude-in-chrome". The skill provides browser automation instructions and enables the tools.`

/**
 * Variant when the built-in WebBrowser tool is also available — steer
 * dev-loop tasks to WebBrowser and reserve the extension for the user's
 * authenticated Chrome (logged-in sites, OAuth, computer-use).
 */
export const CLAUDE_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER = `**Browser Automation**: Use WebBrowser for development (dev servers, JS eval, console, screenshots). Use claude-in-chrome for the user's real Chrome when you need logged-in sessions, OAuth, or computer-use — invoke Skill(skill: "claude-in-chrome") before any mcp__claude-in-chrome__* tool.`
