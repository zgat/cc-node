import { Router } from 'express'
import { randomUUID } from 'crypto'
import type { PermissionResponseEvent, SDKMessage, WorkSecret, WorkItem } from '../types.js'
import {
  getSession,
  setSession,
  addSessionMessage,
  resolveSessionPermission,
  listSessions,
  getWorkItem,
  setWorkItem,
  notifyPoll,
  getEnvironment,
} from '../store.js'

const router = Router()

// ---------------------------------------------------------------------------
// POST /v1/sessions/:sessionId/archive
// ---------------------------------------------------------------------------
router.post('/:sessionId/archive', (req, res) => {
  const session = getSession(req.params.sessionId)
  if (!session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Session not found' } })
    return
  }
  session.state = 'archived'
  session.archivedAt = Date.now()
  res.status(204).send()
})

// ---------------------------------------------------------------------------
// POST /v1/sessions/:sessionId/events
// Forward events (e.g. permission responses) to the session
// ---------------------------------------------------------------------------
router.post('/:sessionId/events', (req, res) => {
  const sessionId = req.params.sessionId
  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Session not found' } })
    return
  }

  const body = req.body as { events?: PermissionResponseEvent[] }
  if (!body.events || !Array.isArray(body.events)) {
    res.status(400).json({ error: { type: 'bad_request', message: 'Missing events array' } })
    return
  }

  for (const event of body.events) {
    // Forward to CCNode via its WebSocket
    if (session.ccnodeWs && session.ccnodeWs.readyState === 1) {
      session.ccnodeWs.send(JSON.stringify(event))
    }
  }

  res.status(204).send()
})

// ---------------------------------------------------------------------------
// GET /v1/sessions  (non-standard, for frontend)
// List all sessions
// ---------------------------------------------------------------------------
router.get('/', (_req, res) => {
  const all = listSessions().map((s) => ({
    id: s.id,
    environmentId: s.environmentId,
    title: s.title,
    state: s.state,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s.messages.length,
    pendingPermissions: s.pendingPermissions.length,
    activities: s.activities.slice(-5),
  }))
  res.json(all)
})

// ---------------------------------------------------------------------------
// GET /v1/sessions/:sessionId  (non-standard, for frontend)
// Get session details
// ---------------------------------------------------------------------------
router.get('/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId)
  if (!session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Session not found' } })
    return
  }
  res.json({
    id: session.id,
    environmentId: session.environmentId,
    title: session.title,
    state: session.state,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages,
    pendingPermissions: session.pendingPermissions,
    activities: session.activities,
  })
})

// ---------------------------------------------------------------------------
// POST /v1/sessions  (non-standard, for frontend)
// Create a new session -> dispatch to environment
// ---------------------------------------------------------------------------
router.post('/', (req, res) => {
  const body = req.body as {
    environmentId?: string
    title?: string
    prompt?: string
  }

  if (!body.environmentId) {
    res.status(400).json({ error: { type: 'bad_request', message: 'Missing environmentId' } })
    return
  }

  const env = getEnvironment(body.environmentId)
  if (!env) {
    res.status(404).json({ error: { type: 'not_found', message: 'Environment not found' } })
    return
  }

  const sessionId = randomUUID()
  const workId = randomUUID()
  const ingressUrl = `${req.protocol}://${req.get('host')}`

  const secret: WorkSecret = {
    version: 1,
    session_ingress_token: sessionId,
    api_base_url: ingressUrl,
    sources: [],
    auth: [{ type: 'bearer', token: sessionId }],
    claude_code_args: body.prompt ? { initial_prompt: body.prompt } : undefined,
    use_code_sessions: true,
  }

  const session = {
    id: sessionId,
    environmentId: body.environmentId,
    title: body.title || `Session ${sessionId.slice(0, 8)}`,
    state: 'pending' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [] as SDKMessage[],
    pendingPermissions: [],
    activities: [],
    frontendWs: new Set(),
  }

  const work: WorkItem = {
    id: workId,
    environmentId: body.environmentId,
    type: 'session',
    state: 'pending',
    dataId: sessionId,
    secret: Buffer.from(JSON.stringify(secret)).toString('base64url'),
    createdAt: Date.now(),
  }

  setSession(session)
  setWorkItem(work)

  // Wake up the bridge poll if it's waiting
  const notified = notifyPoll(body.environmentId, work)

  console.log(`[session] Created ${sessionId} on env ${body.environmentId}, poll-notified=${notified}`)
  res.status(201).json({ sessionId, workId, title: session.title })
})

// ---------------------------------------------------------------------------
// POST /v1/sessions/:sessionId/messages  (non-standard, for frontend)
// Send a user message to a running session
// ---------------------------------------------------------------------------
router.post('/:sessionId/messages', (req, res) => {
  const sessionId = req.params.sessionId
  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Session not found' } })
    return
  }

  const body = req.body as { text?: string }
  if (!body.text) {
    res.status(400).json({ error: { type: 'bad_request', message: 'Missing text' } })
    return
  }

  const msg: SDKMessage = {
    type: 'user',
    uuid: randomUUID(),
    message: {
      role: 'user',
      content: [{ type: 'text', text: body.text }],
    },
    timestamp: new Date().toISOString(),
  }

  addSessionMessage(sessionId, msg)

  // Forward to CCNode via WebSocket
  if (session.ccnodeWs && session.ccnodeWs.readyState === 1) {
    session.ccnodeWs.send(JSON.stringify(msg))
  }

  // Also broadcast to frontend clients
  for (const ws of session.frontendWs ?? []) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'message', message: msg }))
    }
  }

  res.status(204).send()
})

export default router
