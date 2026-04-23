import type { WebSocket, WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import type { SDKMessage, PermissionRequest, SDKControlRequest, SDKControlResponse } from '../types.js'
import { getSession, setSession, addSessionMessage, addSessionPermission, resolveSessionPermission, addSessionActivity } from '../store.js'

export function setupIngressWSS(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const pathParts = url.pathname.split('/')

    // Parse sessionId from either:
    // /v1/session_ingress/ws/:sessionId/subscribe
    // /v2/session_ingress/ws/:sessionId
    let sessionId: string | undefined
    const wsIdx = pathParts.indexOf('ws')
    if (wsIdx >= 0 && pathParts[wsIdx + 1]) {
      sessionId = pathParts[wsIdx + 1]
    }

    if (!sessionId) {
      ws.close(4001, 'Missing sessionId in URL')
      return
    }

    const session = getSession(sessionId)
    if (!session) {
      // Auto-create session on first connect (CCNode may connect before we know about it)
      const newSession = {
        id: sessionId,
        environmentId: 'unknown',
        title: `Session ${sessionId.slice(0, 8)}`,
        state: 'running' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [] as SDKMessage[],
        pendingPermissions: [] as PermissionRequest[],
        activities: [] as { type: 'tool_start' | 'text' | 'result' | 'error'; summary: string; timestamp: number }[],
        frontendWs: new Set<WebSocket>(),
      }
      setSession(newSession)
    }

    const targetSession = getSession(sessionId)!
    targetSession.ccnodeWs = ws
    console.log(`[ws] CCNode connected to session ${sessionId}`)

    // Send auth acknowledgment (required by CCNode protocol)
    ws.send(JSON.stringify({ type: 'auth', status: 'ok' }))

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString()) as unknown
        handleCnodeMessage(sessionId, data)
      } catch (err) {
        console.error(`[ws] Invalid JSON from CCNode: ${err}`)
      }
    })

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[ws] CCNode disconnected from session ${sessionId}: ${code} ${reason.toString()}`)
      const s = getSession(sessionId)
      if (s) {
        s.ccnodeWs = undefined
        if (s.state === 'running') {
          s.state = 'interrupted'
        }
      }
    })

    ws.on('error', (err: Error) => {
      console.error(`[ws] CCNode error on session ${sessionId}:`, err.message)
    })
  })
}

function handleCnodeMessage(sessionId: string, data: unknown): void {
  const session = getSession(sessionId)
  if (!session) return

  if (!data || typeof data !== 'object' || !('type' in data)) {
    return
  }

  const msg = data as { type: string }

  switch (msg.type) {
    case 'user':
    case 'assistant':
    case 'system': {
      const sdkMsg = msg as SDKMessage
      addSessionMessage(sessionId, sdkMsg)
      broadcastToFrontend(session, { type: 'message', message: sdkMsg })

      // Extract activity for tool_use blocks
      if (sdkMsg.type === 'assistant' && 'message' in sdkMsg && Array.isArray(sdkMsg.message.content)) {
        for (const block of sdkMsg.message.content) {
          if (block.type === 'tool_use') {
            const summary = `${block.name}: ${JSON.stringify(block.input).slice(0, 80)}`
            addSessionActivity(sessionId, { type: 'tool_start', summary, timestamp: Date.now() })
            broadcastToFrontend(session, { type: 'activity', activity: { type: 'tool_start', summary, timestamp: Date.now() } })
          }
        }
      }
      break
    }

    case 'control_request': {
      const ctrl = msg as SDKControlRequest
      if (ctrl.request?.subtype === 'can_use_tool') {
        const permReq: PermissionRequest = {
          type: 'control_request',
          request_id: ctrl.request_id,
          request: {
            subtype: 'can_use_tool',
            tool_name: (ctrl.request.tool_name as string) ?? 'unknown',
            input: (ctrl.request.input as Record<string, unknown>) ?? {},
            tool_use_id: (ctrl.request.tool_use_id as string) ?? '',
          },
        }
        addSessionPermission(sessionId, permReq)
        broadcastToFrontend(session, { type: 'permission', permission: permReq })
      } else {
        // Forward other control requests to frontend
        broadcastToFrontend(session, { type: 'control_request', request: ctrl })
      }
      break
    }

    case 'control_response': {
      // CCNode sending a control_response — broadcast to frontend
      broadcastToFrontend(session, msg)
      break
    }

    default:
      // Unknown type — just broadcast raw to frontend
      broadcastToFrontend(session, msg)
  }
}

export function broadcastToFrontend(session: NonNullable<ReturnType<typeof getSession>>, payload: unknown): void {
  if (!session?.frontendWs) return
  const text = JSON.stringify(payload)
  for (const ws of session.frontendWs) {
    if (ws.readyState === 1) {
      ws.send(text)
    }
  }
}

// ---------------------------------------------------------------------------
// Frontend WSS — separate path for web UI clients
// ---------------------------------------------------------------------------

export function setupFrontendWSS(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const sessionId = url.searchParams.get('sessionId')

    if (!sessionId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing sessionId query param' }))
      ws.close(4001, 'Missing sessionId')
      return
    }

    const session = getSession(sessionId)
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }))
      ws.close(4004, 'Session not found')
      return
    }

    session.frontendWs.add(ws)
    console.log(`[ws] Frontend connected to session ${sessionId}`)

    // Send existing messages
    ws.send(JSON.stringify({ type: 'init', messages: session.messages, pendingPermissions: session.pendingPermissions }))

    ws.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString()) as unknown
        handleFrontendMessage(sessionId, ws, data)
      } catch (err) {
        console.error(`[ws] Invalid JSON from frontend: ${err}`)
      }
    })

    ws.on('close', () => {
      console.log(`[ws] Frontend disconnected from session ${sessionId}`)
      session.frontendWs.delete(ws)
    })

    ws.on('error', (err: Error) => {
      console.error(`[ws] Frontend error on session ${sessionId}:`, err.message)
      session.frontendWs.delete(ws)
    })
  })
}

function handleFrontendMessage(sessionId: string, _ws: WebSocket, data: unknown): void {
  const session = getSession(sessionId)
  if (!session) return

  if (!data || typeof data !== 'object') return
  const msg = data as { type: string }

  switch (msg.type) {
    case 'send_message': {
      const text = (msg as { text?: string }).text
      if (!text) return

      const sdkMsg: SDKMessage = {
        type: 'user',
        uuid: randomUUID(),
        message: { role: 'user', content: [{ type: 'text', text }] },
        timestamp: new Date().toISOString(),
      }

      addSessionMessage(sessionId, sdkMsg)
      if (session.ccnodeWs && session.ccnodeWs.readyState === 1) {
        session.ccnodeWs.send(JSON.stringify(sdkMsg))
      }
      broadcastToFrontend(session, { type: 'message', message: sdkMsg })
      break
    }

    case 'permission_response': {
      const resp = msg as {
        request_id: string
        decision: 'allow' | 'deny'
        feedback?: string
      }
      const controlResponse: SDKControlResponse = {
        type: 'control_response',
        request_id: resp.request_id,
        response: {
          subtype: 'success',
          behavior: resp.decision,
          ...(resp.feedback && { feedback: resp.feedback }),
        },
      }

      resolveSessionPermission(sessionId, resp.request_id)

      if (session.ccnodeWs && session.ccnodeWs.readyState === 1) {
        session.ccnodeWs.send(JSON.stringify(controlResponse))
      }
      broadcastToFrontend(session, { type: 'permission_resolved', request_id: resp.request_id, decision: resp.decision })
      break
    }

    case 'interrupt': {
      const interruptMsg = {
        type: 'control_request',
        request_id: randomUUID(),
        request: { subtype: 'interrupt' },
      }
      if (session.ccnodeWs && session.ccnodeWs.readyState === 1) {
        session.ccnodeWs.send(JSON.stringify(interruptMsg))
      }
      break
    }
  }
}
