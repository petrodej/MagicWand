import { WebSocket } from 'ws';

// Maps computerId → Set of browser WebSocket clients
const chatClients = new Map<string, Set<WebSocket>>();

export function addChatClient(computerId: string, ws: WebSocket) {
  if (!chatClients.has(computerId)) {
    chatClients.set(computerId, new Set());
  }
  chatClients.get(computerId)!.add(ws);

  ws.on('close', () => {
    chatClients.get(computerId)?.delete(ws);
    if (chatClients.get(computerId)?.size === 0) {
      chatClients.delete(computerId);
    }
  });
}

export function broadcastChatEvent(computerId: string, event: any) {
  const clients = chatClients.get(computerId);
  if (!clients) return;

  const msg = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}
