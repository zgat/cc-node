import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import path from 'path'
import { fileURLToPath } from 'url'
import { authMiddleware, getAuthMode } from './middleware/auth.js'
import bridgeRoutes from './routes/bridge.js'
import sessionRoutes from './routes/sessions.js'
import ccrRoutes from './routes/ccr.js'
import { setupIngressWSS, setupFrontendWSS } from './ws/ingress.js'
import { listEnvironments, listSessions, getStats } from './store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = parseInt(process.env.PORT ?? '8080', 10)
const app = express()
const server = createServer(app)

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }))
app.use(authMiddleware)

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'frontend')))

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use('/v1/environments', bridgeRoutes)
app.use('/v1/sessions', sessionRoutes)
app.use('/v1/code/sessions', ccrRoutes)

// ---------------------------------------------------------------------------
// Dashboard API (for frontend)
// ---------------------------------------------------------------------------
app.get('/api/dashboard', (_req, res) => {
  res.json({
    environments: listEnvironments().map((e) => ({
      id: e.id,
      machineName: e.machineName,
      directory: e.directory,
      branch: e.branch,
      gitRepoUrl: e.gitRepoUrl,
      maxSessions: e.maxSessions,
      lastSeenAt: e.lastSeenAt,
    })),
    sessions: listSessions().map((s) => ({
      id: s.id,
      environmentId: s.environmentId,
      title: s.title,
      state: s.state,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      pendingPermissions: s.pendingPermissions.length,
    })),
    stats: getStats(),
  })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', authMode: getAuthMode(), stats: getStats() })
})

// ---------------------------------------------------------------------------
// WebSocket Servers
// ---------------------------------------------------------------------------
const ingressWSS = new WebSocketServer({
  server,
  path: '/v1/session_ingress/ws',
  // Allow any subpath after /ws (e.g. /ws/:sessionId/subscribe)
})

const ingressV2WSS = new WebSocketServer({
  server,
  path: '/v2/session_ingress/ws',
})

const frontendWSS = new WebSocketServer({
  server,
  path: '/ws/frontend',
})

setupIngressWSS(ingressWSS)
setupIngressWSS(ingressV2WSS)
setupFrontendWSS(frontendWSS)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  CCNode Bridge Server                                        ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP:  http://localhost:${PORT}                               ║
║  Auth:  ${getAuthMode().padEnd(50)} ║
╚══════════════════════════════════════════════════════════════╝

Available endpoints:
  POST /v1/environments/bridge
  GET  /v1/environments/:id/work/poll
  POST /v1/environments/:id/work/:workId/ack
  POST /v1/environments/:id/work/:workId/heartbeat
  POST /v1/environments/:id/work/:workId/stop
  POST /v1/environments/:id/bridge/reconnect
  POST /v1/sessions
  GET  /v1/sessions
  GET  /v1/sessions/:id
  POST /v1/sessions/:id/archive
  POST /v1/sessions/:id/events
  POST /v1/sessions/:id/messages
  POST /v1/code/sessions/:id/worker/register
  WS   /v1/session_ingress/ws/:sessionId/subscribe
  WS   /v2/session_ingress/ws/:sessionId
  WS   /ws/frontend?sessionId=:id
  GET  /api/dashboard
  GET  /api/health
`)
})
