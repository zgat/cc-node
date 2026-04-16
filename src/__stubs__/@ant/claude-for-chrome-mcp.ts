// Stub replacing @ant/claude-for-chrome-mcp with chrome-devtools-mcp tool names
// chrome-devtools-mcp is the official Google Chrome DevTools MCP server.
export const BROWSER_TOOLS = [
  { name: 'navigate_page' },
  { name: 'click' },
  { name: 'fill' },
  { name: 'fill_form' },
  { name: 'hover' },
  { name: 'press_key' },
  { name: 'upload_file' },
  { name: 'handle_dialog' },
  { name: 'drag' },
  { name: 'new_page' },
  { name: 'close_page' },
  { name: 'list_pages' },
  { name: 'select_page' },
  { name: 'wait_for' },
  { name: 'evaluate_script' },
  { name: 'list_console_messages' },
  { name: 'get_console_message' },
  { name: 'take_screenshot' },
  { name: 'take_snapshot' },
  { name: 'list_network_requests' },
  { name: 'get_network_request' },
  { name: 'performance_start_trace' },
  { name: 'performance_stop_trace' },
  { name: 'performance_analyze_insight' },
]

export const createClaudeForChromeMcpServer = () => ({})

export default {
  BROWSER_TOOLS,
  createClaudeForChromeMcpServer,
}
