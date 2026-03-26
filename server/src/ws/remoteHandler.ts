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
