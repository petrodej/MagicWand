import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import pino from 'pino';

export const logger = pino({ transport: { target: 'pino-pretty' } });

const app = express();
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser(config.SESSION_SECRET));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = createServer(app);

// WebSocket servers will be attached in later tasks
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  // Route WebSocket upgrades — implemented in later tasks
  socket.destroy();
});

server.listen(config.PORT, () => {
  logger.info(`MagicWand server running on port ${config.PORT}`);
});

export { app, server, wss };
