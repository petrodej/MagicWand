import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import path from 'path';
import { config } from './config.js';
import pino from 'pino';
import { seedAdminUser } from './services/auth.js';
import authRoutes from './routes/auth.js';
import { validateWsToken } from './routes/auth.js';
import computerRoutes from './routes/computers.js';
import agentRoutes from './routes/agent.js';
import chatRoutes from './routes/chat.js';
import downloadRoutes from './routes/download.js';
import { setupAgentWebSocket, addDashboardClient } from './ws/agentHandler.js';
import { addChatClient } from './ws/chatHandler.js';
import { setupRemoteHandler } from './ws/remoteHandler.js';
import alertRoutes from './routes/alerts.js';
import auditRoutes from './routes/audit.js';
import { startAlertMonitor } from './services/alertMonitor.js';

export const logger = pino({ transport: { target: 'pino-pretty' } });

const app = express();
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser(config.SESSION_SECRET));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/computers', computerRoutes);
app.use('/api/computers', chatRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/audit', auditRoutes);

// Serve frontend static files
const webDist = path.resolve(process.cwd(), '../web/dist');
app.use(express.static(webDist));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

const server = createServer(app);

const agentWss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });
const chatWss = new WebSocketServer({ noServer: true });
const remoteWss = new WebSocketServer({ noServer: true });

setupAgentWebSocket(agentWss);

dashboardWss.on('connection', (ws) => {
  addDashboardClient(ws);
});

server.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/ws/agent') {
    agentWss.handleUpgrade(request, socket, head, (ws) => {
      agentWss.emit('connection', ws, request);
    });
    return;
  }

  if (pathname === '/ws/dashboard') {
    const token = url.searchParams.get('token');
    if (!token || !validateWsToken(token)) {
      socket.destroy();
      return;
    }
    dashboardWss.handleUpgrade(request, socket, head, (ws) => {
      dashboardWss.emit('connection', ws, request);
    });
    return;
  }

  const chatMatch = pathname.match(/^\/ws\/chat\/([a-f0-9-]+)$/);
  if (chatMatch) {
    const token = url.searchParams.get('token');
    if (!token || !validateWsToken(token)) {
      socket.destroy();
      return;
    }
    chatWss.handleUpgrade(request, socket, head, (ws) => {
      addChatClient(chatMatch[1], ws);
    });
    return;
  }

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

  socket.destroy();
});

async function start() {
  await seedAdminUser();
  startAlertMonitor();
  server.listen(config.PORT, () => {
    logger.info(`MagicWand server running on port ${config.PORT}`);
  });
}
start();

export { app, server };
