import type { WebSocket } from 'ws'

// ---------------------------------------------------------------------------
// Bridge Protocol Types (mirrors CCNode src/bridge/types.ts)
// ---------------------------------------------------------------------------

export type WorkData = {
  type: 'session' | 'healthcheck'
  id: string
}

export type WorkResponse = {
  id: string
  type: 'work'
  environment_id: string
  state: string
  data: WorkData
  secret: string // base64url-encoded JSON WorkSecret
  created_at: string
}

export type WorkSecret = {
  version: number
  session_ingress_token: string
  api_base_url: string
  sources: Array<{
    type: string
    git_info?: { type: string; repo: string; ref?: string; token?: string }
  }>
  auth: Array<{ type: string; token: string }>
  claude_code_args?: Record<string, string> | null
  mcp_config?: unknown | null
  environment_variables?: Record<string, string> | null
  use_code_sessions?: boolean
}

export type Environment = {
  id: string
  secret: string
  machineName: string
  directory: string
  branch: string
  gitRepoUrl: string | null
  maxSessions: number
  metadata?: { worker_type?: string }
  registeredAt: number
  lastSeenAt: number
}

export type WorkItem = {
  id: string
  environmentId: string
  type: 'session' | 'healthcheck'
  state: 'pending' | 'acknowledged' | 'running' | 'completed' | 'stopped'
  dataId: string // sessionId or healthcheck id
  secret: string
  createdAt: number
  acknowledgedAt?: number
  completedAt?: number
  leaseExtendedAt?: number
}

export type Session = {
  id: string
  environmentId: string
  title: string
  state: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted' | 'archived'
  createdAt: number
  updatedAt: number
  archivedAt?: number
  messages: SDKMessage[]
  pendingPermissions: PermissionRequest[]
  activities: SessionActivity[]
  // WebSocket connections
  ccnodeWs?: WebSocket  // connection from the CCNode child process
  frontendWs?: Set<WebSocket>  // connections from web UI clients
}

export type SessionActivity = {
  type: 'tool_start' | 'text' | 'result' | 'error'
  summary: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// SDK Message Types (mirrors CCNode protocol)
// ---------------------------------------------------------------------------

export type SDKMessage =
  | SDKUserMessage
  | SDKAssistantMessage
  | SDKSystemMessage

export type SDKUserMessage = {
  type: 'user'
  uuid: string
  message: {
    role: 'user'
    content: Array<{ type: 'text'; text: string } | SDKToolResultBlock>
  }
  timestamp: string
}

export type SDKAssistantMessage = {
  type: 'assistant'
  uuid: string
  message: {
    role: 'assistant'
    content: Array<
      | { type: 'text'; text: string }
      | SDKToolUseBlock
      | { type: 'thinking'; thinking: string }
    >
  }
  timestamp: string
  usage?: SDKUsage
}

export type SDKSystemMessage = {
  type: 'system'
  subtype: 'local_command' | string
  content: string
  timestamp: string
}

export type SDKToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type SDKToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string } | { type: 'image' }>
}

export type SDKUsage = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// ---------------------------------------------------------------------------
// Control Messages (permissions)
// ---------------------------------------------------------------------------

export type PermissionRequest = {
  type: 'control_request'
  request_id: string
  request: {
    subtype: 'can_use_tool'
    tool_name: string
    input: Record<string, unknown>
    tool_use_id: string
  }
}

export type PermissionResponseEvent = {
  type: 'control_response'
  response: {
    subtype: 'success'
    request_id: string
    response: Record<string, unknown>
  }
}

export type SDKControlRequest = {
  type: 'control_request'
  request_id: string
  request: {
    subtype: 'initialize' | 'set_model' | 'set_max_thinking_tokens' | 'set_permission_mode' | 'can_use_tool' | 'interrupt'
    [key: string]: unknown
  }
}

export type SDKControlResponse = {
  type: 'control_response'
  request_id: string
  response: {
    subtype: 'success' | 'error'
    [key: string]: unknown
  }
}

// ---------------------------------------------------------------------------
// API Request/Response Types
// ---------------------------------------------------------------------------

export type RegisterEnvBody = {
  machine_name: string
  directory: string
  branch: string
  git_repo_url?: string | null
  max_sessions?: number
  metadata?: { worker_type?: string }
  environment_id?: string // reuse on reconnect
}

export type HeartbeatResponse = {
  lease_extended: boolean
  state: string
  last_heartbeat?: string
  ttl_seconds?: number
}
