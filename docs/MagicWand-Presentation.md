# MagicWand — Remote Computer Management with AI

## What is MagicWand?

MagicWand is a web-based remote computer management platform with an AI-powered assistant. It allows IT administrators to monitor, diagnose, and fix issues on remote Windows computers through a browser — without needing remote desktop access.

The AI assistant (powered by Claude) can autonomously run commands, read logs, take screenshots, and troubleshoot problems on remote machines.

---

## Architecture Overview

```
+--------------------------------------------------+
|                   CLOUD / HOST                    |
|                                                   |
|  +---------------------------------------------+ |
|  |           MagicWand Server (Node.js)         | |
|  |                                              | |
|  |  +----------+  +-----------+  +----------+  | |
|  |  | REST API |  | WebSocket |  | Static   |  | |
|  |  | Express  |  | Server    |  | Frontend |  | |
|  |  +----------+  +-----------+  +----------+  | |
|  |       |              |                       | |
|  |  +----------+  +-----------+                 | |
|  |  | Prisma   |  | Claude AI |                 | |
|  |  | SQLite   |  | Service   |                 | |
|  |  +----------+  +-----------+                 | |
|  +---------------------------------------------+ |
|         |               |              |          |
|    Cloudflare Tunnel (HTTPS + WSS)                |
+---------|-----------+---|--------------|----------+
          |           |   |              |
    +-----|--+   +----|---|---+    +------|------+
    |Browser |   | Browser  |    | Windows PC  |
    | Admin  |   | Admin 2  |    | Agent       |
    +--------+   +----------+    +-------------+
                                 | Windows PC  |
                                 | Agent       |
                                 +-------------+
```

### Communication Flow

```
Browser (Dashboard)                Server                    Agent (Remote PC)
      |                              |                              |
      |--- HTTPS POST /chat -------->|                              |
      |                              |--- Claude API call --------->|
      |                              |<-- Claude: use tool ---------|
      |                              |                              |
      |                              |--- WebSocket: run command -->|
      |                              |                              |
      |                              |<-- WebSocket: result --------|
      |                              |                              |
      |                              |--- Claude API (result) ----->|
      |                              |<-- Claude: final answer -----|
      |                              |                              |
      |<-- WebSocket: stream text ---|                              |
      |                              |                              |
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, Tailwind CSS 4, Vite | Dashboard UI |
| **Backend** | Node.js, Express 5, TypeScript | API server, WebSocket hub |
| **Database** | SQLite via Prisma ORM | Users, computers, chat history |
| **AI** | Claude Sonnet (Anthropic API) | Autonomous troubleshooting |
| **Agent** | Python 3.12 (embedded) | Runs on remote Windows PCs |
| **Networking** | Cloudflare Tunnel | Public HTTPS access from anywhere |
| **Auth** | Session cookies (signed, httpOnly) | Admin login, short-lived WS tokens |

---

## How It Works

### 1. Adding a Computer

1. Admin clicks **"Add Computer"** in the dashboard
2. Server generates a unique enrollment token (valid 15 minutes)
3. Dashboard shows a **downloadable .bat installer** file
4. Admin transfers the .bat file to the remote Windows PC and double-clicks it
5. The installer automatically:
   - Downloads embedded Python 3.12 (no pre-installed Python needed)
   - Downloads the agent code from the server
   - Installs Python dependencies
   - Enrolls the agent with the server (exchanges token for a permanent secret)
   - Creates a Windows startup shortcut (agent auto-starts on login)
   - Starts the agent immediately

### 2. Agent Connection

- The agent maintains a persistent **WebSocket connection** to the server
- It sends **heartbeats every 30 seconds** with CPU usage, RAM usage, and uptime
- The server broadcasts these to all connected dashboards in real-time
- If the connection drops, the agent **automatically reconnects** with exponential backoff
- The dashboard shows live online/offline status with resource utilization

### 3. AI Assistant — How It Works

When the admin asks the AI to diagnose or fix something:

1. The message is sent to the server via REST API
2. The server calls the **Claude API** with the message and 10 available tools
3. Claude analyzes the request and decides which tools to use
4. The server **relays tool calls to the agent** via WebSocket
5. The agent **executes the action locally** on the Windows PC and returns results
6. Results are fed back to Claude, which may request more tools or give a final answer
7. All responses are **streamed in real-time** to the browser via WebSocket

This creates an **agentic loop** — Claude can chain multiple tool calls (up to 20 iterations) to autonomously diagnose and fix issues.

### Available AI Tools

| Tool | What It Does |
|------|-------------|
| `execute_command` | Run PowerShell or CMD commands |
| `screenshot` | Capture the remote screen |
| `system_info` | Get OS, CPU, RAM, disk, uptime details |
| `list_processes` | Show running processes sorted by CPU/memory |
| `get_event_logs` | Read Windows Event Viewer (errors, warnings) |
| `manage_service` | Start, stop, restart Windows services |
| `read_file` | Read file contents on the remote PC |
| `write_file` | Write files (blocked for system directories) |
| `network_diagnostics` | Ping, traceroute, DNS lookup, port check |
| `get_installed_software` | List installed programs with versions |

### Safety

- The agent has a **command blocklist** preventing dangerous operations (format, diskpart, del /s, shutdown, etc.)
- System directories are protected from writes
- Command output is truncated to prevent memory issues
- The AI loop has a maximum of 20 iterations to prevent runaway execution

---

## System Components

### Frontend (React Dashboard)

- **Login page** — admin authentication
- **Dashboard** — grid of all registered computers with live status and resource bars
- **Computer View** — detailed system info + AI chat interface
- **Add Computer Modal** — generates installer for new machines

### Backend (Node.js Server)

- **REST API** — auth, computer CRUD, chat messages, agent enrollment, file downloads
- **WebSocket Hub** — three WebSocket servers:
  - `/ws/agent` — agent connections (auth + heartbeat + commands)
  - `/ws/dashboard` — live status updates to browsers
  - `/ws/chat/{id}` — AI response streaming to browsers
- **AI Service** — orchestrates the Claude agentic loop
- **Agent Bridge** — sends commands to agents and awaits responses
- **Static Serving** — serves the built frontend (single-port deployment)

### Agent (Python on Windows)

- Lightweight Python process running on each managed computer
- Connects to server via WebSocket with auto-reconnect
- Executes commands in isolated subprocesses
- 10 command modules: execute, screenshot, system_info, processes, event_logs, services, software, files, network

### Deployment

- Server runs on any machine (local PC, VPS, etc.)
- **Cloudflare Tunnel** exposes it publicly with HTTPS — no port forwarding needed
- Agents connect outbound to the server (no inbound ports needed on remote PCs)
- SQLite database for zero-configuration persistence

---

## Example Use Case

**Scenario:** A user reports their PC is running slowly.

**Admin action:** Opens the computer in MagicWand, types "This computer is running slow, diagnose and fix it."

**What the AI does (autonomously):**
1. Runs `system_info` to check overall resource usage
2. Runs `list_processes` sorted by CPU to find the culprit
3. Checks `get_event_logs` for recent errors
4. Identifies a runaway process consuming 80% CPU
5. Runs `execute_command` to terminate it
6. Verifies CPU dropped back to normal
7. Reports findings and actions taken to the admin

Total time: ~30 seconds, no remote desktop needed.

---

## Project Stats

| Metric | Value |
|--------|-------|
| **Total lines of code** | 3,874 |
| **Total source files** | 54 |
| **TypeScript (server)** | 1,349 lines |
| **TypeScript/React (frontend)** | 1,748 lines |
| **Python (agent)** | 648 lines |
| **CSS** | 129 lines |
| **Development time** | ~2 sessions with Claude Code |
| **Estimated tokens used** | ~2M+ (across planning, implementation, debugging, and UI redesign) |
| **AI model used for development** | Claude Opus 4.6 (via Claude Code CLI) |
| **AI model used in product** | Claude Sonnet 4 (for the AI assistant) |

---

## Key Differentiators

- **Zero-dependency installer** — users don't need Python, just double-click a .bat file
- **AI-first approach** — not just monitoring, but autonomous diagnosis and remediation
- **Real-time** — live resource monitoring and streaming AI responses
- **Lightweight** — single Node.js server, SQLite database, no complex infrastructure
- **Secure** — outbound-only agent connections, command blocklist, signed session auth
