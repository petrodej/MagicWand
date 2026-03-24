import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { config } from './config.js';
import pino from 'pino';
import { seedAdminUser } from './services/auth.js';
import authRoutes from './routes/auth.js';
import { validateWsToken } from './routes/auth.js';
import computerRoutes from './routes/computers.js';
import agentRoutes from './routes/agent.js';
import { setupAgentWebSocket, addDashboardClient } from './ws/agentHandler.js';

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
app.use('/api/agent', agentRoutes);

const server = createServer(app);

const agentWss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });

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

  socket.destroy();
});

async function start() {
  await seedAdminUser();
  server.listen(config.PORT, () => {
    logger.info(`MagicWand server running on port ${config.PORT}`);
  });
}
start();

export { app, server };
