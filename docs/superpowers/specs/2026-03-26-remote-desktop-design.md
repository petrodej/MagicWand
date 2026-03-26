# Remote Desktop Feature

**Goal:** Add a browser-based remote desktop viewer to MagicWand using screenshot polling and input relay through existing WebSocket infrastructure.

**Approach:** Screenshot polling at ~3-5 FPS with JPEG compression (quality 50%, max width 1280px). Mouse and keyboard events sent back to the agent. No VNC/RDP dependencies — uses existing agent screenshot command + new input command.

---

## Architecture

```
Browser (canvas)          Server                    Agent (Windows PC)
     |                      |                              |
     |<-- WS: JPEG frame ---|<-- WS: screenshot result ----|
     |<-- WS: JPEG frame ---|<-- WS: screenshot result ----|
     |<-- WS: JPEG frame ---|<-- WS: screenshot result ----|
     |                      |                              |
     |--- WS: mouse click ->|--- WS: input_event --------->|
     |                      |                    pyautogui  |
     |--- WS: key press --->|--- WS: input_event --------->|
     |                      |                              |
```

Server runs a frame loop (setInterval ~250ms) that requests screenshots from the agent and relays them to the browser. Input events flow in the opposite direction.

---

## Agent Side

### Modified: `agent/commands/screenshot.py`

Add optional parameters:
- `quality` (int, default 75) — JPEG quality 1-100
- `max_width` (int, default None) — resize frame to this width, maintaining aspect ratio

When `max_width` is set, resize the captured image before encoding to JPEG. This reduces bandwidth for remote desktop streaming.

Return value stays the same: `{ image_base64, width, height }`

### New: `agent/commands/input_control.py`

Handles mouse and keyboard input using `pyautogui`.

**Commands:**
- `mouse_move(x, y)` — move cursor to scaled position
- `mouse_click(x, y, button='left')` — click at position (left/right)
- `mouse_double_click(x, y)` — double-click at position
- `mouse_scroll(x, y, delta)` — scroll wheel at position
- `key_press(key)` — single key press (e.g., "enter", "tab", "f5")
- `key_combo(keys)` — key combination (e.g., ["ctrl", "c"])
- `key_type(text)` — type a string of text

**Coordinate scaling:** The browser sends coordinates relative to the 1280px-wide canvas. The agent scales these to actual screen resolution:
```python
actual_x = int(x * (screen_width / canvas_width))
actual_y = int(y * (screen_height / canvas_height))
```

**Safety:** pyautogui has a built-in failsafe (moving mouse to corner raises exception). Keep this enabled. No additional blocklist needed — the user is intentionally controlling the screen.

### Modified: `agent/commands/__init__.py`

Register `input_control` as a new command handler.

### Modified: `agent/requirements.txt`

Add `pyautogui` (which pulls in `Pillow` and `PyScreeze` as dependencies — Pillow is likely already present for screenshot).

---

## Server Side

### New: `server/src/ws/remoteHandler.ts`

WebSocket handler for `/ws/remote/{computerId}`.

**Connection lifecycle:**
1. Client connects with `?token=` query param (same WS token auth as dashboard/chat)
2. Server validates token
3. Server starts frame loop: `setInterval(requestFrame, 250)` (~4 FPS)
4. Each tick: `sendAgentCommand(computerId, 'screenshot', { quality: 50, max_width: 1280 })`
5. On frame received: send JPEG base64 to browser as JSON `{ type: 'frame', data: base64, width, height }`
6. On input event from browser: `sendAgentCommand(computerId, 'input_event', event)`
7. On disconnect: `clearInterval`, stop streaming

**Frame loop details:**
- Skip sending a new screenshot request if the previous one hasn't returned yet (prevent queue buildup)
- If agent is offline, send `{ type: 'error', message: 'Agent offline' }` and close

**Input event format from browser:**
```json
{ "type": "input", "action": "mouse_click", "x": 640, "y": 360, "button": "left" }
{ "type": "input", "action": "key_press", "key": "enter" }
{ "type": "input", "action": "key_combo", "keys": ["ctrl", "c"] }
{ "type": "input", "action": "key_type", "text": "hello" }
{ "type": "input", "action": "mouse_scroll", "x": 640, "y": 360, "delta": -3 }
```

### Modified: `server/src/index.ts`

Add new WebSocketServer for remote desktop:
- `const remoteWss = new WebSocketServer({ noServer: true })`
- Handle upgrade for `/ws/remote/{computerId}` path
- Authenticate with WS token
- Call `setupRemoteHandler(ws, computerId)` from remoteHandler.ts

---

## Frontend

### New: `web/src/components/RemoteDesktop.tsx`

Canvas-based remote desktop viewer.

**Structure:**
- Toolbar at top: connection status indicator, "Ctrl+Alt+Del" button, fullscreen toggle
- `<canvas>` element filling available space, maintaining aspect ratio
- Focus indicator (border glow when canvas has focus for keyboard capture)

**Canvas rendering:**
- Receive base64 JPEG frames via WebSocket
- Decode to Image, draw on canvas with `ctx.drawImage()`
- Track canvas dimensions and actual frame dimensions for coordinate scaling

**Input capture:**
- `onMouseDown`, `onMouseUp`, `onMouseMove` on canvas — calculate position relative to canvas, send to server
- Only send mouse_move events while a button is held (drag) or on click — not continuous tracking (too much traffic)
- `onKeyDown`, `onKeyUp` on canvas — send key events when canvas is focused
- `onWheel` on canvas — send scroll events
- `onContextMenu` — prevent default, send right-click
- `tabIndex={0}` on canvas to make it focusable

**Coordinate calculation:**
```typescript
const rect = canvas.getBoundingClientRect();
const x = (event.clientX - rect.left) * (frameWidth / rect.width);
const y = (event.clientY - rect.top) * (frameHeight / rect.height);
```

**Connection:**
- Uses `getWsBase()` from api.ts for WebSocket URL
- Gets WS token from `/api/auth/ws-token`
- Auto-reconnect on disconnect (same pattern as other WS hooks)

**Styling (matching teal theme):**
- Toolbar: `bg-gray-900 border-b border-gray-800/50 px-4 py-2`
- Status dot: emerald when connected, gray when disconnected
- Buttons: ghost variant, teal on hover
- Canvas container: `bg-gray-950` letterboxed
- Focus ring: `ring-teal-500/30` when canvas is focused

### Modified: `web/src/pages/ComputerView.tsx`

Add "Remote" tab between Overview and AI Assistant:
```tsx
{(['overview', 'remote', 'chat'] as const).map((tab) => (
  // ...
  {tab === 'overview' ? 'Overview' : tab === 'remote' ? 'Remote' : 'AI Assistant'}
))}
```

Render `<RemoteDesktop computerId={computer.id} />` when activeTab is 'remote'. Only show tab when computer is online.

---

## Files Summary

### Create
- `agent/commands/input_control.py`
- `server/src/ws/remoteHandler.ts`
- `web/src/components/RemoteDesktop.tsx`

### Modify
- `agent/commands/__init__.py` — register input_control
- `agent/commands/screenshot.py` — add quality/max_width params
- `agent/requirements.txt` — add pyautogui
- `server/src/index.ts` — mount remote WebSocket route
- `web/src/pages/ComputerView.tsx` — add Remote tab

---

## Non-Goals

- Smooth 30+ FPS streaming (this is a functional MVP, not a gaming-grade remote desktop)
- Audio streaming
- Multi-monitor switching (use primary monitor only)
- Clipboard sync
- File drag-and-drop
