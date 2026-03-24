import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import pino from 'pino';
import { prisma } from './db.js';
import { seedAdminUser } from './services/auth.js';
import authRoutes from './routes/auth.js';
import computerRoutes from './routes/computers.js';
import agentRoutes from './routes/agent.js';

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

// WebSocket servers will be attached in later tasks
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  // Route WebSocket upgrades — implemented in later tasks
  socket.destroy();
});

async function start() {
  await seedAdminUser();
  server.listen(config.PORT, () => {
    logger.info(`MagicWand server running on port ${config.PORT}`);
  });
}
start();

export { app, server, wss };
