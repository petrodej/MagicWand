import { WebSocket } from 'ws';
import { sendAgentCommand, isAgentOnline } from './agentHandler.js';
import { logger } from '../index.js';

export function setupRemoteHandler(ws: WebSocket, computerId: string) {
  let frameInterval: ReturnType<typeof setInterval> | null = null;
  let waitingForFrame = false;
  let lastFrameWidth = 1280;
  let lastFrameHeight = 720;
  let quality = 50;
  let maxWidth = 1280;
  let frameDelay = 250;

  // Check agent is online
  if (!isAgentOnline(computerId)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Agent offline' }));
    ws.close();
    return;
  }

  const restartFrameLoop = () => {
    if (frameInterval) clearInterval(frameInterval);
    frameInterval = setInterval(async () => {
      if (waitingForFrame) return;
      if (ws.readyState !== WebSocket.OPEN) return;

      waitingForFrame = true;
      try {
        const result = await sendAgentCommand(computerId, 'screenshot', {
          quality,
          max_width: maxWidth,
        }, 5000);

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
      } catch {
        if (ws.readyState === WebSocket.OPEN && !isAgentOnline(computerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Agent offline' }));
          ws.close();
        }
      } finally {
        waitingForFrame = false;
      }
    }, frameDelay);
  };

  // Start frame loop
  restartFrameLoop();

  // Handle messages from browser
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'input') {
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
        }, 5000).catch(() => {});
      } else if (data.type === 'settings') {
        if (data.quality != null) quality = Math.max(10, Math.min(100, data.quality));
        if (data.maxWidth != null) maxWidth = Math.max(640, Math.min(1920, data.maxWidth));
        if (data.fps != null) {
          const fps = Math.max(1, Math.min(15, data.fps));
          frameDelay = Math.round(1000 / fps);
          restartFrameLoop();
        }
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
