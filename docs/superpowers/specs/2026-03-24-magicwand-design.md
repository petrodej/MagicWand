# MagicWand — Design Specification

**Date:** 2026-03-24
**Status:** Approved

## Overview

MagicWand is a personal remote computer management and AI troubleshooting system. It allows a single user to register remote Windows computers, monitor their status from a web dashboard, and use an AI assistant (Claude) to autonomously diagnose and fix issues on those machines.

## Constraints & Decisions

- **Single user** — no registration, no multi-tenancy
- **Windows-only agent** (Linux/macOS deferred)
- **SQLite** via Prisma (no external DB server)
- **Fully autonomous AI** — no confirmation prompts before actions
- **Remote desktop deferred** to phase 2
- **Server runs on home machine**, agents connect from anywhere over the internet

## Architecture

```
┌─────────────────────────────────────────────────┐
│           WEB DASHBOARD (React + Vite)          │
│  - Single-user session auth                     │
│  - Computer list with live status               │
│  - AI chat panel per computer                   │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS / WebSocket
┌──────────────────▼──────────────────────────────┐
│           BACKEND SERVER (Node.js)              │
│  - Express REST API                             │
│  - WebSocket relay (agent ↔ browser)            │
│  - AI orchestrator (Claude agentic loop)        │
│  - SQLite via Prisma                            │
│  - Simple session auth                          │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket (persistent)
┌──────────────────▼──────────────────────────────┐
│        AGENT (Python — Windows only)            │
│  - All commands (execute, screenshot, logs...)  │
│  - Connects out to server (NAT-friendly)        │
│  - Auto-reconnect, heartbeat                    │
│  - Runs as background process                   │
└─────────────────────────────────────────────────┘
```

## 1. Authentication

- On first server start, if no user exists, create one from env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- Login: `POST /api/auth/login` → returns a signed session token (random 256-bit value stored in SQLite)
- Token stored in httpOnly cookie for browser requests
- WebSocket connections pass the token as a query parameter (`?token=<session_token>`)
- Session tokens expire after 30 days of inactivity; each request refreshes the expiry
- All API routes verify session token via middleware (lookup in SQLite)
- No JWT — sessions are server-side in the database
- No registration endpoint — single user only

## 2. Data Model (Prisma + SQLite)

```prisma
model User {
  id            String     @id @default(uuid())
  email         String     @unique
  passwordHash  String
  name          String
  createdAt     DateTime   @default(now())
  computers     Computer[]
  sessions      Session[]
}

model Computer {
  id            String     @id @default(uuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  hostname      String
  os            String
  cpuModel      String?
  ramTotalMb    Int?
  agentSecret   String     @unique
  enrollToken   String?    @unique
  enrollExpiry  DateTime?
  isOnline      Boolean    @default(false)
  lastSeen      DateTime?
  ipAddress     String?
  agentVersion  String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  chatMessages  ChatMessage[]
}

model ChatMessage {
  id            String     @id @default(uuid())
  computerId    String
  computer      Computer   @relation(fields: [computerId], references: [id], onDelete: Cascade)
  role          String     // "user", "assistant", "tool_call", "tool_result"
  content       String
  metadata      String?    // JSON string (screenshots, command outputs)
  createdAt     DateTime   @default(now())
}

model Session {
  id            String     @id @default(uuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  token         String     @unique
  expiresAt     DateTime
  createdAt     DateTime   @default(now())
}
```

## 3. Agent (Python, Windows-only)

### Enrollment Flow

1. User clicks "Add Computer" on dashboard → gets a one-time enrollment token (15 min expiry)
2. User runs on remote machine: `magicwand-agent --enroll <TOKEN> --server <URL>`
3. Agent sends enrollment request with token + machine metadata (hostname, OS, CPU, RAM)
4. Server validates token, creates computer record, returns `agent_secret` + `computer_id`
5. Agent saves to `%APPDATA%/MagicWand/config.json`, connects via WebSocket

Enrollment tokens are checked at use time — if expired, the enrollment request is rejected. No background cleanup needed; expired tokens are simply ignored and overwritten on the next "Add Computer" action.

### Connection Lifecycle

- Authenticates with `agent_secret` via the first WebSocket message (not in the URL query string, to avoid proxy/server log exposure)
- Sends heartbeat every 30 seconds (CPU%, RAM%, uptime)
- Auto-reconnects on disconnect with exponential backoff (1s → 2s → 4s → ... → 60s max)
- Runs as background process (can be added to startup via Task Scheduler)

### Commands

| Command | Description |
|---------|-------------|
| `execute_command` | Run PowerShell/cmd command. Returns stdout, stderr, exit code. Timeout support (default 30s, max 120s). |
| `screenshot` | Capture screen as base64 JPEG. Multi-monitor support. |
| `system_info` | OS version, hostname, CPU, RAM total/used, disk usage, network interfaces, uptime. |
| `list_processes` | Running processes with name, PID, CPU%, RAM%. Sort & top-N filtering. |
| `get_event_logs` | Query Windows Event Viewer. Params: log name (System/Application/Security/Setup), level, last N entries or hours back. |
| `manage_service` | Start/stop/restart/status Windows services. |
| `get_installed_software` | List installed programs with versions. Optional name filter. |
| `read_file` | Read text file contents. Path + optional max lines (default 200). |
| `write_file` | Write content to a text file. Max 100KB. Blocked paths: `C:\Windows\`, `C:\Program Files\`, boot/system directories. |
| `network_diagnostics` | Ping, traceroute, nslookup, port check. |

### Safety

- **Dangerous command blocklist:** Agent refuses commands matching these patterns:
  - Disk/partition destruction: `format`, `diskpart`, `clean`
  - Bulk deletion: `del /s /q C:\*`, `rmdir /s C:\`, `Remove-Item -Recurse C:\`
  - System shutdown/restart: `shutdown`, `restart-computer` (unless via `manage_service`)
  - Registry destruction: `reg delete HKLM`, bulk registry operations
  - Security bypass: `Set-ExecutionPolicy Unrestricted`, disabling Windows Defender/Firewall
  - Principle: block any command that performs bulk deletion, disk formatting, system shutdown, or security feature disabling
- **File write restrictions:** `write_file` command blocks writes to `C:\Windows\`, `C:\Program Files\`, `C:\Program Files (x86)\`, boot directories. Max file size 100KB. Agent must canonicalize paths (resolve `..`, symlinks, alternate path forms like `\\?\`) before applying the blocklist.
- **Output size cap:** 50KB max per command output, truncated with notice
- **Command timeout:** Default 30s, max 120s, kills hung processes

### Libraries

- `websockets` — WebSocket connection
- `mss` — fast screenshot capture
- `psutil` — system info and processes
- `pywin32` — Event Viewer, service management
- `subprocess` — command execution with timeouts

### WebSocket Message Protocol

```json
// Server → Agent (command request)
{
  "id": "uuid",
  "type": "command",
  "command": "execute_command",
  "params": { "command": "Get-Printer | Format-List", "shell": "powershell", "timeout": 30 }
}

// Agent → Server (command response)
{
  "id": "uuid",
  "type": "command_result",
  "success": true,
  "data": { "stdout": "...", "stderr": "", "exit_code": 0 }
}

// Agent → Server (heartbeat)
{
  "type": "heartbeat",
  "cpu_percent": 23.5,
  "ram_percent": 61.2,
  "uptime_seconds": 84230
}
```

## 4. Backend Server (Node.js + Express)

### Tech Stack

- Node.js 20+, Express.js, TypeScript
- `ws` library for WebSocket
- Prisma ORM with SQLite
- Anthropic Claude API (claude-sonnet-4-20250514)
- Zod for validation
- Pino for logging
- bcrypt for password hashing

### REST API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/login` | Login → session cookie |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/computers` | List all computers with status |
| `POST` | `/api/computers` | Generate enrollment token |
| `GET` | `/api/computers/:id` | Computer details + system info |
| `PUT` | `/api/computers/:id` | Update computer name |
| `DELETE` | `/api/computers/:id` | Remove computer (revokes agent) |
| `POST` | `/api/computers/:id/chat` | Send message to AI |
| `GET` | `/api/computers/:id/chat` | Get chat messages |
| `DELETE` | `/api/computers/:id/chat` | Clear chat (new session) |
| `DELETE` | `/api/computers/:id/chat/active` | Cancel running AI loop |
| `POST` | `/api/agent/enroll` | Agent enrollment |

### WebSocket Endpoints

| Path | Purpose |
|------|---------|
| `/ws/agent` | Agent persistent connection (authenticates via first message with `agent_secret`) |
| `/ws/dashboard?token=<session>` | Live computer status to browser |
| `/ws/chat/<computerId>?token=<session>` | Stream AI responses to browser |

### Error Response Format

All REST API errors return:
```json
{ "error": "AGENT_OFFLINE", "message": "Computer is not connected." }
```

Common error codes: `UNAUTHORIZED`, `NOT_FOUND`, `AGENT_OFFLINE`, `AI_BUSY` (409 — AI loop already running), `VALIDATION_ERROR`, `INTERNAL_ERROR`.

### AI Orchestrator

The core intelligence. When a user sends a message for a specific computer:

1. Builds system prompt with computer metadata, instructing Claude it's a remote IT assistant
2. Defines 10 tools that map 1:1 to agent commands (same names): `execute_command`, `screenshot`, `get_event_logs`, `system_info`, `list_processes`, `manage_service`, `read_file`, `write_file`, `network_diagnostics`, `get_installed_software`
3. Calls Claude API with conversation history + tools
4. When Claude responds with `tool_use`, server dispatches command to agent via WebSocket, waits for result, feeds back as `tool_result`
5. Loop continues until Claude gives a final text response (max 20 iterations)
6. All messages streamed to frontend in real time via WebSocket
7. Messages saved to database

**System prompt directives:**
- Diagnose first, then fix
- Work step by step
- Verify fixes after applying them
- Use PowerShell as default shell
- Describe screenshots in detail
- Never run commands that could cause data loss (agent blocklist is the safety net)

**Offline agent behavior:** If the user sends a chat message to an offline computer, the API returns a 400 error with message "Computer is offline." The frontend shows this clearly. No queuing — the user must wait for the agent to reconnect.

**Agent bridge timeout:** The server waits max 60 seconds for an agent to respond to a command. If the agent doesn't respond (WebSocket drops, agent hangs), the bridge returns an error result to Claude as a `tool_result` with `is_error: true` and message "Agent did not respond within 60 seconds." Claude can then decide to retry or inform the user. No automatic retries at the bridge level.

**Concurrent chat prevention:** Only one AI loop runs per computer at a time. If a second chat message arrives while a loop is active, the API returns 409 Conflict. The frontend disables the send button while the AI is working.

**Context window management:** When conversation history approaches the model's context limit, older tool results are truncated (keeping only the first 500 chars + a summary note) while assistant text messages are preserved. The "New session" action clears history entirely as a simple escape valve.

**AI loop cancellation:** `DELETE /api/computers/:id/chat/active` cancels a running AI loop. The server stops the loop after the current tool call completes and sends a "cancelled" message to the frontend. The frontend shows a "Cancel" button while the AI is working.

**Screenshot handling:** Agent captures screen → base64 JPEG → passed to Claude as `image` content block for vision analysis.

## 5. Web Dashboard (React + TypeScript)

### Tech Stack

- React 18 + TypeScript, Vite
- React Router v6
- Zustand for state management
- Tailwind CSS + shadcn/ui
- Lucide React icons
- Native WebSocket with reconnection wrapper

### Design Direction

Professional IT management tool — dark theme, purple accent (#7c3aed), information-dense but clean. Monospace font for code/command output. Strong green/red for online/offline status.

### Pages

| Route | Purpose |
|-------|---------|
| `/login` | Login page (no registration) |
| `/dashboard` | Computer grid with live status |
| `/computers/:id` | Computer view with tabs: Overview, AI Assistant |

### Dashboard Page

- Grid of computer cards showing: name, hostname, OS, online/offline indicator, CPU/RAM bars, last seen
- "Add Computer" button → modal with enrollment token + install command (copyable)
- Modal shows "Waiting for connection..." until agent connects
- Real-time status updates via WebSocket

### AI Chat Interface

- Chat bubbles: user messages right-aligned, assistant left-aligned (Markdown rendered)
- Tool calls: collapsible sections showing command name + params, expandable to show output
- Screenshots: inline thumbnails, click to expand
- Status indicators: "Running command...", "Taking screenshot...", "Analyzing..."
- Quick action chips: "Check system health", "Find recent errors", "List running processes", "New session"
- Input field with send button

## 6. Project Structure

```
magicwand/
├── agent/
│   ├── main.py
│   ├── commands/
│   │   ├── execute.py
│   │   ├── screenshot.py
│   │   ├── system_info.py
│   │   ├── processes.py
│   │   ├── event_logs.py
│   │   ├── services.py
│   │   ├── files.py
│   │   ├── network.py
│   │   └── software.py
│   ├── config.py
│   ├── connection.py
│   ├── security.py
│   └── requirements.txt
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── computers.ts
│   │   │   ├── chat.ts
│   │   │   └── agent.ts
│   │   ├── ws/
│   │   │   ├── agentHandler.ts
│   │   │   ├── dashboardHandler.ts
│   │   │   └── chatHandler.ts
│   │   ├── services/
│   │   │   ├── ai.ts
│   │   │   ├── agentBridge.ts
│   │   │   └── auth.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── ComputerView.tsx
│   │   ├── components/
│   │   │   ├── ComputerCard.tsx
│   │   │   ├── AddComputerModal.tsx
│   │   │   ├── AIChat.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ToolCallDisplay.tsx
│   │   │   ├── SystemInfoPanel.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   └── computerStore.ts
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── ws.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── .env.example
└── README.md
```

## 7. Environment Variables

```env
ADMIN_EMAIL=admin@magicwand.local
ADMIN_PASSWORD=changeme
SESSION_SECRET=random-secret-for-cookie-signing  # used by Express cookie-parser to sign the httpOnly cookie
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

## 8. Implementation Phases

### Phase 1: Foundation
- Monorepo setup, install dependencies
- Prisma schema + SQLite migration
- Auth service (bcrypt, session tokens)
- Auth routes (login/logout)
- Auth middleware
- Minimal React app with login page

### Phase 2: Agent + Computers
- Computer CRUD routes
- Enrollment token generation
- Python agent: config, WebSocket connection, enrollment
- Server agent WebSocket handler (connection, heartbeat, status tracking)
- Dashboard page with computer cards
- Add Computer modal
- Live online/offline status via WebSocket

### Phase 3: Agent Commands
- All 10 agent commands (execute, screenshot, system_info, processes, event_logs, services, software, read_file, write_file, network)
- Dangerous command blocklist
- Server agent bridge (dispatch command, wait for response, timeout)
- Computer Overview tab (system info display)

### Phase 4: AI Assistant
- AI orchestrator service (system prompt, tool definitions, agentic loop)
- Chat REST endpoints
- Chat WebSocket handler (streaming responses)
- AIChat component with message rendering
- ToolCallDisplay component (collapsible tool calls/results)
- Screenshot display in chat
- Quick action chips
- New session (clear chat)

## Phase 2 (Future): Remote Desktop
- Desktop streaming in agent (JPEG frames over WebSocket)
- Server WebSocket relay
- Canvas-based RemoteDesktop React component
- Keyboard/mouse capture and relay
- Input injection in agent
