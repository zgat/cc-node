# CCNode Bridge Server

A self-hosted bridge server for managing [CCNode](https://github.com/zgat/cc-node) (Claude Code) sessions across multiple machines.

## What is this?

By default, CCNode's Bridge/Remote Control connects to Anthropic's cloud (`claude.ai`). This server lets you run your **own** bridge infrastructure:

- Connect multiple machines running CCNode
- Manage sessions from a single Web UI
- No Anthropic OAuth or cloud dependency required
- All traffic stays within your network

## Architecture

```
┌─────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│   Machine A │────▶│   CCNode Bridge Server  │◀────│   Machine B │
│  (ccnode)   │ WS  │   (this project)        │ WS  │  (ccnode)   │
└─────────────┘     │                         │     └─────────────┘
                    │  ┌─────────────────┐    │
                    │  │   Web UI        │    │
                    │  │   (Browser)     │    │
                    │  └─────────────────┘    │
                    └─────────────────────────┘
```

### Data Flow

1. **Environment Registration**: Each machine running `claude remote-control` sends a `POST /v1/environments/bridge` to register itself.
2. **Work Polling**: The bridge on each machine long-polls `GET /work/poll` (30s timeout). When you create a session via the Web UI, the server generates a `WorkResponse` and wakes up the waiting poll.
3. **Session Spawn**: The machine receives the work, acks it, and spawns a CCNode child process. The child connects via WebSocket to `Session Ingress`.
4. **Message Relay**: Messages flow bidirectionally:
   - Web UI → Server → CCNode (user messages)
   - CCNode → Server → Web UI (assistant responses, tool use)
5. **Permissions**: When CCNode asks for tool approval, the server forwards the `control_request` to the Web UI. Your decision goes back as a `control_response`.

## Quick Start

### 1. Install dependencies

```bash
cd ccnode-bridge-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Run

```bash
# No auth (trusted network)
AUTH_MODE=none npm start

# Or with bearer token
AUTH_MODE=bearer CLAUDE_BRIDGE_OAUTH_TOKEN=my-secret npm start
```

Server starts on `http://localhost:8080`.

### 4. Connect CCNode

On each machine you want to manage:

```bash
export CLAUDE_BRIDGE_BASE_URL="http://your-server:8080"
# Optional: if using bearer auth
export CLAUDE_BRIDGE_OAUTH_TOKEN="my-secret"

# Start bridge mode
claude remote-control
```

### 5. Open Web UI

Go to `http://your-server:8080/` in your browser.

## Web UI Features

- **Environment List**: See all connected machines with machine name, working directory, git branch, and max session capacity.
- **Create Session**: Click an environment to select it, fill in title/prompt, and spawn a new session on that machine.
- **Session Chat**: Real-time message history with syntax-highlighted code blocks. Messages from both user and assistant are displayed inline.
- **Tool Permission Panel**: When CCNode asks for tool approval, a panel appears showing the tool name and input. Click "Allow" or "Deny".
- **Interrupt**: Send an interrupt signal to stop the current assistant turn.
- **Auto-refresh**: Dashboard refreshes every 3 seconds when viewing the environment list. Pauses in session detail view to avoid flicker.

## Deployment

### Run as systemd service

Create `/etc/systemd/system/ccnode-bridge.service`:

```ini
[Unit]
Description=CCNode Bridge Server
After=network.target

[Service]
Type=simple
User=ccnode
WorkingDirectory=/opt/ccnode-bridge-server
ExecStart=/usr/bin/node dist/server.js
Environment="AUTH_MODE=bearer"
Environment="CLAUDE_BRIDGE_OAUTH_TOKEN=your-secret-token"
Environment="PORT=8080"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ccnode-bridge
sudo systemctl status ccnode-bridge
```

### Run with Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 8080
ENV AUTH_MODE=none
CMD ["node", "dist/server.js"]
```

```bash
docker build -t ccnode-bridge .
docker run -d -p 8080:8080 -e AUTH_MODE=bearer -e CLAUDE_BRIDGE_OAUTH_TOKEN=secret ccnode-bridge
```

### Run with PM2

```bash
npm install -g pm2
pm2 start dist/server.js --name ccnode-bridge --env AUTH_MODE=none
pm2 save
pm2 startup
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name bridge.example.com;

    ssl_certificate /etc/letsencrypt/live/bridge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bridge.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

## Configuration

### Server-side

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP/WebSocket port |
| `AUTH_MODE` | `none` | `none` or `bearer` |
| `CLAUDE_BRIDGE_OAUTH_TOKEN` | *(none)* | Shared bearer token (required when `AUTH_MODE=bearer`) |

### Client-side (CCNode)

Set on each managed machine:

```bash
export CLAUDE_BRIDGE_BASE_URL="http://your-server:8080"
export CLAUDE_BRIDGE_OAUTH_TOKEN="your-secret"  # if AUTH_MODE=bearer
```

Or make it persistent in `~/.bashrc` or `/etc/environment`.

## API Reference

### Bridge Protocol (CCNode → Server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/environments/bridge` | Register environment |
| GET | `/v1/environments/:id/work/poll` | Long-poll for work (30s) |
| POST | `/v1/environments/:id/work/:workId/ack` | Ack work |
| POST | `/v1/environments/:id/work/:workId/heartbeat` | Heartbeat |
| POST | `/v1/environments/:id/work/:workId/stop` | Stop work |
| DELETE | `/v1/environments/bridge/:id` | Deregister |
| POST | `/v1/environments/:id/bridge/reconnect` | Reconnect session |
| POST | `/v1/sessions/:id/archive` | Archive session |
| POST | `/v1/sessions/:id/events` | Send events |
| POST | `/v1/code/sessions/:id/worker/register` | CCR v2 worker reg |

### Session Ingress WebSocket

| Path | Direction | Description |
|------|-----------|-------------|
| `WS /v1/session_ingress/ws/:sessionId/subscribe` | CCNode → Server | CCNode child process connects here |
| `WS /v2/session_ingress/ws/:sessionId` | CCNode → Server | Local dev mode (localhost) |
| `WS /ws/frontend?sessionId=:id` | Browser → Server | Web UI connects here |

### Dashboard API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | All environments + sessions |
| GET | `/api/health` | Health check + stats |

## Troubleshooting

### "No environments connected" in Web UI

- Check that `CLAUDE_BRIDGE_BASE_URL` is set correctly on the managed machine
- Verify network connectivity: `curl http://your-server:8080/api/health`
- Check server logs for registration attempts

### Sessions stuck in "pending"

- The environment may be at max sessions capacity
- The bridge on the target machine may not be polling (check `claude remote-control` status)
- Try `POST /v1/environments/:id/bridge/reconnect` to re-dispatch

### WebSocket disconnections

- Check reverse proxy WebSocket configuration (`Upgrade` and `Connection` headers)
- Ensure `proxy_read_timeout` is high enough for long-polling

### Auth failures

- If `AUTH_MODE=bearer`, ensure `CLAUDE_BRIDGE_OAUTH_TOKEN` matches on both server and client
- Server-side token: `CLAUDE_BRIDGE_OAUTH_TOKEN` env var
- Client-side token: same env var, or `Authorization: Bearer <token>` header

## Production Notes

- **Storage**: Currently in-memory (`Map`). For production, replace with Redis or SQLite.
- **Scale**: Handles dozens of machines / hundreds of sessions comfortably on a single instance.
- **Security**: Always use `AUTH_MODE=bearer` and TLS in production. Run behind a reverse proxy.
- **Session Timeout**: Currently no automatic cleanup. Add a periodic sweeper to remove stale sessions.
- **High Availability**: For HA, run multiple server instances behind a load balancer with shared Redis storage.

## Development

```bash
# Watch mode
npm run dev

# Type check
npm run lint
```

### Project Structure

```
src/
├── server.ts          # Express + ws entry point
├── types.ts           # Bridge protocol types
├── store.ts           # In-memory storage
├── middleware/
│   └── auth.ts        # Bearer / none auth
├── routes/
│   ├── bridge.ts      # Environment & work polling
│   ├── sessions.ts    # Session CRUD & messages
│   └── ccr.ts         # CCR v2 worker API
└── ws/
    └── ingress.ts     # WebSocket message relay
frontend/
├── index.html         # Web UI
├── app.js             # Frontend logic
└── style.css          # Dark theme
```

## License

MIT
