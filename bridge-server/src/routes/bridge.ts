import { Router } from 'express'
import { randomUUID } from 'crypto'
import type { RegisterEnvBody, WorkSecret, WorkResponse } from '../types.js'
import {
  getEnvironment,
  setEnvironment,
  deleteEnvironment,
  setWorkItem,
  getWorkItem,
  notifyPoll,
  registerPoll,
  cancelPoll,
  listSessionsForEnv,
  getSession,
  setSession,
} from '../store.js'

const router = Router()
const POLL_TIMEOUT_MS = 30_000 // 30s long-polling

// ---------------------------------------------------------------------------
// POST /v1/environments/bridge
// Register a new bridge environment (machine)
// ---------------------------------------------------------------------------
router.post('/bridge', (req, res) => {
  const body = req.body as RegisterEnvBody

  // Reconnect path: if environment_id provided and exists, reuse
  if (body.environment_id) {
    const existing = getEnvironment(body.environment_id)
    if (existing) {
      existing.lastSeenAt = Date.now()
      res.status(200).json({
        environment_id: existing.id,
        environment_secret: existing.secret,
      })
      return
    }
  }

  const envId = randomUUID()
  const secret = randomUUID()

  setEnvironment({
    id: envId,
    secret,
    machineName: body.machine_name ?? 'unknown',
    directory: body.directory ?? '/',
    branch: body.branch ?? 'main',
    gitRepoUrl: body.git_repo_url ?? null,
    maxSessions: body.max_sessions ?? 4,
    metadata: body.metadata,
    registeredAt: Date.now(),
    lastSeenAt: Date.now(),
  })

  console.log(`[bridge] Environment registered: ${envId} (${body.machine_name})`)
  res.status(200).json({ environment_id: envId, environment_secret: secret })
})

// ---------------------------------------------------------------------------
// DELETE /v1/environments/bridge/:environmentId
// Deregister environment
// ---------------------------------------------------------------------------
router.delete('/bridge/:environmentId', (req, res) => {
  const envId = req.params.environmentId
  deleteEnvironment(envId)
  cancelPoll(envId)
  console.log(`[bridge] Environment deregistered: ${envId}`)
  res.status(204).send()
})

// ---------------------------------------------------------------------------
// GET /v1/environments/:environmentId/work/poll
// Long-polling for work. Blocks until work is available or timeout.
// ---------------------------------------------------------------------------
router.get('/:environmentId/work/poll', async (req, res) => {
  const envId = req.params.environmentId
  const env = getEnvironment(envId)
  if (!env) {
    res.status(404).json({ error: { type: 'not_found', message: 'Environment not found' } })
    return
  }

  env.lastSeenAt = Date.now()

  // Optional: reclaim work that hasn't been acked for a while
  const reclaimMs = req.query.reclaim_older_than_ms
    ? parseInt(req.query.reclaim_older_than_ms as string, 10)
    : undefined

  try {
    const work = await registerPoll(envId, POLL_TIMEOUT_MS)
    if (work) {
      const response: WorkResponse = {
        id: work.id,
        type: 'work',
        environment_id: work.environmentId,
        state: work.state,
        data: { type: work.type, id: work.dataId },
        secret: work.secret,
        created_at: new Date(work.createdAt).toISOString(),
      }
      res.status(200).json(response)
    } else {
      res.status(200).json(null)
    }
  } catch {
    res.status(200).json(null)
  }
})

// ---------------------------------------------------------------------------
// POST /v1/environments/:environmentId/work/:workId/ack
// Bridge acknowledges it received the work item
// ---------------------------------------------------------------------------
router.post('/:environmentId/work/:workId/ack', (req, res) => {
  const work = getWorkItem(req.params.workId)
  if (!work) {
    res.status(404).json({ error: { type: 'not_found', message: 'Work not found' } })
    return
  }
  work.state = 'acknowledged'
  work.acknowledgedAt = Date.now()

  // Update session state if this is a session work item
  const session = getSession(work.dataId)
  if (session) {
    session.state = 'running'
  }

  res.status(204).send()
})

// ---------------------------------------------------------------------------
// POST /v1/environments/:environmentId/work/:workId/heartbeat
// Keep the work lease alive
// ---------------------------------------------------------------------------
router.post('/:environmentId/work/:workId/heartbeat', (req, res) => {
  const work = getWorkItem(req.params.workId)
  if (!work) {
    res.status(404).json({ error: { type: 'not_found', message: 'Work not found' } })
    return
  }
  work.leaseExtendedAt = Date.now()
  res.status(200).json({
    lease_extended: true,
    state: work.state,
    last_heartbeat: new Date().toISOString(),
    ttl_seconds: 300,
  })
})

// ---------------------------------------------------------------------------
// POST /v1/environments/:environmentId/work/:workId/stop
// Stop a running work item
// ---------------------------------------------------------------------------
router.post('/:environmentId/work/:workId/stop', (req, res) => {
  const work = getWorkItem(req.params.workId)
  if (!work) {
    res.status(404).json({ error: { type: 'not_found', message: 'Work not found' } })
    return
  }
  work.state = 'stopped'

  const session = getSession(work.dataId)
  if (session) {
    session.state = 'interrupted'
  }

  res.status(204).send()
})

// ---------------------------------------------------------------------------
// POST /v1/environments/:environmentId/bridge/reconnect
// Force re-dispatch of a session to this environment
// ---------------------------------------------------------------------------
router.post('/:environmentId/bridge/reconnect', (req, res) => {
  const envId = req.params.environmentId
  const sessionId = (req.body as { session_id?: string }).session_id

  if (!sessionId) {
    res.status(400).json({ error: { type: 'bad_request', message: 'Missing session_id' } })
    return
  }

  const env = getEnvironment(envId)
  const session = getSession(sessionId)
  if (!env || !session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Environment or session not found' } })
    return
  }

  // Create a new work item to re-dispatch this session
  const workId = randomUUID()
  const secret: WorkSecret = {
    version: 1,
    session_ingress_token: sessionId,
    api_base_url: `${req.protocol}://${req.get('host')}`,
    sources: [],
    auth: [{ type: 'bearer', token: sessionId }],
    use_code_sessions: true,
  }

  setWorkItem({
    id: workId,
    environmentId: envId,
    type: 'session',
    state: 'pending',
    dataId: sessionId,
    secret: Buffer.from(JSON.stringify(secret)).toString('base64url'),
    createdAt: Date.now(),
  })

  notifyPoll(envId, getWorkItem(workId)!)
  console.log(`[bridge] Reconnecting session ${sessionId} to env ${envId}`)
  res.status(204).send()
})

export default router
