import { Router } from 'express'
import type { Request, Response } from 'express'
import { getSession } from '../store.js'

const router = Router()

// ---------------------------------------------------------------------------
// POST /v1/code/sessions/:sessionId/worker/register
// CCR v2 worker registration. Returns a worker_epoch.
// ---------------------------------------------------------------------------
router.post('/:sessionId/worker/register', (_req: Request, res: Response) => {
  // In a real deployment, worker_epoch prevents stale workers from
  // overwriting each other. For a self-hosted server, a simple counter
  // or timestamp is sufficient.
  const workerEpoch = Date.now()
  res.status(200).json({ worker_epoch: workerEpoch })
})

// ---------------------------------------------------------------------------
// POST /v1/code/sessions/:sessionId/worker/events
// CCR v2 worker events (heartbeat, state updates)
// ---------------------------------------------------------------------------
router.post('/:sessionId/worker/events', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId
  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Session not found' } })
    return
  }
  // Accept and ack worker events; actual processing is minimal in self-hosted mode
  res.status(200).json({ received: true })
})

// ---------------------------------------------------------------------------
// POST /v1/code/sessions/:sessionId/worker/heartbeat
// CCR v2 worker heartbeat
// ---------------------------------------------------------------------------
router.post('/:sessionId/worker/heartbeat', (req: Request, res: Response) => {
  const session = getSession(req.params.sessionId)
  if (!session) {
    res.status(404).json({ error: { type: 'not_found', message: 'Session not found' } })
    return
  }
  res.status(200).json({ ok: true })
})

export default router
