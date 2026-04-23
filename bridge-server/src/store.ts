import type {
  Environment,
  WorkItem,
  Session,
  SDKMessage,
  PermissionRequest,
  SessionActivity,
} from './types.js'

// ---------------------------------------------------------------------------
// In-memory store for environments, work items, and sessions.
// Suitable for small-to-medium deployments (dozens of machines,
// hundreds of sessions). Replace with Redis / SQLite for scale.
// ---------------------------------------------------------------------------

const environments = new Map<string, Environment>()
const workItems = new Map<string, WorkItem>()
const sessions = new Map<string, Session>()

// Pending poll resolvers: environmentId -> { resolve, timer }
const pollResolvers = new Map<
  string,
  { resolve: (value: WorkItem | null) => void; timer: ReturnType<typeof setTimeout> }
>()

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export function getEnvironment(id: string): Environment | undefined {
  return environments.get(id)
}

export function setEnvironment(env: Environment): void {
  environments.set(env.id, env)
}

export function deleteEnvironment(id: string): void {
  environments.delete(id)
}

export function listEnvironments(): Environment[] {
  return Array.from(environments.values())
}

// ---------------------------------------------------------------------------
// Work Items
// ---------------------------------------------------------------------------

export function getWorkItem(id: string): WorkItem | undefined {
  return workItems.get(id)
}

export function setWorkItem(work: WorkItem): void {
  workItems.set(work.id, work)
}

export function findPendingWorkForEnv(environmentId: string): WorkItem | undefined {
  for (const work of workItems.values()) {
    if (work.environmentId === environmentId && work.state === 'pending') {
      return work
    }
  }
  return undefined
}

export function listWorkForEnv(environmentId: string): WorkItem[] {
  return Array.from(workItems.values()).filter((w) => w.environmentId === environmentId)
}

// ---------------------------------------------------------------------------
// Poll (long-polling) — bridge blocks on GET /work/poll until work arrives
// ---------------------------------------------------------------------------

export function registerPoll(
  environmentId: string,
  timeoutMs: number,
): Promise<WorkItem | null> {
  // If work already pending, return immediately
  const pending = findPendingWorkForEnv(environmentId)
  if (pending) {
    return Promise.resolve(pending)
  }

  return new Promise((resolve) => {
    // Cancel any previous poll for this environment
    cancelPoll(environmentId)

    const timer = setTimeout(() => {
      pollResolvers.delete(environmentId)
      resolve(null)
    }, timeoutMs)

    pollResolvers.set(environmentId, { resolve, timer })
  })
}

export function cancelPoll(environmentId: string): void {
  const pending = pollResolvers.get(environmentId)
  if (pending) {
    clearTimeout(pending.timer)
    pollResolvers.delete(environmentId)
    pending.resolve(null)
  }
}

export function notifyPoll(environmentId: string, work: WorkItem): boolean {
  const pending = pollResolvers.get(environmentId)
  if (pending) {
    clearTimeout(pending.timer)
    pollResolvers.delete(environmentId)
    pending.resolve(work)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function getSession(id: string): Session | undefined {
  return sessions.get(id)
}

export function setSession(session: Session): void {
  sessions.set(session.id, session)
}

export function deleteSession(id: string): void {
  sessions.delete(id)
}

export function listSessions(): Session[] {
  return Array.from(sessions.values())
}

export function listSessionsForEnv(environmentId: string): Session[] {
  return Array.from(sessions.values()).filter((s) => s.environmentId === environmentId)
}

export function addSessionMessage(sessionId: string, message: SDKMessage): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.messages.push(message)
    session.updatedAt = Date.now()
  }
}

export function addSessionPermission(sessionId: string, req: PermissionRequest): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.pendingPermissions.push(req)
    session.updatedAt = Date.now()
  }
}

export function resolveSessionPermission(
  sessionId: string,
  requestId: string,
): PermissionRequest | undefined {
  const session = sessions.get(sessionId)
  if (!session) return undefined
  const idx = session.pendingPermissions.findIndex((p) => p.request_id === requestId)
  if (idx >= 0) {
    const [perm] = session.pendingPermissions.splice(idx, 1)
    session.updatedAt = Date.now()
    return perm
  }
  return undefined
}

export function addSessionActivity(sessionId: string, activity: SessionActivity): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.activities.push(activity)
    if (session.activities.length > 20) {
      session.activities.shift()
    }
    session.updatedAt = Date.now()
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function getStats() {
  return {
    environments: environments.size,
    sessions: sessions.size,
    workItems: workItems.size,
    activePolls: pollResolvers.size,
  }
}
