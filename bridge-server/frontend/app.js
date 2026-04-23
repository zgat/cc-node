const API_BASE = '';
let currentSessionId = null;
let ws = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  document.getElementById('close-detail').addEventListener('click', closeDetail);
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  document.getElementById('interrupt-btn').addEventListener('click', sendInterrupt);

  await loadDashboard();
  setInterval(loadDashboard, 3000);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function loadDashboard() {
  // Skip DOM updates when user is in a session detail view
  // to prevent flicker, input loss, and hover state disruption.
  if (currentSessionId) return;

  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    renderEnvironments(data.environments);
    renderSessions(data.sessions);
    document.getElementById('stats').textContent =
      `${data.environments.length} envs · ${data.sessions.length} sessions`;
  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

function renderEnvironments(envs) {
  const container = document.getElementById('environments-list');

  let html = '';
  if (envs.length === 0) {
    html = '<div style="color:var(--muted);font-size:0.8rem;">No environments connected. Run `CLAUDE_BRIDGE_BASE_URL=' +
           `${location.origin} claude remote-control` + '` on a machine.</div>';
  } else {
    for (const env of envs) {
      html += `
        <div class="env-card" data-env-id="${env.id}">
          <h3>${escapeHtml(env.machineName)}</h3>
          <div class="meta">${escapeHtml(env.directory)} · ${escapeHtml(env.branch)}</div>
          <div class="badge">max ${env.maxSessions}</div>
        </div>`;
    }
  }

  // New session form
  html += `
    <div class="new-session-form">
      <input id="new-env-id" type="text" placeholder="Environment ID" />
      <input id="new-title" type="text" placeholder="Session title (optional)" />
      <input id="new-prompt" type="text" placeholder="Initial prompt (optional)" />
      <button onclick="createSession()">New Session</button>
    </div>`;

  container.innerHTML = html;

  for (const card of container.querySelectorAll('.env-card')) {
    card.addEventListener('click', () => {
      const envId = card.dataset.envId;
      document.getElementById('new-env-id').value = envId;
    });
  }
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions-list');
  if (sessions.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No sessions yet.</div>';
    return;
  }

  let html = '';
  for (const s of sessions) {
    const stateClass = `state-${s.state}`;
    html += `
      <div class="session-card" data-session-id="${s.id}">
        <div>
          <div class="title">${escapeHtml(s.title)}</div>
          <div style="font-size:0.75rem;color:var(--muted);">${s.messageCount} msgs · ${s.pendingPermissions} pending</div>
        </div>
        <span class="state ${stateClass}">${s.state}</span>
      </div>`;
  }
  container.innerHTML = html;

  for (const card of container.querySelectorAll('.session-card')) {
    card.addEventListener('click', () => openSession(card.dataset.sessionId));
  }
}

// ---------------------------------------------------------------------------
// Session Detail
// ---------------------------------------------------------------------------
async function openSession(sessionId) {
  currentSessionId = sessionId;
  document.getElementById('session-detail').classList.remove('hidden');
  document.getElementById('environments-section').classList.add('hidden');
  document.getElementById('sessions-section').classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/v1/sessions/${sessionId}`);
    const data = await res.json();
    document.getElementById('detail-title').textContent = data.title;
    document.getElementById('detail-state').textContent = `State: ${data.state}`;
    renderMessages(data.messages);
    renderPermissions(data.pendingPermissions);
  } catch (err) {
    console.error('Failed to load session:', err);
  }

  connectWebSocket(sessionId);
}

function closeDetail() {
  currentSessionId = null;
  document.getElementById('session-detail').classList.add('hidden');
  document.getElementById('environments-section').classList.remove('hidden');
  document.getElementById('sessions-section').classList.remove('hidden');
  if (ws) {
    ws.close();
    ws = null;
  }
}

function renderMessages(messages) {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';
  for (const msg of messages) {
    appendMessageToDOM(msg);
  }
  container.scrollTop = container.scrollHeight;
}

function appendMessageToDOM(msg) {
  const container = document.getElementById('messages-container');
  const el = document.createElement('div');

  if (msg.type === 'user') {
    el.className = 'message user';
    const text = extractText(msg.message?.content);
    el.innerHTML = `<div class="role-label">You</div>${escapeHtml(text)}`;
  } else if (msg.type === 'assistant') {
    el.className = 'message assistant';
    const text = extractText(msg.message?.content);
    el.innerHTML = `<div class="role-label">Assistant</div>${formatContent(text, msg.message?.content)}`;
  } else if (msg.type === 'system') {
    el.className = 'message assistant';
    el.innerHTML = `<div class="role-label">System</div>${escapeHtml(msg.content || '')}`;
  } else {
    return;
  }

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function formatContent(text, contentBlocks) {
  // Simple markdown-ish formatting
  let html = escapeHtml(text)
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  // Append tool_use blocks as info
  if (Array.isArray(contentBlocks)) {
    for (const block of contentBlocks) {
      if (block.type === 'tool_use') {
        html += `<pre><code>Tool: ${escapeHtml(block.name)}\n${escapeHtml(JSON.stringify(block.input, null, 2))}</code></pre>`;
      }
    }
  }
  return html;
}

function renderPermissions(permissions) {
  const panel = document.getElementById('permissions-panel');
  panel.innerHTML = '';
  for (const perm of permissions) {
    const div = document.createElement('div');
    div.className = 'permission-item';
    div.dataset.requestId = perm.request_id;
    div.innerHTML = `
      <div class="tool-name">${escapeHtml(perm.request?.tool_name || 'Tool')}</div>
      <div class="tool-input">${escapeHtml(JSON.stringify(perm.request?.input, null, 2))}</div>
      <button class="btn-allow" onclick="respondPermission('${perm.request_id}', 'allow')">Allow</button>
      <button class="btn-deny" onclick="respondPermission('${perm.request_id}', 'deny')">Deny</button>
    `;
    panel.appendChild(div);
  }
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------
function connectWebSocket(sessionId) {
  if (ws) ws.close();

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws/frontend?sessionId=${sessionId}`);

  ws.onopen = () => console.log('[ws] Connected to session', sessionId);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWsMessage(data);
    } catch (err) {
      console.error('[ws] Invalid JSON:', err);
    }
  };

  ws.onclose = () => console.log('[ws] Disconnected');
  ws.onerror = (err) => console.error('[ws] Error:', err);
}

function handleWsMessage(data) {
  if (data.type === 'init') {
    renderMessages(data.messages);
    renderPermissions(data.pendingPermissions);
  } else if (data.type === 'message') {
    appendMessageToDOM(data.message);
  } else if (data.type === 'permission') {
    const panel = document.getElementById('permissions-panel');
    const perm = data.permission;
    const div = document.createElement('div');
    div.className = 'permission-item';
    div.dataset.requestId = perm.request_id;
    div.innerHTML = `
      <div class="tool-name">${escapeHtml(perm.request?.tool_name || 'Tool')}</div>
      <div class="tool-input">${escapeHtml(JSON.stringify(perm.request?.input, null, 2))}</div>
      <button class="btn-allow" onclick="respondPermission('${perm.request_id}', 'allow')">Allow</button>
      <button class="btn-deny" onclick="respondPermission('${perm.request_id}', 'deny')">Deny</button>
    `;
    panel.appendChild(div);
  } else if (data.type === 'permission_resolved') {
    const el = document.querySelector(`.permission-item[data-request-id="${data.request_id}"]`);
    if (el) el.remove();
  } else if (data.type === 'activity') {
    // Could show in a small activity bar
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function createSession() {
  const envId = document.getElementById('new-env-id').value.trim();
  const title = document.getElementById('new-title').value.trim();
  const prompt = document.getElementById('new-prompt').value.trim();

  if (!envId) {
    alert('Please select or enter an Environment ID');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environmentId: envId, title, prompt }),
    });
    const data = await res.json();
    if (res.ok) {
      await loadDashboard();
      openSession(data.sessionId);
    } else {
      alert('Failed: ' + (data.error?.message || res.statusText));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !currentSessionId) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'send_message', text }));
  } else {
    // Fallback to HTTP
    await fetch(`${API_BASE}/v1/sessions/${currentSessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }
  input.value = '';
}

function sendInterrupt() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'interrupt' }));
  }
}

async function respondPermission(requestId, decision) {
  if (!currentSessionId) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'permission_response', request_id: requestId, decision }));
  } else {
    await fetch(`${API_BASE}/v1/sessions/${currentSessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{
          type: 'control_response',
          response: { subtype: 'success', request_id: requestId, response: { behavior: decision } }
        }]
      }),
    });
  }

  const el = document.querySelector(`.permission-item[data-request-id="${requestId}"]`);
  if (el) el.remove();
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Make functions available globally for onclick handlers
window.createSession = createSession;
window.respondPermission = respondPermission;

init();
