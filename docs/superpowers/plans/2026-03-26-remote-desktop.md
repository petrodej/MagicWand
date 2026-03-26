# Remote Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-based remote desktop viewer to MagicWand using screenshot polling and input relay through existing WebSocket infrastructure.

**Architecture:** Screenshot polling at ~4 FPS with JPEG compression (quality 50%, max width 1280px). Server runs a frame loop requesting screenshots from the agent and relaying them to the browser. Mouse and keyboard events flow in the opposite direction via pyautogui.

**Tech Stack:** Python (pyautogui, mss, Pillow), TypeScript/Node.js (ws), React (canvas API)

---

### Task 1: Modify screenshot command to accept quality and max_width params

**Files:**
- Modify: `agent/commands/screenshot.py`

- [ ] **Step 1: Update screenshot function to accept quality and max_width params**

Replace the hardcoded `max_width = 1920` and `quality=75` with params:

```python
import base64
import io
import mss
from PIL import Image

async def screenshot(params: dict) -> dict:
    monitor_index = params.get("monitor", 0)
    quality = params.get("quality", 75)
    max_width = params.get("max_width", 1920)

    with mss.mss() as sct:
        monitors = sct.monitors
        if monitor_index >= len(monitors):
            monitor_index = 0

        monitor = monitors[monitor_index]
        img = sct.grab(monitor)

        pil_img = Image.frombytes("RGB", img.size, img.bgra, "raw", "BGRX")

        if pil_img.width > max_width:
            ratio = max_width / pil_img.width
            new_size = (max_width, int(pil_img.height * ratio))
            pil_img = pil_img.resize(new_size, Image.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=quality)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        return {
            "image_base64": b64,
            "width": pil_img.width,
            "height": pil_img.height,
            "format": "jpeg",
        }
```

- [ ] **Step 2: Test manually**

Start the agent and verify screenshot still works via AI chat ("take a screenshot"). Confirm parameters don't break existing usage.

- [ ] **Step 3: Commit**

```bash
git add agent/commands/screenshot.py
git commit -m "feat: add quality and max_width params to screenshot command"
```

---

### Task 2: Create input_control command on the agent

**Files:**
- Create: `agent/commands/input_control.py`
- Modify: `agent/main.py:53-76` — register input_control handler
- Modify: `agent/requirements.txt` — add pyautogui

- [ ] **Step 1: Add pyautogui to requirements**

Add to `agent/requirements.txt`:
```
pyautogui>=0.9
```

- [ ] **Step 2: Create input_control.py**

```python
import pyautogui
import mss

# Keep pyautogui failsafe enabled (moving mouse to corner raises exception)
pyautogui.FAILSAFE = True
# Disable the default pause between actions for responsiveness
pyautogui.PAUSE = 0.02

def _get_screen_size():
    """Get actual screen resolution for coordinate scaling."""
    with mss.mss() as sct:
        monitor = sct.monitors[0]  # Full virtual screen
        return monitor["width"], monitor["height"]

def _scale_coords(x: float, y: float, canvas_width: float, canvas_height: float) -> tuple[int, int]:
    """Scale coordinates from canvas space to actual screen space."""
    screen_w, screen_h = _get_screen_size()
    actual_x = int(x * (screen_w / canvas_width))
    actual_y = int(y * (screen_h / canvas_height))
    return actual_x, actual_y

async def input_control(params: dict) -> dict:
    """Handle mouse and keyboard input events."""
    action = params.get("action")
    canvas_width = params.get("canvas_width", 1280)
    canvas_height = params.get("canvas_height", 720)

    try:
        if action == "mouse_move":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            pyautogui.moveTo(x, y)

        elif action == "mouse_click":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            button = params.get("button", "left")
            pyautogui.click(x, y, button=button)

        elif action == "mouse_double_click":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            pyautogui.doubleClick(x, y)

        elif action == "mouse_scroll":
            x, y = _scale_coords(params["x"], params["y"], canvas_width, canvas_height)
            delta = params.get("delta", 0)
            pyautogui.scroll(delta, x, y)

        elif action == "key_press":
            key = params.get("key", "")
            pyautogui.press(key)

        elif action == "key_combo":
            keys = params.get("keys", [])
            pyautogui.hotkey(*keys)

        elif action == "key_type":
            text = params.get("text", "")
            pyautogui.typewrite(text, interval=0.02)

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

        return {"success": True}

    except pyautogui.FailSafeException:
        return {"success": False, "error": "Failsafe triggered (mouse moved to corner)"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

- [ ] **Step 3: Register input_control in main.py**

In `agent/main.py`, add the import and handler entry inside `handle_command()`:

```python
# Add after line 63 (from commands.network import network_diagnostics):
from commands.input_control import input_control

# Add to handlers dict after "network_diagnostics" entry:
"input_control": input_control,
```

- [ ] **Step 4: Install pyautogui on the agent machine**

```bash
pip install pyautogui
```

- [ ] **Step 5: Test manually**

Restart the agent. Use AI chat to test: "Move the mouse to the center of the screen." Verify the input_control command works via `sendAgentCommand`.

- [ ] **Step 6: Commit**

```bash
git add agent/commands/input_control.py agent/main.py agent/requirements.txt
git commit -m "feat: add input_control command for remote mouse/keyboard"
```

---

### Task 3: Create remote desktop WebSocket handler on the server

**Files:**
- Create: `server/src/ws/remoteHandler.ts`

This handler manages the frame loop (requesting screenshots from the agent) and relays input events from the browser to the agent.

- [ ] **Step 1: Create remoteHandler.ts**

```typescript
import { WebSocket } from 'ws';
import { sendAgentCommand, isAgentOnline } from './agentHandler.js';
import { logger } from '../index.js';

export function setupRemoteHandler(ws: WebSocket, computerId: string) {
  let frameInterval: ReturnType<typeof setInterval> | null = null;
  let waitingForFrame = false;
  let lastFrameWidth = 1280;
  let lastFrameHeight = 720;

  // Check agent is online
  if (!isAgentOnline(computerId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Agent offline' }));
    ws.close();
    return;
  }

  // Start frame loop (~4 FPS)
  frameInterval = setInterval(async () => {
    if (waitingForFrame) return; // Skip if previous frame hasn't returned
    if (ws.readyState !== WebSocket.OPEN) return;

    waitingForFrame = true;
    try {
      const result = await sendAgentCommand(computerId, 'screenshot', {
        quality: 50,
        max_width: 1280,
      }, 5000); // 5s timeout for frames

      if (ws.readyState === WebSocket.OPEN) {
        lastFrameWidth = result.width;
        lastFrameHeight = result.height;
        ws.send(JSON.stringify({
          type: 'frame',
          data: result.image_base64,
          width: result.width,
          height: result.height,
        }));
      }
    } catch (err: any) {
      if (ws.readyState === WebSocket.OPEN) {
        // If agent went offline, notify and close
        if (!isAgentOnline(computerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Agent offline' }));
          ws.close();
        }
        // Otherwise just skip this frame
      }
    } finally {
      waitingForFrame = false;
    }
  }, 250);

  // Handle input events from browser
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'input') {
        // Forward input to agent with canvas dimensions for coordinate scaling
        sendAgentCommand(computerId, 'input_control', {
          action: data.action,
          x: data.x,
          y: data.y,
          button: data.button,
          delta: data.delta,
          key: data.key,
          keys: data.keys,
          text: data.text,
          canvas_width: lastFrameWidth,
          canvas_height: lastFrameHeight,
        }, 5000).catch(() => {
          // Input delivery failures are non-fatal
        });
      }
    } catch {}
  });

  // Cleanup on disconnect
  ws.on('close', () => {
    if (frameInterval) {
      clearInterval(frameInterval);
      frameInterval = null;
    }
    logger.info(`Remote desktop disconnected: ${computerId}`);
  });

  logger.info(`Remote desktop connected: ${computerId}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/ws/remoteHandler.ts
git commit -m "feat: add remote desktop WebSocket handler with frame loop"
```

---

### Task 4: Mount remote desktop WebSocket route in server

**Files:**
- Modify: `server/src/index.ts:1-19` — add import
- Modify: `server/src/index.ts:78-93` — add route in upgrade handler

- [ ] **Step 1: Add import**

Add to the imports in `server/src/index.ts` (after the chatHandler import on line 18):

```typescript
import { setupRemoteHandler } from './ws/remoteHandler.js';
```

- [ ] **Step 2: Add WebSocketServer and upgrade handler**

Add a new WSS after line 48 (`const chatWss = ...`):

```typescript
const remoteWss = new WebSocketServer({ noServer: true });
```

Add the route matching in the `server.on('upgrade', ...)` handler, after the chat match block (before `socket.destroy()`):

```typescript
  const remoteMatch = pathname.match(/^\/ws\/remote\/([a-f0-9-]+)$/);
  if (remoteMatch) {
    const token = url.searchParams.get('token');
    if (!token || !validateWsToken(token)) {
      socket.destroy();
      return;
    }
    remoteWss.handleUpgrade(request, socket, head, (ws) => {
      setupRemoteHandler(ws, remoteMatch[1]);
    });
    return;
  }
```

- [ ] **Step 3: Verify server compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: mount remote desktop WebSocket route at /ws/remote/:computerId"
```

---

### Task 5: Create RemoteDesktop React component

**Files:**
- Create: `web/src/components/RemoteDesktop.tsx`

- [ ] **Step 1: Create RemoteDesktop.tsx**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, getWsBase } from '../lib/api';

interface Props {
  computerId: string;
  isOnline: boolean;
}

export function RemoteDesktop({ computerId, isOnline }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 1280, height: 720 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!isOnline) return;

    let alive = true;
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let backoff = 1000;

    async function connect() {
      if (!alive) return;
      try {
        const { token } = await api.get<{ token: string }>('/api/auth/ws-token');
        if (!alive) return;

        ws = new WebSocket(`${getWsBase()}/ws/remote/${computerId}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          backoff = 1000;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'frame') {
              drawFrame(data.data, data.width, data.height);
              setFrameSize({ width: data.width, height: data.height });
            } else if (data.type === 'error') {
              console.error('Remote desktop error:', data.message);
            }
          } catch {}
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (alive) {
            reconnectTimeout = setTimeout(connect, backoff);
            backoff = Math.min(backoff * 2, 30000);
          }
        };
      } catch {
        if (alive) {
          reconnectTimeout = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 30000);
        }
      }
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimeout);
      ws?.close();
      wsRef.current = null;
    };
  }, [computerId, isOnline]);

  // Draw frame on canvas
  const drawFrame = useCallback((base64: string, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  }, []);

  // Send input event
  const sendInput = useCallback((event: Record<string, any>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', ...event }));
    }
  }, []);

  // Calculate coordinates relative to the frame
  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (frameSize.width / rect.width);
    const y = (e.clientY - rect.top) * (frameSize.height / rect.height);
    return { x: Math.round(x), y: Math.round(y) };
  }, [frameSize]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const { x, y } = getCoords(e);
    const button = e.button === 2 ? 'right' : 'left';
    sendInput({ action: 'mouse_click', x, y, button });
  }, [getCoords, sendInput]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const { x, y } = getCoords(e);
    sendInput({ action: 'mouse_move', x, y });
  }, [isDragging, getCoords, sendInput]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e);
    sendInput({ action: 'mouse_double_click', x, y });
  }, [getCoords, sendInput]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e as unknown as React.MouseEvent<HTMLCanvasElement>);
    const delta = e.deltaY > 0 ? -3 : 3;
    sendInput({ action: 'mouse_scroll', x, y, delta });
  }, [getCoords, sendInput]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  }, []);

  // Keyboard handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // Handle modifier combos
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('ctrl');
    if (e.altKey) modifiers.push('alt');
    if (e.shiftKey) modifiers.push('shift');
    if (e.metaKey) modifiers.push('win');

    const key = e.key.toLowerCase();

    // Skip standalone modifier keys
    if (['control', 'alt', 'shift', 'meta'].includes(key)) return;

    if (modifiers.length > 0) {
      sendInput({ action: 'key_combo', keys: [...modifiers, key] });
    } else {
      // Map common keys
      const keyMap: Record<string, string> = {
        'enter': 'enter', 'backspace': 'backspace', 'tab': 'tab',
        'escape': 'escape', 'delete': 'delete', 'arrowup': 'up',
        'arrowdown': 'down', 'arrowleft': 'left', 'arrowright': 'right',
        ' ': 'space', 'home': 'home', 'end': 'end',
        'pageup': 'pageup', 'pagedown': 'pagedown',
      };
      const mappedKey = keyMap[key] || key;
      sendInput({ action: 'key_press', key: mappedKey });
    }
  }, [sendInput]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  // Send Ctrl+Alt+Del
  const sendCtrlAltDel = useCallback(() => {
    sendInput({ action: 'key_combo', keys: ['ctrl', 'alt', 'delete'] });
  }, [sendInput]);

  if (!isOnline) {
    return (
      <div className="text-gray-600 py-12 text-center text-sm">
        Computer is offline. Remote desktop unavailable.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-[calc(100vh-140px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 border-b border-gray-800/50 px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-gray-600'
            }`} />
            <span className="text-gray-400">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={sendCtrlAltDel}
            className="text-gray-400 hover:text-teal-400 text-xs"
          >
            Ctrl+Alt+Del
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-teal-400"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-hidden">
        {!connected ? (
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting to remote desktop...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            tabIndex={0}
            className="max-w-full max-h-full cursor-default outline-none focus:ring-2 focus:ring-teal-500/30 rounded"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/RemoteDesktop.tsx
git commit -m "feat: add RemoteDesktop canvas component with input capture"
```

---

### Task 6: Add Remote tab to ComputerView

**Files:**
- Modify: `web/src/pages/ComputerView.tsx:8` — add import
- Modify: `web/src/pages/ComputerView.tsx:51-65` — add tab
- Modify: `web/src/pages/ComputerView.tsx:67-78` — add tab content

- [ ] **Step 1: Add import**

Add after the AIChat import (line 8):

```typescript
import { RemoteDesktop } from '../components/RemoteDesktop';
```

- [ ] **Step 2: Add 'remote' tab between overview and chat**

Replace the tab rendering block (lines 51-65):

```tsx
      {/* Underline tabs */}
      <div className="flex gap-6 border-b border-gray-800/50 mb-6">
        {(['overview', 'remote', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-gray-100 border-teal-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'remote' ? 'Remote' : 'AI Assistant'}
          </button>
        ))}
      </div>
```

- [ ] **Step 3: Add tab content for remote**

Replace the tab content block (lines 67-78):

```tsx
      {/* Tab content */}
      {activeTab === 'overview' ? (
        computer.isOnline ? (
          <SystemInfoPanel computerId={computer.id} />
        ) : (
          <div className="text-gray-600 py-12 text-center text-sm">
            Computer is offline. System info unavailable.
          </div>
        )
      ) : activeTab === 'remote' ? (
        <RemoteDesktop computerId={computer.id} isOnline={computer.isOnline} />
      ) : (
        <AIChat computerId={computer.id} isOnline={computer.isOnline} />
      )}
```

- [ ] **Step 4: Verify frontend compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Test end-to-end**

1. Start the server: `cd server && npm run dev`
2. Start the frontend: `cd web && npm run dev`
3. Ensure an agent is connected
4. Navigate to a computer → click "Remote" tab
5. Verify: canvas shows live screenshots, mouse clicks register on remote machine, keyboard input works

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/ComputerView.tsx
git commit -m "feat: add Remote tab to ComputerView for remote desktop access"
```

---

## Files Summary

### Create
- `agent/commands/input_control.py` — mouse/keyboard input via pyautogui
- `server/src/ws/remoteHandler.ts` — frame loop + input relay WebSocket handler
- `web/src/components/RemoteDesktop.tsx` — canvas-based remote desktop viewer

### Modify
- `agent/commands/screenshot.py` — add quality/max_width params
- `agent/main.py` — register input_control command
- `agent/requirements.txt` — add pyautogui
- `server/src/index.ts` — mount /ws/remote/{computerId} route
- `web/src/pages/ComputerView.tsx` — add Remote tab
