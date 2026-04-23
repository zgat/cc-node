import type { Request, Response, NextFunction } from 'express'

const AUTH_MODE = process.env.AUTH_MODE ?? 'none'
const BEARER_TOKEN = process.env.CLAUDE_BRIDGE_OAUTH_TOKEN ?? 'ccnode-bridge-secret'

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (AUTH_MODE === 'none') {
    next()
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { type: 'unauthorized', message: 'Missing or invalid Authorization header' } })
    return
  }

  const token = authHeader.slice(7)
  if (token !== BEARER_TOKEN) {
    res.status(401).json({ error: { type: 'unauthorized', message: 'Invalid token' } })
    return
  }

  next()
}

export function getAuthMode(): string {
  return AUTH_MODE
}
