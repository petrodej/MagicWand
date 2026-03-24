import { WebSocket, WebSocketServer } from 'ws';
import { prisma } from '../db.js';
import { logger } from '../index.js';

// Maps computerId → WebSocket
const agentConnections = new Map<string, WebSocket>();

// Maps computerId → pending command resolvers
const pendingCommands = new Map<string, Map<string, {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}>>();

export function getAgentConnection(computerId: string): WebSocket | undefined {
  return agentConnections.get(computerId);
}

export function isAgentOnline(computerId: string): boolean {
  return agentConnections.has(computerId);
}

export function setupAgentWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    let computerId: string | null = null;
    let authenticated = false;

    // Timeout: must authenticate within 10 seconds
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);

    ws.on('message', async (raw) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Handle authentication (first message)
      if (!authenticated && data.type === 'auth') {
        clearTimeout(authTimeout);

        const computer = await prisma.computer.findFirst({
          where: {
            agentSecret: data.agentSecret,
            id: data.computerId,
          },
        });

        if (!computer) {
          ws.close(4003, 'Invalid credentials');
          return;
        }

        computerId = computer.id;
        authenticated = true;
        agentConnections.set(computerId, ws);
        pendingCommands.set(computerId, new Map());

        await prisma.computer.update({
          where: { id: computerId },
          data: { isOnline: true, lastSeen: new Date() },
        });

        logger.info(`Agent connected: ${computer.name} (${computerId})`);
        broadcastStatus(computerId, true);
        return;
      }

      if (!authenticated || !computerId) return;

      // Handle heartbeat
      if (data.type === 'heartbeat') {
        await prisma.computer.update({
          where: { id: computerId },
          data: { lastSeen: new Date() },
        });
        broadcastHeartbeat(computerId, data);
        return;
      }

      // Handle command result
      if (data.type === 'command_result') {
        const pending = pendingCommands.get(computerId);
        const resolver = pending?.get(data.id);
        if (resolver) {
          clearTimeout(resolver.timeout);
          pending!.delete(data.id);
          if (data.success) {
            resolver.resolve(data.data);
          } else {
            resolver.reject(new Error(data.error || 'Command failed'));
          }
        }
        return;
      }
    });

    ws.on('close', async () => {
      clearTimeout(authTimeout);
      if (computerId) {
        agentConnections.delete(computerId);
        // Reject all pending commands
        const pending = pendingCommands.get(computerId);
        if (pending) {
          for (const [, resolver] of pending) {
            clearTimeout(resolver.timeout);
            resolver.reject(new Error('Agent disconnected'));
          }
          pendingCommands.delete(computerId);
        }

        await prisma.computer.update({
          where: { id: computerId },
          data: { isOnline: false, lastSeen: new Date() },
        });

        logger.info(`Agent disconnected: ${computerId}`);
        broadcastStatus(computerId, false);
      }
    });
  });
}

// Send a command to an agent and wait for the result (with timeout)
export function sendAgentCommand(
  computerId: string,
  command: string,
  params: Record<string, any>,
  timeoutMs = 60000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = agentConnections.get(computerId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Agent is not connected'));
      return;
    }

    const id = crypto.randomUUID();
    const timeout = setTimeout(() => {
      pendingCommands.get(computerId)?.delete(id);
      reject(new Error(`Agent did not respond within ${timeoutMs / 1000} seconds.`));
    }, timeoutMs);

    pendingCommands.get(computerId)?.set(id, { resolve, reject, timeout });

    ws.send(JSON.stringify({
      id,
      type: 'command',
      command,
      params,
    }));
  });
}

// Dashboard status broadcasting
const dashboardClients = new Set<WebSocket>();

export function addDashboardClient(ws: WebSocket) {
  dashboardClients.add(ws);
  ws.on('close', () => dashboardClients.delete(ws));
}

function broadcastStatus(computerId: string, isOnline: boolean) {
  const msg = JSON.stringify({ type: 'status', computerId, isOnline });
  for (const client of dashboardClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastHeartbeat(computerId: string, data: any) {
  const msg = JSON.stringify({
    type: 'heartbeat',
    computerId,
    cpuPercent: data.cpu_percent,
    ramPercent: data.ram_percent,
    uptimeSeconds: data.uptime_seconds,
  });
  for (const client of dashboardClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
