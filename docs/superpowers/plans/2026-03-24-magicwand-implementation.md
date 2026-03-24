# MagicWand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal remote computer management system with AI-powered troubleshooting via Claude.

**Architecture:** Three-layer system — React dashboard (Vite + Tailwind + shadcn/ui) talks to a Node.js/Express backend (SQLite via Prisma) which relays commands to Python agents on remote Windows machines via persistent WebSocket connections. Claude API provides autonomous AI troubleshooting via an agentic tool-use loop.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Zustand | Node.js 20 + Express + Prisma + SQLite + ws + Zod + Pino | Python 3.11+ + websockets + mss + psutil + pywin32

**Spec:** `docs/superpowers/specs/2026-03-24-magicwand-design.md`

---

## Phase 1: Foundation

### Task 1: Server Project Setup

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/src/config.ts`
- Create: `server/.env.example`
- Create: `server/.env`
- Create: `.gitignore`

- [ ] **Step 1: Initialize server package**

```bash
cd /mnt/d/Projects/MagicWand
mkdir -p server/src
cd server
npm init -y
```

- [ ] **Step 2: Install server dependencies**

```bash
cd /mnt/d/Projects/MagicWand/server
npm install express ws @prisma/client @anthropic-ai/sdk zod pino pino-pretty bcrypt cookie-parser cors uuid
npm install -D typescript @types/node @types/express @types/ws @types/bcrypt @types/cookie-parser @types/cors @types/uuid prisma tsx
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create config.ts**

```typescript
// server/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  ADMIN_EMAIL: z.string().email().default('admin@magicwand.local'),
  ADMIN_PASSWORD: z.string().min(1).default('changeme'),
  SESSION_SECRET: z.string().min(16).default('change-me-to-a-random-secret'),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const config = envSchema.parse(process.env);
```

- [ ] **Step 5: Create index.ts with basic Express + WS server**

```typescript
// server/src/index.ts
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
```

- [ ] **Step 6: Create .env.example and .env**

```env
ADMIN_EMAIL=admin@magicwand.local
ADMIN_PASSWORD=changeme
SESSION_SECRET=replace-with-random-64-char-string
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
.env
__pycache__/
*.pyc
.venv/
*.egg-info/
build/
.superpowers/
```

- [ ] **Step 8: Add dev script to package.json**

Add to `server/package.json` scripts:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Also set `"type": "module"` in package.json.

- [ ] **Step 9: Verify server starts**

```bash
cd /mnt/d/Projects/MagicWand/server
cp .env.example .env
npx tsx src/index.ts
```

Expected: "MagicWand server running on port 3001"

Test health endpoint: `curl http://localhost:3001/api/health` → `{"status":"ok"}`

- [ ] **Step 10: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/ .gitignore
git commit -m "feat: server project setup with Express + WebSocket + config"
```

---

### Task 2: Prisma Schema + SQLite Migration

**Files:**
- Create: `server/prisma/schema.prisma`
- Modify: `server/src/index.ts` (add prisma import)
- Create: `server/src/db.ts`

- [ ] **Step 1: Create Prisma schema**

```prisma
// server/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./magicwand.db"
}

model User {
  id            String     @id @default(uuid())
  email         String     @unique
  passwordHash  String
  name          String
  createdAt     DateTime   @default(now())
  computers     Computer[]
  sessions      Session[]
}

model Computer {
  id            String        @id @default(uuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  hostname      String
  os            String
  cpuModel      String?
  ramTotalMb    Int?
  agentSecret   String        @unique
  enrollToken   String?       @unique
  enrollExpiry  DateTime?
  isOnline      Boolean       @default(false)
  lastSeen      DateTime?
  ipAddress     String?
  agentVersion  String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  chatMessages  ChatMessage[]
}

model ChatMessage {
  id            String   @id @default(uuid())
  computerId    String
  computer      Computer @relation(fields: [computerId], references: [id], onDelete: Cascade)
  role          String
  content       String
  metadata      String?
  createdAt     DateTime @default(now())
}

model Session {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token         String   @unique
  expiresAt     DateTime
  createdAt     DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**

```bash
cd /mnt/d/Projects/MagicWand/server
npx prisma migrate dev --name init
```

Expected: Migration created, SQLite database file generated at `server/prisma/magicwand.db`.

- [ ] **Step 3: Create db.ts singleton**

```typescript
// server/src/db.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 4: Verify Prisma client works**

```bash
cd /mnt/d/Projects/MagicWand/server
npx tsx -e "import { prisma } from './src/db.js'; prisma.user.count().then(c => { console.log('User count:', c); process.exit(0); });"
```

Expected: `User count: 0`

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/prisma/ server/src/db.ts
git commit -m "feat: Prisma schema with SQLite and all models"
```

---

### Task 3: Auth Service

**Files:**
- Create: `server/src/services/auth.ts`

- [ ] **Step 1: Create auth service**

```typescript
// server/src/services/auth.ts
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';

const SESSION_EXPIRY_DAYS = 30;

export async function seedAdminUser(): Promise<void> {
  const existing = await prisma.user.findFirst();
  if (existing) return;

  const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      email: config.ADMIN_EMAIL,
      passwordHash,
      name: 'Admin',
    },
  });
}

export async function login(email: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  return token;
}

export async function validateSession(token: string): Promise<string | null> {
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Refresh expiry on use
  const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiry },
  });

  return session.userId;
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/services/auth.ts
git commit -m "feat: auth service with bcrypt, session tokens, admin seeding"
```

---

### Task 4: Auth Routes + Middleware

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/routes/auth.ts`
- Modify: `server/src/index.ts` (mount routes, seed admin)

- [ ] **Step 1: Create auth middleware**

```typescript
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.js';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.signedCookies?.session;
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated.' });
    return;
  }

  const userId = await validateSession(token);
  if (!userId) {
    res.clearCookie('session');
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Session expired.' });
    return;
  }

  req.userId = userId;
  next();
}
```

- [ ] **Step 2: Create auth routes**

```typescript
// server/src/routes/auth.ts
import { Router } from 'express';
import { z } from 'zod';
import { login, logout } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email or password format.' });
    return;
  }

  const token = await login(parsed.data.email, parsed.data.password);
  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' });
    return;
  }

  res.cookie('session', token, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  res.json({ success: true });
});

router.post('/logout', requireAuth, async (req, res) => {
  const token = req.signedCookies?.session;
  if (token) await logout(token);
  res.clearCookie('session');
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ userId: req.userId });
});

// Short-lived WS token (not the session token — avoids leaking httpOnly cookie to JS)
const wsTokens = new Map<string, { userId: string; expiresAt: number }>();

router.get('/ws-token', requireAuth, async (req, res) => {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  wsTokens.set(token, { userId: req.userId!, expiresAt: Date.now() + 60000 }); // 60s TTL
  res.json({ token });
});

export function validateWsToken(token: string): string | null {
  const entry = wsTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    wsTokens.delete(token);
    return null;
  }
  wsTokens.delete(token); // single-use
  return entry.userId;
}

export default router;
```

- [ ] **Step 3: Mount routes and seed admin in index.ts**

Update `server/src/index.ts` to import and mount auth routes, and call `seedAdminUser` on startup:

```typescript
// Add these imports at the top:
import { prisma } from './db.js';
import { seedAdminUser } from './services/auth.js';
import authRoutes from './routes/auth.js';

// Mount routes before the server.listen call:
app.use('/api/auth', authRoutes);

// Add admin seeding before server.listen:
async function start() {
  await seedAdminUser();
  server.listen(config.PORT, () => {
    logger.info(`MagicWand server running on port ${config.PORT}`);
  });
}

start();
```

Remove the old bare `server.listen(...)` call and replace with the `start()` function.

- [ ] **Step 4: Verify auth flow works**

```bash
cd /mnt/d/Projects/MagicWand/server
npx tsx src/index.ts &
sleep 2

# Login
curl -c cookies.txt -b cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@magicwand.local","password":"changeme"}'

# Check auth
curl -b cookies.txt http://localhost:3001/api/auth/me

# Logout
curl -b cookies.txt -X POST http://localhost:3001/api/auth/logout

kill %1
rm cookies.txt
```

Expected: Login returns `{"success":true}`, `/me` returns `{"userId":"..."}`, logout returns `{"success":true}`.

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/middleware/ server/src/routes/auth.ts server/src/index.ts
git commit -m "feat: auth routes (login/logout/me) with session cookie middleware"
```

---

### Task 5: Web Project Setup

**Files:**
- Create: `web/` directory with Vite + React + TypeScript + Tailwind + shadcn/ui scaffolding

- [ ] **Step 1: Scaffold Vite React project**

```bash
cd /mnt/d/Projects/MagicWand
npm create vite@latest web -- --template react-ts
cd web
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd /mnt/d/Projects/MagicWand/web
npm install react-router-dom zustand lucide-react react-markdown
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Tailwind**

Replace `web/src/index.css` with:
```css
@import "tailwindcss";
```

Add Tailwind plugin to `web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
```

- [ ] **Step 4: Set up shadcn/ui**

```bash
cd /mnt/d/Projects/MagicWand/web
npx shadcn@latest init -d
```

When prompted, choose defaults (New York style, Zinc base color, CSS variables).

Then install the components we need:
```bash
npx shadcn@latest add button input card dialog tabs badge
```

- [ ] **Step 5: Create API helper**

```typescript
// web/src/lib/api.ts
const BASE = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'UNKNOWN', message: res.statusText }));
    throw new ApiError(res.status, body.error, body.message);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 6: Create auth store**

```typescript
// web/src/stores/authStore.ts
import { create } from 'zustand';
import { api, ApiError } from '../lib/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    await api.post('/api/auth/login', { email, password });
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await api.post('/api/auth/logout');
    set({ isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      await api.get('/api/auth/me');
      set({ isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
```

- [ ] **Step 7: Create basic App with router**

```typescript
// web/src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Login } from './pages/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-950 text-white">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div className="bg-gray-950 text-white min-h-screen p-8">
                <h1 className="text-2xl font-bold">Dashboard — coming soon</h1>
              </div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: Update main.tsx**

```typescript
// web/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Remove the default `App.css` and any Vite boilerplate from `App.tsx`.

- [ ] **Step 9: Verify web app builds and runs**

```bash
cd /mnt/d/Projects/MagicWand/web
npm run dev
```

Open http://localhost:5173 — should redirect to `/login` and show the login page placeholder.

- [ ] **Step 10: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/
git commit -m "feat: web project setup with Vite, React, Tailwind, shadcn/ui, auth store"
```

---

### Task 6: Login Page

**Files:**
- Create: `web/src/pages/Login.tsx`

- [ ] **Step 1: Create Login page component**

```tsx
// web/src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-400">✦ MagicWand</h1>
          <p className="text-gray-500 mt-2 text-sm">Remote Computer Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
              required
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify full auth flow end-to-end**

Start both server and web:
```bash
# Terminal 1
cd /mnt/d/Projects/MagicWand/server && npx tsx src/index.ts

# Terminal 2
cd /mnt/d/Projects/MagicWand/web && npm run dev
```

Open http://localhost:5173 → should show login page → enter `admin@magicwand.local` / `changeme` → should redirect to `/dashboard`.

- [ ] **Step 3: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/src/pages/Login.tsx
git commit -m "feat: login page with dark theme and auth integration"
```

---

## Phase 2: Agent + Computers

### Task 7: Computer CRUD Routes

**Files:**
- Create: `server/src/routes/computers.ts`
- Modify: `server/src/index.ts` (mount route)

- [ ] **Step 1: Create computer routes**

```typescript
// server/src/routes/computers.ts
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List all computers (exclude unenrolled ones with pending hostname)
router.get('/', async (req, res) => {
  const computers = await prisma.computer.findMany({
    where: { userId: req.userId, hostname: { not: 'pending' } },
    select: {
      id: true, name: true, hostname: true, os: true,
      cpuModel: true, ramTotalMb: true, isOnline: true,
      lastSeen: true, ipAddress: true, agentVersion: true,
      createdAt: true, updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(computers);
});

// Generate enrollment token
router.post('/', async (req, res) => {
  const name = req.body.name || 'New Computer';
  const enrollToken = crypto.randomBytes(16).toString('hex');
  const enrollExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const agentSecret = crypto.randomBytes(32).toString('hex');

  const computer = await prisma.computer.create({
    data: {
      userId: req.userId!,
      name,
      hostname: 'pending',
      os: 'pending',
      agentSecret,
      enrollToken,
      enrollExpiry,
    },
  });

  res.json({
    id: computer.id,
    enrollToken,
    enrollCommand: `magicwand-agent --enroll ${enrollToken} --server ${req.protocol}://${req.get('host')}`,
  });
});

// Get computer details
router.get('/:id', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
    select: {
      id: true, name: true, hostname: true, os: true,
      cpuModel: true, ramTotalMb: true, isOnline: true,
      lastSeen: true, ipAddress: true, agentVersion: true,
      createdAt: true, updatedAt: true,
    },
  });

  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }
  res.json(computer);
});

// Update computer name
const updateSchema = z.object({ name: z.string().min(1).max(100) });

router.put('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid name.' });
    return;
  }

  const computer = await prisma.computer.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: { name: parsed.data.name },
  });

  if (computer.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }
  res.json({ success: true });
});

// Delete computer
router.delete('/:id', async (req, res) => {
  const result = await prisma.computer.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });

  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }
  // TODO: disconnect agent WebSocket if online
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: Mount in index.ts**

Add to `server/src/index.ts`:
```typescript
import computerRoutes from './routes/computers.js';
app.use('/api/computers', computerRoutes);
```

- [ ] **Step 3: Verify CRUD works**

```bash
# Login and get cookie
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@magicwand.local","password":"changeme"}'

# Create computer (enrollment)
curl -b cookies.txt -X POST http://localhost:3001/api/computers \
  -H 'Content-Type: application/json' -d '{"name":"Test PC"}'

# List computers
curl -b cookies.txt http://localhost:3001/api/computers
```

Expected: Create returns `{id, enrollToken, enrollCommand}`. List returns array with one computer.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/routes/computers.ts server/src/index.ts
git commit -m "feat: computer CRUD routes with enrollment token generation"
```

---

### Task 8: Agent Enrollment Route

**Files:**
- Create: `server/src/routes/agent.ts`
- Modify: `server/src/index.ts` (mount route)

- [ ] **Step 1: Create agent enrollment route**

```typescript
// server/src/routes/agent.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';

const router = Router();

const enrollSchema = z.object({
  token: z.string().min(1),
  hostname: z.string().min(1),
  os: z.string().min(1),
  cpuModel: z.string().optional(),
  ramTotalMb: z.number().optional(),
  agentVersion: z.string().optional(),
});

router.post('/enroll', async (req, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid enrollment data.' });
    return;
  }

  const { token, hostname, os, cpuModel, ramTotalMb, agentVersion } = parsed.data;

  // Find computer with this enrollment token
  const computer = await prisma.computer.findUnique({
    where: { enrollToken: token },
  });

  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid enrollment token.' });
    return;
  }

  // Check expiry
  if (computer.enrollExpiry && computer.enrollExpiry < new Date()) {
    res.status(410).json({ error: 'TOKEN_EXPIRED', message: 'Enrollment token has expired.' });
    return;
  }

  // Update computer with machine info, clear enrollment token
  const updated = await prisma.computer.update({
    where: { id: computer.id },
    data: {
      hostname,
      os,
      cpuModel: cpuModel || null,
      ramTotalMb: ramTotalMb || null,
      agentVersion: agentVersion || null,
      enrollToken: null,
      enrollExpiry: null,
      ipAddress: req.ip || null,
    },
  });

  res.json({
    agentSecret: updated.agentSecret,
    computerId: updated.id,
  });
});

export default router;
```

- [ ] **Step 2: Mount in index.ts**

Add to `server/src/index.ts`:
```typescript
import agentRoutes from './routes/agent.js';
app.use('/api/agent', agentRoutes);
```

- [ ] **Step 3: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/routes/agent.ts server/src/index.ts
git commit -m "feat: agent enrollment endpoint with token validation"
```

---

### Task 9: Python Agent — Config, Connection, Enrollment

**Files:**
- Create: `agent/main.py`
- Create: `agent/config.py`
- Create: `agent/connection.py`
- Create: `agent/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
websockets>=12.0
mss>=9.0
psutil>=5.9
pywin32>=306
Pillow>=10.0
requests>=2.31
```

- [ ] **Step 2: Create config.py**

```python
# agent/config.py
import json
import os
import sys

def get_config_dir() -> str:
    if sys.platform == "win32":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
    else:
        base = os.path.expanduser("~")
    return os.path.join(base, "MagicWand")

def get_config_path() -> str:
    return os.path.join(get_config_dir(), "config.json")

def load_config() -> dict | None:
    path = get_config_path()
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)

def save_config(data: dict) -> None:
    config_dir = get_config_dir()
    os.makedirs(config_dir, exist_ok=True)
    path = get_config_path()
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Config saved to {path}")
```

- [ ] **Step 3: Create connection.py**

```python
# agent/connection.py
import asyncio
import json
import time
import websockets
from websockets.asyncio.client import connect

class AgentConnection:
    def __init__(self, server_url: str, agent_secret: str, computer_id: str, command_handler=None):
        self.server_url = server_url.rstrip("/")
        self.agent_secret = agent_secret
        self.computer_id = computer_id
        self.command_handler = command_handler
        self.ws = None
        self._backoff = 1
        self._max_backoff = 60
        self._running = True

    async def connect_and_run(self):
        while self._running:
            try:
                ws_url = self.server_url.replace("http://", "ws://").replace("https://", "wss://")
                ws_url = f"{ws_url}/ws/agent"
                print(f"Connecting to {ws_url}...")

                async with connect(ws_url) as ws:
                    self.ws = ws
                    self._backoff = 1
                    print("Connected!")

                    # Authenticate
                    await ws.send(json.dumps({
                        "type": "auth",
                        "agentSecret": self.agent_secret,
                        "computerId": self.computer_id,
                    }))

                    # Start heartbeat task
                    heartbeat_task = asyncio.create_task(self._heartbeat_loop())

                    try:
                        async for message in ws:
                            data = json.loads(message)
                            if data.get("type") == "command" and self.command_handler:
                                asyncio.create_task(self._handle_command(data))
                    finally:
                        heartbeat_task.cancel()

            except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
                print(f"Connection lost: {e}. Reconnecting in {self._backoff}s...")
                await asyncio.sleep(self._backoff)
                self._backoff = min(self._backoff * 2, self._max_backoff)

    async def _heartbeat_loop(self):
        import psutil
        while True:
            try:
                await self.ws.send(json.dumps({
                    "type": "heartbeat",
                    "cpu_percent": psutil.cpu_percent(interval=1),
                    "ram_percent": psutil.virtual_memory().percent,
                    "uptime_seconds": int(time.time() - psutil.boot_time()),
                }))
            except Exception:
                return
            await asyncio.sleep(30)

    async def _handle_command(self, data: dict):
        request_id = data.get("id")
        command = data.get("command")
        params = data.get("params", {})

        try:
            result = await self.command_handler(command, params)
            await self.ws.send(json.dumps({
                "id": request_id,
                "type": "command_result",
                "success": True,
                "data": result,
            }))
        except Exception as e:
            await self.ws.send(json.dumps({
                "id": request_id,
                "type": "command_result",
                "success": False,
                "error": str(e),
            }))

    def stop(self):
        self._running = False
```

- [ ] **Step 4: Create main.py**

```python
# agent/main.py
import argparse
import asyncio
import json
import sys
import platform
import psutil
import requests

from config import load_config, save_config
from connection import AgentConnection

AGENT_VERSION = "0.1.0"

def get_system_metadata() -> dict:
    uname = platform.uname()
    mem = psutil.virtual_memory()
    return {
        "hostname": platform.node(),
        "os": f"{uname.system} {uname.release} {uname.version}",
        "cpuModel": platform.processor() or "Unknown",
        "ramTotalMb": round(mem.total / (1024 * 1024)),
        "agentVersion": AGENT_VERSION,
    }

def enroll(token: str, server_url: str) -> None:
    metadata = get_system_metadata()
    metadata["token"] = token

    url = f"{server_url.rstrip('/')}/api/agent/enroll"
    print(f"Enrolling with {url}...")

    try:
        resp = requests.post(url, json=metadata, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"Enrollment failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Server response: {e.response.text}")
        sys.exit(1)

    data = resp.json()
    save_config({
        "server_url": server_url,
        "agent_secret": data["agentSecret"],
        "computer_id": data["computerId"],
    })
    print(f"Enrolled successfully! Computer ID: {data['computerId']}")

async def handle_command(command: str, params: dict) -> dict:
    """Dispatch to the appropriate command handler. Implemented in Task 14+."""
    # Placeholder — will import from commands/ modules later
    return {"error": f"Command '{command}' not yet implemented"}

def main():
    parser = argparse.ArgumentParser(description="MagicWand Agent")
    parser.add_argument("--enroll", metavar="TOKEN", help="Enrollment token")
    parser.add_argument("--server", metavar="URL", help="Server URL (required for enrollment)")
    args = parser.parse_args()

    if args.enroll:
        if not args.server:
            print("Error: --server is required for enrollment")
            sys.exit(1)
        enroll(args.enroll, args.server)
        return

    config = load_config()
    if not config:
        print("Error: Not enrolled. Run with --enroll <TOKEN> --server <URL> first.")
        sys.exit(1)

    print(f"MagicWand Agent v{AGENT_VERSION}")
    print(f"Computer ID: {config['computer_id']}")
    print(f"Server: {config['server_url']}")

    conn = AgentConnection(
        server_url=config["server_url"],
        agent_secret=config["agent_secret"],
        computer_id=config["computer_id"],
        command_handler=handle_command,
    )

    asyncio.run(conn.connect_and_run())

if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add agent/
git commit -m "feat: Python agent with config, WebSocket connection, enrollment"
```

---

### Task 10: Server Agent WebSocket Handler

**Files:**
- Create: `server/src/ws/agentHandler.ts`
- Modify: `server/src/index.ts` (wire up WebSocket upgrade)

- [ ] **Step 1: Create agentHandler.ts**

```typescript
// server/src/ws/agentHandler.ts
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
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
          data: {
            lastSeen: new Date(),
            // Store heartbeat data in a simple way — we'll query it later
          },
        });
        // Broadcast heartbeat to dashboard clients
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

// Dashboard status broadcasting — will be connected in Task 12
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
```

- [ ] **Step 2: Wire up WebSocket upgrade in index.ts**

Replace the `server.on('upgrade', ...)` block in `server/src/index.ts`:

```typescript
import { WebSocketServer } from 'ws';
import { setupAgentWebSocket, addDashboardClient } from './ws/agentHandler.js';
import { validateWsToken } from './routes/auth.js';
import { URL } from 'url';

const agentWss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });
const chatWss = new WebSocketServer({ noServer: true });

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
    // Validate session token
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
```

Remove the old `wss` variable and `server.on('upgrade', ...)` block.

- [ ] **Step 3: Verify agent can connect**

Start the server, then test enrollment + connection:

```bash
# In server terminal
cd /mnt/d/Projects/MagicWand/server && npx tsx src/index.ts

# In another terminal — create enrollment token
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@magicwand.local","password":"changeme"}'
curl -b cookies.txt -X POST http://localhost:3001/api/computers \
  -H 'Content-Type: application/json' -d '{"name":"Test PC"}'

# Copy the enrollToken from the response, then:
cd /mnt/d/Projects/MagicWand/agent
pip install -r requirements.txt requests
python main.py --enroll <TOKEN> --server http://localhost:3001
python main.py  # should connect and start heartbeating
```

Expected: Server logs "Agent connected: Test PC (...)". Agent prints "Connected!"

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/ws/ server/src/index.ts
git commit -m "feat: agent WebSocket handler with auth, heartbeat, command dispatch"
```

---

### Task 11: Dashboard Page + Computer Cards

**Files:**
- Create: `web/src/pages/Dashboard.tsx`
- Create: `web/src/components/ComputerCard.tsx`
- Create: `web/src/components/StatusIndicator.tsx`
- Create: `web/src/stores/computerStore.ts`
- Modify: `web/src/App.tsx` (add route)

- [ ] **Step 1: Create computer store**

```typescript
// web/src/stores/computerStore.ts
import { create } from 'zustand';
import { api } from '../lib/api';

export interface Computer {
  id: string;
  name: string;
  hostname: string;
  os: string;
  cpuModel: string | null;
  ramTotalMb: number | null;
  isOnline: boolean;
  lastSeen: string | null;
  ipAddress: string | null;
  agentVersion: string | null;
  // Live heartbeat data (from WebSocket, not DB)
  cpuPercent?: number;
  ramPercent?: number;
  uptimeSeconds?: number;
}

interface ComputerState {
  computers: Computer[];
  loading: boolean;
  fetchComputers: () => Promise<void>;
  updateStatus: (computerId: string, isOnline: boolean) => void;
  updateHeartbeat: (computerId: string, data: { cpuPercent: number; ramPercent: number; uptimeSeconds: number }) => void;
  removeComputer: (id: string) => void;
}

export const useComputerStore = create<ComputerState>((set, get) => ({
  computers: [],
  loading: true,

  fetchComputers: async () => {
    try {
      const data = await api.get<Computer[]>('/api/computers');
      set({ computers: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateStatus: (computerId, isOnline) => {
    set((state) => ({
      computers: state.computers.map((c) =>
        c.id === computerId ? { ...c, isOnline } : c
      ),
    }));
  },

  updateHeartbeat: (computerId, data) => {
    set((state) => ({
      computers: state.computers.map((c) =>
        c.id === computerId ? { ...c, ...data, isOnline: true } : c
      ),
    }));
  },

  removeComputer: (id) => {
    set((state) => ({
      computers: state.computers.filter((c) => c.id !== id),
    }));
  },
}));
```

- [ ] **Step 2: Create StatusIndicator component**

```tsx
// web/src/components/StatusIndicator.tsx
export function StatusIndicator({ online }: { online: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          online
            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
            : 'bg-red-500'
        }`}
      />
      <span className={`text-xs ${online ? 'text-green-500' : 'text-red-500'}`}>
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Create ComputerCard component**

```tsx
// web/src/components/ComputerCard.tsx
import { useNavigate } from 'react-router-dom';
import { Monitor, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Computer, useComputerStore } from '../stores/computerStore';
import { StatusIndicator } from './StatusIndicator';
import { api } from '../lib/api';

function ResourceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function ComputerCard({ computer }: { computer: Computer }) {
  const navigate = useNavigate();
  const removeComputer = useComputerStore((s) => s.removeComputer);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${computer.name}"?`)) return;
    await api.del(`/api/computers/${computer.id}`);
    removeComputer(computer.id);
  };

  const lastSeen = computer.lastSeen
    ? new Date(computer.lastSeen).toLocaleString()
    : 'Never';

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-lg p-5 transition-opacity ${
        !computer.isOnline ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-sm">{computer.name}</h3>
          <p className="text-xs text-gray-500 font-mono">{computer.hostname}</p>
        </div>
        <StatusIndicator online={computer.isOnline} />
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 space-y-1 mb-3">
        <div className="flex gap-1">
          <span className="text-gray-600">OS</span> {computer.os === 'pending' ? '—' : computer.os}
        </div>
        {computer.isOnline && computer.cpuPercent != null ? (
          <div className="flex gap-4">
            <span><span className="text-gray-600">CPU</span> {Math.round(computer.cpuPercent)}%</span>
            <span><span className="text-gray-600">RAM</span> {Math.round(computer.ramPercent || 0)}%</span>
          </div>
        ) : (
          <div className="text-gray-600">Last seen: {lastSeen}</div>
        )}
      </div>

      {/* Resource bars */}
      <div className="flex gap-2 mb-4">
        <ResourceBar value={computer.cpuPercent || 0} color="bg-blue-500" />
        <ResourceBar value={computer.ramPercent || 0} color="bg-purple-500" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 bg-purple-600/20 border-purple-600/40 text-purple-400 hover:bg-purple-600/30 text-xs"
          disabled={!computer.isOnline}
          onClick={() => navigate(`/computers/${computer.id}?tab=chat`)}
        >
          <MessageSquare className="w-3 h-3 mr-1" /> AI Chat
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-gray-700 text-gray-400 hover:bg-gray-800 text-xs"
          onClick={() => navigate(`/computers/${computer.id}`)}
        >
          <Monitor className="w-3 h-3 mr-1" /> Details
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-red-400 px-2"
          onClick={handleDelete}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Dashboard page**

```tsx
// web/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComputerStore } from '../stores/computerStore';
import { ComputerCard } from '../components/ComputerCard';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { computers, loading, fetchComputers } = useComputerStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchComputers();
  }, [fetchComputers]);

  const onlineCount = computers.filter((c) => c.isOnline).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-xl font-bold text-purple-400">✦ MagicWand</span>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Computer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400"
            onClick={async () => { await logout(); navigate('/login'); }}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Your Computers</h2>
          <p className="text-sm text-gray-500">
            {computers.length} machine{computers.length !== 1 ? 's' : ''} — {onlineCount} online
          </p>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : computers.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">No computers registered</p>
            <p className="text-sm">Click "Add Computer" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {computers.map((c) => (
              <ComputerCard key={c.id} computer={c} />
            ))}
          </div>
        )}
      </main>

      {/* AddComputerModal will be added in Task 12 */}
    </div>
  );
}
```

Note: Add `import { useState } from 'react';` at the top.

- [ ] **Step 5: Update App.tsx with dashboard route**

Replace the inline dashboard placeholder in `web/src/App.tsx`:

```typescript
import { Dashboard } from './pages/Dashboard';

// In Routes:
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
```

- [ ] **Step 6: Verify dashboard renders**

Start server + web, log in. Dashboard should show "No computers registered" with the header bar and Add Computer button.

- [ ] **Step 7: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/src/
git commit -m "feat: dashboard page with computer cards, status indicators, computer store"
```

---

### Task 12: Add Computer Modal

**Files:**
- Create: `web/src/components/AddComputerModal.tsx`
- Modify: `web/src/pages/Dashboard.tsx` (render modal)

- [ ] **Step 1: Create AddComputerModal**

```tsx
// web/src/components/AddComputerModal.tsx
import { useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { api } from '../lib/api';
import { useComputerStore } from '../stores/computerStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface EnrollmentData {
  id: string;
  enrollToken: string;
  enrollCommand: string;
}

export function AddComputerModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fetchComputers = useComputerStore((s) => s.fetchComputers);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await api.post<EnrollmentData>('/api/computers', { name: name || 'New Computer' });
      setEnrollment(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName('');
    setEnrollment(null);
    setCopied(false);
    fetchComputers();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Computer</DialogTitle>
        </DialogHeader>

        {!enrollment ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Computer Name (optional)</label>
              <Input
                placeholder="e.g., Gaming PC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Generate Install Command
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Run this command on the remote computer to install the agent:
            </p>

            <div className="relative">
              <pre className="bg-gray-800 border border-gray-700 rounded-lg p-3 pr-12 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
                python main.py --enroll {enrollment.enrollToken} --server {window.location.origin}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={() => handleCopy(
                  `python main.py --enroll ${enrollment.enrollToken} --server ${window.location.origin}`
                )}
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for agent to connect...
            </div>

            <p className="text-xs text-gray-600">
              Token expires in 15 minutes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Import and render in Dashboard**

In `web/src/pages/Dashboard.tsx`, add:

```typescript
import { AddComputerModal } from '../components/AddComputerModal';

// Inside the return, after </main>:
<AddComputerModal open={showAddModal} onClose={() => setShowAddModal(false)} />
```

- [ ] **Step 3: Verify modal works**

Click "Add Computer" → should show modal with name input → click "Generate Install Command" → should show the enrollment command.

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/src/components/AddComputerModal.tsx web/src/pages/Dashboard.tsx
git commit -m "feat: add computer modal with enrollment token generation"
```

---

### Task 13: Dashboard WebSocket for Live Status

**Files:**
- Create: `web/src/hooks/useWebSocket.ts`
- Modify: `web/src/pages/Dashboard.tsx` (connect WebSocket)

- [ ] **Step 1: Create useWebSocket hook**

```typescript
// web/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  enabled?: boolean;
}

export function useWebSocket({ url, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let backoff = 1000;
    let alive = true;

    function connect() {
      if (!alive) return;
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        if (alive) {
          reconnectTimeout = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 30000);
        }
      };
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [url, enabled]);

  return wsRef;
}
```

- [ ] **Step 2: Connect Dashboard to WebSocket**

In `web/src/pages/Dashboard.tsx`, add:

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuthStore } from '../stores/authStore';

// Inside the Dashboard component, get the session token for WS auth:
// We need a way to get the session token. Since it's in a signed httpOnly cookie,
// the browser can't read it. Instead, add a /api/auth/ws-token endpoint that returns it.

// For now, use a simpler approach: the dashboard WebSocket will authenticate via
// a short-lived token obtained from the server.
```

Actually, since the session cookie is httpOnly and signed, the browser can't read it to pass as a query param. We need to handle this differently. Let's add a ws-token endpoint to the auth routes.

Add to `server/src/routes/auth.ts`:

```typescript
// Returns a short-lived token for WebSocket connections
router.get('/ws-token', requireAuth, async (req, res) => {
  // Reuse the session token from the signed cookie
  const token = req.signedCookies?.session;
  res.json({ token });
});
```

Then in the Dashboard, fetch the WS token and connect:

```typescript
// web/src/pages/Dashboard.tsx — add inside component:
const [wsToken, setWsToken] = useState<string | null>(null);
const { updateStatus, updateHeartbeat } = useComputerStore();

useEffect(() => {
  api.get<{ token: string }>('/api/auth/ws-token').then((d) => setWsToken(d.token));
}, []);

const wsUrl = wsToken
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/dashboard?token=${wsToken}`
  : '';

useWebSocket({
  url: wsUrl,
  enabled: !!wsToken,
  onMessage: (data) => {
    if (data.type === 'status') {
      updateStatus(data.computerId, data.isOnline);
    } else if (data.type === 'heartbeat') {
      updateHeartbeat(data.computerId, {
        cpuPercent: data.cpuPercent,
        ramPercent: data.ramPercent,
        uptimeSeconds: data.uptimeSeconds,
      });
    }
  },
});
```

- [ ] **Step 3: Verify live status updates**

1. Start server + web
2. Log in, enroll a machine, run the agent
3. Dashboard should show the computer card go from offline → online with live CPU/RAM stats

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/src/hooks/useWebSocket.ts web/src/pages/Dashboard.tsx server/src/routes/auth.ts
git commit -m "feat: live dashboard status via WebSocket with heartbeat updates"
```

---

## Phase 3: Agent Commands

### Task 14: Agent Security Module

**Files:**
- Create: `agent/security.py`

- [ ] **Step 1: Create security.py with dangerous command blocklist**

```python
# agent/security.py
import re
import os

# Patterns that indicate dangerous commands
DANGEROUS_PATTERNS = [
    # Disk/partition destruction
    r'\bformat\b.*[a-zA-Z]:',
    r'\bdiskpart\b',
    # Bulk deletion
    r'\bdel\b.*/s.*/q.*[a-zA-Z]:\\',
    r'\brmdir\b.*/s.*[a-zA-Z]:\\',
    r'Remove-Item.*-Recurse.*[a-zA-Z]:\\',
    r'\brm\b\s+-rf\s+/',
    # System shutdown
    r'\bshutdown\b',
    r'\bRestart-Computer\b',
    r'\bStop-Computer\b',
    # Registry destruction
    r'\breg\b\s+delete\s+HKLM',
    r'Remove-ItemProperty.*HKLM',
    # Security bypass
    r'Set-ExecutionPolicy\s+Unrestricted',
    r'Set-MpPreference\s+-DisableRealtimeMonitoring',
    r'netsh\s+advfirewall\s+set\s+.*state\s+off',
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in DANGEROUS_PATTERNS]

# Blocked paths for write_file
BLOCKED_WRITE_PATHS = [
    r'C:\\Windows\\',
    r'C:\\Program Files\\',
    r'C:\\Program Files \(x86\)\\',
    r'C:\\Boot\\',
    r'C:\\Recovery\\',
    r'C:\\System Volume Information\\',
]

COMPILED_WRITE_BLOCKS = [re.compile(p, re.IGNORECASE) for p in BLOCKED_WRITE_PATHS]

MAX_WRITE_SIZE = 100 * 1024  # 100KB
MAX_OUTPUT_SIZE = 50 * 1024  # 50KB

def is_dangerous_command(command: str) -> str | None:
    """Returns a reason string if the command is dangerous, None if safe."""
    for pattern in COMPILED_PATTERNS:
        if pattern.search(command):
            return f"Command blocked by safety filter: matches pattern '{pattern.pattern}'"
    return None

def is_blocked_write_path(path: str) -> str | None:
    """Returns a reason string if the path is blocked for writing, None if allowed."""
    # Canonicalize path
    try:
        canonical = os.path.realpath(os.path.abspath(path))
    except (ValueError, OSError):
        return f"Invalid path: {path}"

    for pattern in COMPILED_WRITE_BLOCKS:
        if pattern.match(canonical):
            return f"Write blocked: path '{canonical}' is in a protected directory"
    return None

def truncate_output(output: str) -> str:
    """Truncate output to MAX_OUTPUT_SIZE bytes."""
    if len(output.encode('utf-8', errors='replace')) > MAX_OUTPUT_SIZE:
        truncated = output.encode('utf-8', errors='replace')[:MAX_OUTPUT_SIZE].decode('utf-8', errors='replace')
        return truncated + "\n\n[OUTPUT TRUNCATED — exceeded 50KB limit]"
    return output
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add agent/security.py
git commit -m "feat: agent security module with dangerous command blocklist and path restrictions"
```

---

### Task 15: Agent Command — execute_command

**Files:**
- Create: `agent/commands/execute.py`

- [ ] **Step 1: Create execute.py**

```python
# agent/commands/execute.py
import subprocess
import sys
from security import is_dangerous_command, truncate_output

async def execute_command(params: dict) -> dict:
    command = params.get("command", "")
    shell = params.get("shell", "powershell")
    timeout = min(params.get("timeout", 30), 120)

    # Safety check
    danger = is_dangerous_command(command)
    if danger:
        return {"stdout": "", "stderr": danger, "exit_code": -1}

    # Build command based on shell
    if shell == "powershell":
        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command", command]
    elif shell == "cmd":
        cmd = ["cmd", "/c", command]
    else:
        cmd = ["bash", "-c", command]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="C:\\" if sys.platform == "win32" else "/",
        )
        return {
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds",
            "exit_code": -1,
        }
    except Exception as e:
        return {
            "stdout": "",
            "stderr": str(e),
            "exit_code": -1,
        }
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add agent/commands/execute.py
git commit -m "feat: agent execute_command with safety checks and timeout"
```

---

### Task 16: Agent Command — screenshot

**Files:**
- Create: `agent/commands/screenshot.py`

- [ ] **Step 1: Create screenshot.py**

```python
# agent/commands/screenshot.py
import base64
import io
import mss
from PIL import Image

async def screenshot(params: dict) -> dict:
    monitor_index = params.get("monitor", 0)

    with mss.mss() as sct:
        monitors = sct.monitors
        if monitor_index >= len(monitors):
            monitor_index = 0

        # monitors[0] is the combined screen, monitors[1+] are individual
        monitor = monitors[monitor_index]
        img = sct.grab(monitor)

        # Convert to PIL Image and then to JPEG
        pil_img = Image.frombytes("RGB", img.size, img.bgra, "raw", "BGRX")

        # Resize if very large (> 1920px wide) to save bandwidth
        max_width = 1920
        if pil_img.width > max_width:
            ratio = max_width / pil_img.width
            new_size = (max_width, int(pil_img.height * ratio))
            pil_img = pil_img.resize(new_size, Image.LANCZOS)

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=75)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        return {
            "image_base64": b64,
            "width": pil_img.width,
            "height": pil_img.height,
            "format": "jpeg",
        }
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add agent/commands/screenshot.py
git commit -m "feat: agent screenshot command with JPEG compression"
```

---

### Task 17: Agent Command — system_info

**Files:**
- Create: `agent/commands/system_info.py`

- [ ] **Step 1: Create system_info.py**

```python
# agent/commands/system_info.py
import platform
import time
import psutil

async def system_info(params: dict) -> dict:
    uname = platform.uname()
    mem = psutil.virtual_memory()
    disk_partitions = psutil.disk_partitions()

    disks = []
    for part in disk_partitions:
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total_gb": round(usage.total / (1024**3), 1),
                "used_gb": round(usage.used / (1024**3), 1),
                "free_gb": round(usage.free / (1024**3), 1),
                "percent": usage.percent,
            })
        except (PermissionError, OSError):
            continue

    nets = []
    for name, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family.name == "AF_INET":
                nets.append({"interface": name, "ip": addr.address, "netmask": addr.netmask})

    return {
        "hostname": platform.node(),
        "os": f"{uname.system} {uname.release}",
        "os_version": uname.version,
        "cpu_model": platform.processor() or "Unknown",
        "cpu_count": psutil.cpu_count(),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "ram_total_mb": round(mem.total / (1024**2)),
        "ram_used_mb": round(mem.used / (1024**2)),
        "ram_percent": mem.percent,
        "disks": disks,
        "network_interfaces": nets,
        "uptime_seconds": int(time.time() - psutil.boot_time()),
    }
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add agent/commands/system_info.py
git commit -m "feat: agent system_info command"
```

---

### Task 18: Agent Commands — processes, event_logs, services, software, files, network

**Files:**
- Create: `agent/commands/processes.py`
- Create: `agent/commands/event_logs.py`
- Create: `agent/commands/services.py`
- Create: `agent/commands/software.py`
- Create: `agent/commands/files.py`
- Create: `agent/commands/network.py`

- [ ] **Step 1: Create processes.py**

```python
# agent/commands/processes.py
import psutil

async def list_processes(params: dict) -> dict:
    sort_by = params.get("sort_by", "memory")
    top_n = min(params.get("top_n", 30), 100)

    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu_percent": round(info["cpu_percent"] or 0, 1),
                "memory_percent": round(info["memory_percent"] or 0, 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    key = "memory_percent" if sort_by == "memory" else "cpu_percent" if sort_by == "cpu" else "name"
    reverse = key != "name"
    procs.sort(key=lambda p: p.get(key, 0), reverse=reverse)

    return {"processes": procs[:top_n], "total_count": len(procs)}
```

- [ ] **Step 2: Create event_logs.py**

```python
# agent/commands/event_logs.py
import sys
from datetime import datetime, timedelta

async def get_event_logs(params: dict) -> dict:
    if sys.platform != "win32":
        return {"error": "Event logs are only available on Windows"}

    import win32evtlog
    import win32evtlogutil

    log_name = params.get("log_name", "System")
    level = params.get("level")
    last_n = min(params.get("last_n", 20), 100)
    hours_back = params.get("hours_back")

    level_map = {
        "Error": 2,
        "Warning": 3,
        "Information": 4,
        "Critical": 1,
    }

    cutoff = None
    if hours_back:
        cutoff = datetime.now() - timedelta(hours=hours_back)

    try:
        hand = win32evtlog.OpenEventLog(None, log_name)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ

        entries = []
        while len(entries) < last_n:
            events = win32evtlog.ReadEventLog(hand, flags, 0)
            if not events:
                break

            for event in events:
                if len(entries) >= last_n:
                    break

                event_time = datetime(
                    event.TimeGenerated.year, event.TimeGenerated.month,
                    event.TimeGenerated.day, event.TimeGenerated.hour,
                    event.TimeGenerated.minute, event.TimeGenerated.second,
                )

                if cutoff and event_time < cutoff:
                    break

                if level and level_map.get(level) and event.EventType != level_map[level]:
                    continue

                entries.append({
                    "time": event_time.isoformat(),
                    "source": event.SourceName,
                    "event_id": event.EventID & 0xFFFF,
                    "level": {1: "Critical", 2: "Error", 3: "Warning", 4: "Information"}.get(event.EventType, "Unknown"),
                    "message": win32evtlogutil.SafeFormatMessage(event, log_name)[:2000],
                })

        win32evtlog.CloseEventLog(hand)
        return {"log_name": log_name, "entries": entries}

    except Exception as e:
        return {"error": str(e)}
```

- [ ] **Step 3: Create services.py**

```python
# agent/commands/services.py
import subprocess
import sys

async def manage_service(params: dict) -> dict:
    service_name = params.get("service_name", "")
    action = params.get("action", "status")

    if not service_name:
        return {"error": "service_name is required"}

    if sys.platform == "win32":
        if action == "status":
            cmd = f'Get-Service -Name "{service_name}" | Select-Object Name, Status, DisplayName | ConvertTo-Json'
        elif action == "start":
            cmd = f'Start-Service -Name "{service_name}"; Get-Service -Name "{service_name}" | Select-Object Name, Status | ConvertTo-Json'
        elif action == "stop":
            cmd = f'Stop-Service -Name "{service_name}" -Force; Get-Service -Name "{service_name}" | Select-Object Name, Status | ConvertTo-Json'
        elif action == "restart":
            cmd = f'Restart-Service -Name "{service_name}" -Force; Get-Service -Name "{service_name}" | Select-Object Name, Status | ConvertTo-Json'
        else:
            return {"error": f"Unknown action: {action}"}

        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
            capture_output=True, text=True, timeout=30,
        )
        return {"stdout": result.stdout.strip(), "stderr": result.stderr.strip(), "exit_code": result.returncode}
    else:
        return {"error": "Service management currently only supports Windows"}
```

- [ ] **Step 4: Create software.py**

```python
# agent/commands/software.py
import subprocess
import sys

async def get_installed_software(params: dict) -> dict:
    name_filter = params.get("filter", "")

    if sys.platform != "win32":
        return {"error": "Only available on Windows"}

    cmd = 'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object { $_.DisplayName } | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName | ConvertTo-Json -Compress'

    if name_filter:
        cmd = f'Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object {{ $_.DisplayName -like "*{name_filter}*" }} | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName | ConvertTo-Json -Compress'

    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=30,
    )

    from security import truncate_output
    return {"stdout": truncate_output(result.stdout.strip()), "exit_code": result.returncode}
```

- [ ] **Step 5: Create files.py**

```python
# agent/commands/files.py
from security import is_blocked_write_path, MAX_WRITE_SIZE

async def read_file(params: dict) -> dict:
    path = params.get("path", "")
    max_lines = params.get("max_lines", 200)

    if not path:
        return {"error": "path is required"}

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = []
            for i, line in enumerate(f):
                if i >= max_lines:
                    lines.append(f"\n[TRUNCATED — showing first {max_lines} lines]")
                    break
                lines.append(line)
        return {"content": "".join(lines), "path": path}
    except FileNotFoundError:
        return {"error": f"File not found: {path}"}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}

async def write_file(params: dict) -> dict:
    path = params.get("path", "")
    content = params.get("content", "")

    if not path:
        return {"error": "path is required"}

    # Check blocked paths
    blocked = is_blocked_write_path(path)
    if blocked:
        return {"error": blocked}

    # Check size
    if len(content.encode("utf-8")) > MAX_WRITE_SIZE:
        return {"error": f"Content exceeds maximum size of {MAX_WRITE_SIZE // 1024}KB"}

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"success": True, "path": path, "bytes_written": len(content.encode("utf-8"))}
    except PermissionError:
        return {"error": f"Permission denied: {path}"}
    except Exception as e:
        return {"error": str(e)}
```

- [ ] **Step 6: Create network.py**

```python
# agent/commands/network.py
import subprocess
import sys
import socket

async def network_diagnostics(params: dict) -> dict:
    action = params.get("action", "")
    target = params.get("target", "")
    port = params.get("port")

    if not action or not target:
        return {"error": "action and target are required"}

    if action == "ping":
        flag = "-n" if sys.platform == "win32" else "-c"
        result = subprocess.run(
            ["ping", flag, "4", target],
            capture_output=True, text=True, timeout=30,
        )
        return {"stdout": result.stdout, "exit_code": result.returncode}

    elif action == "traceroute":
        cmd = "tracert" if sys.platform == "win32" else "traceroute"
        result = subprocess.run(
            [cmd, target],
            capture_output=True, text=True, timeout=60,
        )
        return {"stdout": result.stdout, "exit_code": result.returncode}

    elif action == "nslookup":
        result = subprocess.run(
            ["nslookup", target],
            capture_output=True, text=True, timeout=15,
        )
        return {"stdout": result.stdout, "exit_code": result.returncode}

    elif action == "port_check":
        if not port:
            return {"error": "port is required for port_check"}
        try:
            sock = socket.create_connection((target, port), timeout=5)
            sock.close()
            return {"open": True, "target": target, "port": port}
        except (socket.timeout, ConnectionRefusedError, OSError) as e:
            return {"open": False, "target": target, "port": port, "error": str(e)}

    else:
        return {"error": f"Unknown action: {action}"}
```

- [ ] **Step 7: Wire all commands into main.py**

Update the `handle_command` function in `agent/main.py`:

```python
async def handle_command(command: str, params: dict) -> dict:
    """Dispatch to the appropriate command handler."""
    from commands.execute import execute_command
    from commands.screenshot import screenshot
    from commands.system_info import system_info
    from commands.processes import list_processes
    from commands.event_logs import get_event_logs
    from commands.services import manage_service
    from commands.software import get_installed_software
    from commands.files import read_file, write_file
    from commands.network import network_diagnostics

    handlers = {
        "execute_command": execute_command,
        "screenshot": screenshot,
        "system_info": system_info,
        "list_processes": list_processes,
        "get_event_logs": get_event_logs,
        "manage_service": manage_service,
        "get_installed_software": get_installed_software,
        "read_file": read_file,
        "write_file": write_file,
        "network_diagnostics": network_diagnostics,
    }

    handler = handlers.get(command)
    if not handler:
        return {"error": f"Unknown command: {command}"}

    return await handler(params)
```

Also create the `agent/commands/__init__.py` file (empty).

- [ ] **Step 8: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add agent/
git commit -m "feat: all 10 agent commands with safety checks"
```

---

### Task 19: Server Agent Bridge

**Files:**
- Create: `server/src/services/agentBridge.ts`

The `sendAgentCommand` function already exists in `agentHandler.ts`. This task creates a higher-level service that the AI orchestrator and routes will use.

- [ ] **Step 1: Create agentBridge.ts**

```typescript
// server/src/services/agentBridge.ts
import { sendAgentCommand, isAgentOnline } from '../ws/agentHandler.js';

export class AgentOfflineError extends Error {
  constructor(computerId: string) {
    super('Computer is offline.');
    this.name = 'AgentOfflineError';
  }
}

export class AgentTimeoutError extends Error {
  constructor() {
    super('Agent did not respond within 60 seconds.');
    this.name = 'AgentTimeoutError';
  }
}

export async function executeAgentCommand(
  computerId: string,
  command: string,
  params: Record<string, any> = {},
): Promise<any> {
  if (!isAgentOnline(computerId)) {
    throw new AgentOfflineError(computerId);
  }

  try {
    return await sendAgentCommand(computerId, command, params, 60000);
  } catch (err: any) {
    if (err.message.includes('not connected')) {
      throw new AgentOfflineError(computerId);
    }
    if (err.message.includes('did not respond')) {
      throw new AgentTimeoutError();
    }
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/services/agentBridge.ts
git commit -m "feat: agent bridge service with offline/timeout error handling"
```

---

### Task 20: Computer Overview Tab

**Files:**
- Create: `web/src/pages/ComputerView.tsx`
- Create: `web/src/components/SystemInfoPanel.tsx`
- Modify: `web/src/App.tsx` (add route)

- [ ] **Step 1: Create SystemInfoPanel component**

```tsx
// web/src/components/SystemInfoPanel.tsx
import { useEffect, useState } from 'react';
import { HardDrive, Cpu, MemoryStick, Wifi, Clock } from 'lucide-react';
import { api } from '../lib/api';

interface SystemInfo {
  hostname: string;
  os: string;
  os_version: string;
  cpu_model: string;
  cpu_count: number;
  cpu_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_percent: number;
  disks: { device: string; mountpoint: string; total_gb: number; used_gb: number; percent: number }[];
  network_interfaces: { interface: string; ip: string }[];
  uptime_seconds: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

export function SystemInfoPanel({ computerId }: { computerId: string }) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    // This calls the AI chat endpoint with a system_info tool call
    // Or we can add a direct endpoint. For simplicity, use a direct endpoint.
    // We'll add a /api/computers/:id/system-info route that calls the agent directly.
    api.get<SystemInfo>(`/api/computers/${computerId}/system-info`)
      .then(setInfo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [computerId]);

  if (loading) return <div className="text-gray-500 p-4">Fetching system info...</div>;
  if (error) return <div className="text-red-400 p-4">{error}</div>;
  if (!info) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {/* OS Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4" /> System
        </h3>
        <div className="space-y-2 text-sm">
          <div><span className="text-gray-500">Hostname:</span> {info.hostname}</div>
          <div><span className="text-gray-500">OS:</span> {info.os}</div>
          <div><span className="text-gray-500">CPU:</span> {info.cpu_model} ({info.cpu_count} cores)</div>
          <div><span className="text-gray-500">Uptime:</span> {formatUptime(info.uptime_seconds)}</div>
        </div>
      </div>

      {/* CPU + RAM */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <MemoryStick className="w-4 h-4" /> Resources
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>CPU</span><span>{info.cpu_percent}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${info.cpu_percent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>RAM ({info.ram_used_mb}MB / {info.ram_total_mb}MB)</span><span>{info.ram_percent}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${info.ram_percent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Disks */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <HardDrive className="w-4 h-4" /> Disks
        </h3>
        <div className="space-y-2 text-sm">
          {info.disks.map((d) => (
            <div key={d.mountpoint}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{d.mountpoint} ({d.device})</span>
                <span>{d.used_gb}GB / {d.total_gb}GB</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.percent > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${d.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Wifi className="w-4 h-4" /> Network
        </h3>
        <div className="space-y-1 text-sm">
          {info.network_interfaces.map((n, i) => (
            <div key={i}>
              <span className="text-gray-500">{n.interface}:</span>{' '}
              <span className="font-mono text-xs">{n.ip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add system-info endpoint to server**

Add to `server/src/routes/computers.ts`:

```typescript
import { executeAgentCommand, AgentOfflineError } from '../services/agentBridge.js';

// Get live system info from agent
router.get('/:id/system-info', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }

  try {
    const info = await executeAgentCommand(computer.id, 'system_info', {});
    res.json(info);
  } catch (err) {
    if (err instanceof AgentOfflineError) {
      res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' });
      return;
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to get system info.' });
  }
});
```

- [ ] **Step 3: Create ComputerView page**

```tsx
// web/src/pages/ComputerView.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '../lib/api';
import { Computer } from '../stores/computerStore';
import { SystemInfoPanel } from '../components/SystemInfoPanel';
import { StatusIndicator } from '../components/StatusIndicator';

export function ComputerView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [computer, setComputer] = useState<Computer | null>(null);
  const defaultTab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    if (id) {
      api.get<Computer>(`/api/computers/${id}`).then(setComputer).catch(() => navigate('/dashboard'));
    }
  }, [id, navigate]);

  if (!computer) return <div className="bg-gray-950 min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{computer.name}</h1>
          <p className="text-xs text-gray-500 font-mono">{computer.hostname}</p>
        </div>
        <StatusIndicator online={computer.isOnline} />
      </header>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="px-6 pt-4">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {computer.isOnline ? (
            <SystemInfoPanel computerId={computer.id} />
          ) : (
            <div className="text-gray-500 p-8 text-center">
              Computer is offline. System info unavailable.
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat">
          {/* AIChat component will be added in Phase 4 */}
          <div className="text-gray-500 p-8 text-center">AI Chat — coming in Phase 4</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Add route in App.tsx**

```typescript
import { ComputerView } from './pages/ComputerView';

// In Routes:
<Route path="/computers/:id" element={<ProtectedRoute><ComputerView /></ProtectedRoute>} />
```

- [ ] **Step 5: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/src/ server/src/routes/computers.ts
git commit -m "feat: computer view with system info overview tab"
```

---

## Phase 4: AI Assistant

### Task 21: AI Orchestrator Service

**Files:**
- Create: `server/src/services/ai.ts`

- [ ] **Step 1: Create AI orchestrator with tool definitions and agentic loop**

```typescript
// server/src/services/ai.ts
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { executeAgentCommand } from './agentBridge.js';
import { prisma } from '../db.js';
import { logger } from '../index.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// Track active AI loops per computer (for concurrency prevention)
const activeLoops = new Map<string, { cancel: boolean }>();

export function isAIBusy(computerId: string): boolean {
  return activeLoops.has(computerId);
}

export function cancelAILoop(computerId: string): boolean {
  const loop = activeLoops.get(computerId);
  if (loop) {
    loop.cancel = true;
    return true;
  }
  return false;
}

const tools: Anthropic.Tool[] = [
  {
    name: "execute_command",
    description: "Execute a shell command on the remote computer. Use PowerShell for Windows. Returns stdout, stderr, and exit code.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "The command to execute" },
        shell: { type: "string", enum: ["powershell", "cmd"], description: "Shell to use (default: powershell)" },
        timeout: { type: "number", description: "Timeout in seconds (default 30, max 120)" },
      },
      required: ["command"],
    },
  },
  {
    name: "screenshot",
    description: "Capture a screenshot of the remote screen. Returns the image. Use this to see what's on screen, verify UI state, or check error dialogs.",
    input_schema: {
      type: "object" as const,
      properties: {
        monitor: { type: "number", description: "Monitor index (0 = primary)" },
      },
    },
  },
  {
    name: "get_event_logs",
    description: "Read Windows Event Viewer logs to diagnose errors, crashes, and system issues.",
    input_schema: {
      type: "object" as const,
      properties: {
        log_name: { type: "string", enum: ["System", "Application", "Security", "Setup"], description: "Which log to query" },
        level: { type: "string", enum: ["Error", "Warning", "Critical", "Information"], description: "Filter by severity" },
        last_n: { type: "number", description: "Number of recent entries (default 20, max 100)" },
        hours_back: { type: "number", description: "Only entries from last N hours" },
      },
      required: ["log_name"],
    },
  },
  {
    name: "system_info",
    description: "Get detailed system information: OS, CPU, RAM usage, disk space, network config, uptime.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_processes",
    description: "List running processes with CPU and memory usage.",
    input_schema: {
      type: "object" as const,
      properties: {
        sort_by: { type: "string", enum: ["cpu", "memory", "name"], description: "Sort order" },
        top_n: { type: "number", description: "Return top N processes (default 30)" },
      },
    },
  },
  {
    name: "manage_service",
    description: "Start, stop, restart, or check status of a Windows service.",
    input_schema: {
      type: "object" as const,
      properties: {
        service_name: { type: "string", description: "Service name" },
        action: { type: "string", enum: ["start", "stop", "restart", "status"], description: "Action" },
      },
      required: ["service_name", "action"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file on the remote computer.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Full file path" },
        max_lines: { type: "number", description: "Max lines to return (default 200)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file on the remote computer. Blocked for system directories.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Full file path" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "network_diagnostics",
    description: "Run network diagnostics: ping, traceroute, DNS lookup, or check if a port is open.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["ping", "traceroute", "nslookup", "port_check"], description: "Action" },
        target: { type: "string", description: "Target hostname or IP" },
        port: { type: "number", description: "Port number (for port_check)" },
      },
      required: ["action", "target"],
    },
  },
  {
    name: "get_installed_software",
    description: "List installed software with version numbers. Optionally filter by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Optional name filter (case-insensitive)" },
      },
    },
  },
];

function buildSystemPrompt(computer: { name: string; hostname: string; os: string; cpuModel: string | null; ramTotalMb: number | null }): string {
  return `You are MagicWand AI, an expert IT support assistant. You are connected to a remote computer and can execute commands, take screenshots, read logs, and manage services on it.

Computer info:
- Name: ${computer.name}
- Hostname: ${computer.hostname}
- OS: ${computer.os}
- CPU: ${computer.cpuModel || 'Unknown'}
- RAM: ${computer.ramTotalMb || 'Unknown'} MB

Your goal is to diagnose and fix issues the user describes. Follow these principles:

1. DIAGNOSE FIRST: Before making changes, gather information. Run diagnostic commands, check logs, take screenshots.
2. EXPLAIN WHAT YOU FIND: Tell the user what you discovered in plain language.
3. WORK STEP BY STEP: Complex issues may require multiple diagnostic steps. Work methodically.
4. VERIFY FIXES: After applying a fix, verify it worked.
5. USE POWERSHELL: This is a Windows computer. Use PowerShell commands.
6. DESCRIBE SCREENSHOTS: When you take a screenshot, describe what you see in detail.
7. STAY SAFE: Never run commands that could cause data loss. The agent has a safety blocklist but use good judgment.
8. ACT AUTONOMOUSLY: Diagnose and fix issues without asking for permission. Just do it and report what you did.`;
}

export type StreamCallback = (event: {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'cancelled';
  data?: any;
}) => void;

export async function runAIChat(
  computerId: string,
  userMessage: string,
  onStream: StreamCallback,
): Promise<void> {
  // Prevent concurrent loops
  if (activeLoops.has(computerId)) {
    onStream({ type: 'error', data: 'AI is already working on this computer.' });
    return;
  }

  const loopState = { cancel: false };
  activeLoops.set(computerId, loopState);

  try {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) {
      onStream({ type: 'error', data: 'Computer not found.' });
      return;
    }

    // Load conversation history from DB
    const dbMessages = await prisma.chatMessage.findMany({
      where: { computerId },
      orderBy: { createdAt: 'asc' },
    });

    // Build messages array for Claude API
    const messages: Anthropic.MessageParam[] = [];
    for (const msg of dbMessages) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        // Parse stored content (could be JSON array of content blocks)
        try {
          messages.push({ role: 'assistant', content: JSON.parse(msg.content) });
        } catch {
          messages.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool_result') {
        // Tool results are part of the user turn
        try {
          messages.push({ role: 'user', content: JSON.parse(msg.content) });
        } catch {
          messages.push({ role: 'user', content: msg.content });
        }
      }
    }

    // Context window management: truncate old tool results to stay within limits
    // Rough estimate: 4 chars ≈ 1 token; claude-sonnet has ~200k context but we cap at ~100k chars
    const MAX_CONTEXT_CHARS = 100000;
    let totalChars = messages.reduce((sum, m) => sum + JSON.stringify(m.content).length, 0);
    if (totalChars > MAX_CONTEXT_CHARS) {
      // Truncate oldest tool_result messages first (keep first 500 chars + note)
      for (let i = 0; i < messages.length && totalChars > MAX_CONTEXT_CHARS; i++) {
        const msg = messages[i];
        const content = JSON.stringify(msg.content);
        if (msg.role === 'user' && content.length > 1000 && content.includes('tool_result')) {
          try {
            const parsed = JSON.parse(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            if (Array.isArray(parsed)) {
              for (const block of parsed) {
                if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > 500) {
                  const oldLen = block.content.length;
                  block.content = block.content.slice(0, 500) + '\n[TRUNCATED for context window]';
                  totalChars -= (oldLen - block.content.length);
                }
              }
              messages[i] = { role: 'user', content: parsed };
            }
          } catch {}
        }
      }
    }

    // Add the new user message
    messages.push({ role: 'user', content: userMessage });
    await prisma.chatMessage.create({
      data: { computerId, role: 'user', content: userMessage },
    });

    // Agentic loop
    let iterations = 0;
    const maxIterations = 20;

    while (iterations++ < maxIterations) {
      if (loopState.cancel) {
        onStream({ type: 'cancelled' });
        await prisma.chatMessage.create({
          data: { computerId, role: 'assistant', content: '[AI loop cancelled by user]' },
        });
        return;
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: buildSystemPrompt(computer),
        tools,
        messages,
      });

      // Save assistant response
      await prisma.chatMessage.create({
        data: {
          computerId,
          role: 'assistant',
          content: JSON.stringify(response.content),
        },
      });

      // Stream content blocks to frontend
      for (const block of response.content) {
        if (block.type === 'text') {
          onStream({ type: 'text', data: block.text });
        } else if (block.type === 'tool_use') {
          onStream({
            type: 'tool_call',
            data: { id: block.id, name: block.name, input: block.input },
          });
        }
      }

      // Check for tool use
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No more tool calls — we're done
        onStream({ type: 'done' });
        return;
      }

      // Execute tool calls and build results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        if (loopState.cancel) {
          onStream({ type: 'cancelled' });
          return;
        }

        try {
          const result = await executeAgentCommand(
            computerId,
            toolUse.name,
            toolUse.input as Record<string, any>,
          );

          // Special handling for screenshots — return as image
          if (toolUse.name === 'screenshot' && result.image_base64) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: result.image_base64,
                  },
                },
              ],
            });
            // Stream screenshot to frontend too
            onStream({
              type: 'tool_result',
              data: {
                tool_use_id: toolUse.id,
                is_screenshot: true,
                image_base64: result.image_base64,
                width: result.width,
                height: result.height,
              },
            });
          } else {
            const resultText = JSON.stringify(result, null, 2);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: resultText,
            });
            onStream({
              type: 'tool_result',
              data: { tool_use_id: toolUse.id, content: resultText },
            });
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Command execution failed';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
          onStream({
            type: 'tool_result',
            data: { tool_use_id: toolUse.id, content: errorMsg, is_error: true },
          });
        }
      }

      // Save tool results and add to messages
      const toolResultMessage: Anthropic.MessageParam = {
        role: 'user',
        content: toolResults,
      };
      messages.push({ role: 'assistant', content: response.content });
      messages.push(toolResultMessage);

      await prisma.chatMessage.create({
        data: {
          computerId,
          role: 'tool_result',
          content: JSON.stringify(toolResults),
        },
      });
    }

    // Hit max iterations
    onStream({ type: 'text', data: '\n\n*Reached maximum diagnostic steps. Please start a new session if the issue is unresolved.*' });
    onStream({ type: 'done' });

  } finally {
    activeLoops.delete(computerId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/services/ai.ts
git commit -m "feat: AI orchestrator with tool definitions and agentic loop"
```

---

### Task 22: Chat REST Endpoints + WebSocket Handler

**Files:**
- Create: `server/src/routes/chat.ts`
- Create: `server/src/ws/chatHandler.ts`
- Modify: `server/src/index.ts` (mount routes + WS)

- [ ] **Step 1: Create chat routes**

```typescript
// server/src/routes/chat.ts
import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isAgentOnline } from '../ws/agentHandler.js';
import { isAIBusy, cancelAILoop, runAIChat } from '../services/ai.js';
import { broadcastChatEvent } from '../ws/chatHandler.js';

const router = Router();
router.use(requireAuth);

// Get chat messages for a computer
router.get('/:computerId/chat', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.computerId, userId: req.userId },
  });
  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }

  const messages = await prisma.chatMessage.findMany({
    where: { computerId: computer.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

// Send a message to AI
router.post('/:computerId/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Message is required.' });
    return;
  }

  const computer = await prisma.computer.findFirst({
    where: { id: req.params.computerId, userId: req.userId },
  });
  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }

  if (!isAgentOnline(computer.id)) {
    res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' });
    return;
  }

  if (isAIBusy(computer.id)) {
    res.status(409).json({ error: 'AI_BUSY', message: 'AI is already working on this computer.' });
    return;
  }

  // Start the AI loop asynchronously
  res.json({ success: true, status: 'processing' });

  // Run AI and stream events to WebSocket clients
  runAIChat(computer.id, message, (event) => {
    broadcastChatEvent(computer.id, event);
  }).catch((err) => {
    broadcastChatEvent(computer.id, { type: 'error', data: err.message });
  });
});

// Clear chat (new session)
router.delete('/:computerId/chat', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.computerId, userId: req.userId },
  });
  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }

  await prisma.chatMessage.deleteMany({ where: { computerId: computer.id } });
  res.json({ success: true });
});

// Cancel active AI loop
router.delete('/:computerId/chat/active', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.computerId, userId: req.userId },
  });
  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }

  const cancelled = cancelAILoop(computer.id);
  res.json({ success: true, wasBusy: cancelled });
});

export default router;
```

- [ ] **Step 2: Create chat WebSocket handler**

```typescript
// server/src/ws/chatHandler.ts
import { WebSocket, WebSocketServer } from 'ws';

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
```

- [ ] **Step 3: Mount chat routes and WebSocket in index.ts**

Add to `server/src/index.ts`:

```typescript
import chatRoutes from './routes/chat.js';
import { addChatClient } from './ws/chatHandler.js';

app.use('/api/computers', chatRoutes);

// In the server.on('upgrade') handler, add before the socket.destroy() fallback:
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
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add server/src/routes/chat.ts server/src/ws/chatHandler.ts server/src/index.ts
git commit -m "feat: chat REST endpoints and WebSocket handler for AI streaming"
```

---

### Task 23: AI Chat Frontend Component

**Files:**
- Create: `web/src/components/AIChat.tsx`
- Create: `web/src/components/ChatMessage.tsx`
- Create: `web/src/components/ToolCallDisplay.tsx`
- Modify: `web/src/pages/ComputerView.tsx` (integrate chat)

- [ ] **Step 1: Create ToolCallDisplay component**

```tsx
// web/src/components/ToolCallDisplay.tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ToolCallProps {
  name: string;
  input: any;
  result?: {
    content?: string;
    is_error?: boolean;
    is_screenshot?: boolean;
    image_base64?: string;
  };
  loading?: boolean;
}

export function ToolCallDisplay({ name, input, result, loading }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const icon = loading ? (
    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
  ) : result?.is_error ? (
    <XCircle className="w-3 h-3 text-red-400" />
  ) : (
    <CheckCircle className="w-3 h-3 text-green-400" />
  );

  const inputSummary = name === 'execute_command'
    ? input.command
    : name === 'screenshot'
    ? 'Capturing screen...'
    : JSON.stringify(input).slice(0, 80);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-md my-2 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-900"
        onClick={() => setExpanded(!expanded)}
      >
        {icon}
        <span className="font-mono text-xs text-blue-400">{name}</span>
        <span className="text-xs text-gray-500 truncate flex-1">{inputSummary}</span>
        {expanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-3 py-2">
          {/* Input */}
          <div className="text-xs text-gray-500 mb-1">Input:</div>
          <pre className="text-xs text-gray-400 font-mono mb-2 whitespace-pre-wrap break-all max-h-32 overflow-auto">
            {JSON.stringify(input, null, 2)}
          </pre>

          {/* Result */}
          {result && (
            <>
              <div className="text-xs text-gray-500 mb-1">Result:</div>
              {result.is_screenshot && result.image_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${result.image_base64}`}
                  alt="Screenshot"
                  className="max-w-full rounded border border-gray-700"
                />
              ) : (
                <pre className={`text-xs font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto ${
                  result.is_error ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {result.content}
                </pre>
              )}
            </>
          )}

          {loading && <div className="text-xs text-gray-500">Running...</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ChatMessage component**

```tsx
// web/src/components/ChatMessage.tsx
import ReactMarkdown from 'react-markdown';
import { ToolCallDisplay } from './ToolCallDisplay';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;  // plain text for user, JSON content blocks for assistant
  toolResults?: Map<string, any>;
  pendingTools?: Set<string>;
}

export function ChatMessage({ role, content, toolResults, pendingTools }: MessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-purple-600 px-4 py-2.5 rounded-xl rounded-br-sm max-w-[70%] text-sm">
          {content}
        </div>
      </div>
    );
  }

  // Parse assistant content blocks
  let blocks: any[];
  try {
    blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) blocks = [{ type: 'text', text: content }];
  } catch {
    blocks = [{ type: 'text', text: content }];
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-xl rounded-bl-sm max-w-[80%]">
        {blocks.map((block: any, i: number) => {
          if (block.type === 'text') {
            return (
              <div key={i} className="text-sm prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{block.text}</ReactMarkdown>
              </div>
            );
          }
          if (block.type === 'tool_use') {
            return (
              <ToolCallDisplay
                key={i}
                name={block.name}
                input={block.input}
                result={toolResults?.get(block.id)}
                loading={pendingTools?.has(block.id)}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create AIChat component**

```tsx
// web/src/components/AIChat.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChatMessage } from './ChatMessage';
import { ToolCallDisplay } from './ToolCallDisplay';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  createdAt: string;
}

interface Props {
  computerId: string;
  isOnline: boolean;
}

export function AIChat({ computerId, isOnline }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingContent, setStreamingContent] = useState<any[]>([]);
  const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());
  const [pendingTools, setPendingTools] = useState<Set<string>>(new Set());
  const [wsToken, setWsToken] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch WS token and chat history
  useEffect(() => {
    api.get<{ token: string }>('/api/auth/ws-token').then((d) => setWsToken(d.token));
    api.get<ChatMsg[]>(`/api/computers/${computerId}/chat`).then(setMessages);
  }, [computerId]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, toolResults]);

  const wsUrl = wsToken
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chat/${computerId}?token=${wsToken}`
    : '';

  // Handle streaming events from AI — use refs to avoid stale closures
  const streamingRef = useRef<any[]>([]);
  useEffect(() => { streamingRef.current = streamingContent; }, [streamingContent]);

  const handleWsMessage = useCallback((event: any) => {
    switch (event.type) {
      case 'text':
        setStreamingContent((prev) => [...prev, { type: 'text', text: event.data }]);
        break;

      case 'tool_call':
        setStreamingContent((prev) => [...prev, { type: 'tool_use', id: event.data.id, name: event.data.name, input: event.data.input }]);
        setPendingTools((prev) => new Set(prev).add(event.data.id));
        break;

      case 'tool_result':
        setPendingTools((prev) => {
          const next = new Set(prev);
          next.delete(event.data.tool_use_id);
          return next;
        });
        setToolResults((prev) => new Map(prev).set(event.data.tool_use_id, event.data));
        break;

      case 'done':
      case 'cancelled':
        setBusy(false);
        setStreamingContent([]);
        setToolResults(new Map());
        setPendingTools(new Set());
        // Refresh from server to get accurate state (avoids stale closure)
        api.get<ChatMsg[]>(`/api/computers/${computerId}/chat`).then(setMessages);
        break;

      case 'error':
        setBusy(false);
        setStreamingContent([]);
        break;
    }
  }, [computerId]);

  useWebSocket({ url: wsUrl, enabled: !!wsToken, onMessage: handleWsMessage });

  const sendMessage = async (text: string) => {
    if (!text.trim() || busy || !isOnline) return;
    setInput('');
    setBusy(true);
    setStreamingContent([]);
    setToolResults(new Map());

    // Optimistic add
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    } as ChatMsg]);

    try {
      await api.post(`/api/computers/${computerId}/chat`, { message: text });
    } catch (err: any) {
      setBusy(false);
    }
  };

  const clearChat = async () => {
    await api.del(`/api/computers/${computerId}/chat`);
    setMessages([]);
    setStreamingContent([]);
  };

  const cancelAI = async () => {
    await api.del(`/api/computers/${computerId}/chat/active`);
  };

  const quickActions = [
    { label: 'Check system health', prompt: 'Run a full system health check — CPU, RAM, disk, and recent errors.' },
    { label: 'Find recent errors', prompt: 'Check the Windows Event Viewer for recent errors and tell me what you find.' },
    { label: 'List running processes', prompt: 'Show me the top processes by memory and CPU usage.' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.filter((m) => m.role !== 'tool_result').map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
          />
        ))}

        {/* Streaming content */}
        {streamingContent.length > 0 && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-xl rounded-bl-sm max-w-[80%]">
              {streamingContent.map((block, i) => {
                if (block.type === 'text') {
                  return (
                    <div key={i} className="text-sm prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{block.text}</ReactMarkdown>
                    </div>
                  );
                }
                if (block.type === 'tool_use') {
                  return (
                    <ToolCallDisplay
                      key={i}
                      name={block.name}
                      input={block.input}
                      result={toolResults.get(block.id)}
                      loading={pendingTools.has(block.id)}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {busy && streamingContent.length === 0 && (
          <div className="flex items-center gap-2 text-gray-500 text-sm ml-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder={isOnline ? 'Ask MagicWand to fix something...' : 'Computer is offline'}
            disabled={!isOnline || busy}
            className="bg-gray-900 border-gray-700"
          />
          {busy ? (
            <Button variant="destructive" size="icon" onClick={cancelAI}>
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || !isOnline}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-gray-500" onClick={clearChat} title="New session">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick actions */}
        {messages.length === 0 && !busy && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => sendMessage(qa.prompt)}
                disabled={!isOnline}
                className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-full text-xs text-gray-400 hover:text-white hover:border-gray-600 transition"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: Add `import ReactMarkdown from 'react-markdown';` and `import { ToolCallDisplay } from './ToolCallDisplay';` at the top.

- [ ] **Step 4: Integrate AIChat into ComputerView**

Update `web/src/pages/ComputerView.tsx`:

```typescript
import { AIChat } from '../components/AIChat';

// Replace the placeholder in TabsContent value="chat":
<TabsContent value="chat">
  <AIChat computerId={computer.id} isOnline={computer.isOnline} />
</TabsContent>
```

- [ ] **Step 5: Verify full AI chat flow end-to-end**

1. Start server + web + agent
2. Navigate to a computer → AI Assistant tab
3. Type "What's my system info?" → should see the AI call `system_info`, get results, and summarize
4. Try "Check for recent errors in Event Viewer" → should call `get_event_logs`

- [ ] **Step 6: Commit**

```bash
cd /mnt/d/Projects/MagicWand
git add web/src/ server/src/
git commit -m "feat: AI chat interface with streaming, tool call display, and quick actions"
```

---

### Task 24: Final Polish + .env.example

**Files:**
- Create: `.env.example` (root level)
- Modify: `server/.env.example` (ensure complete)

- [ ] **Step 1: Create root .env.example**

```env
# Server
ADMIN_EMAIL=admin@magicwand.local
ADMIN_PASSWORD=changeme
SESSION_SECRET=replace-with-random-64-char-string
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 2: Add .superpowers to .gitignore**

Ensure `.superpowers/` is in `.gitignore`.

- [ ] **Step 3: Verify complete flow**

1. Start server: `cd server && npx tsx src/index.ts`
2. Start web: `cd web && npm run dev`
3. Open http://localhost:5173, login
4. Click "Add Computer", generate token
5. On remote/same machine: `cd agent && python main.py --enroll <TOKEN> --server http://localhost:3001`
6. Agent connects, dashboard shows online
7. Click "AI Chat", ask "Fix my printer" or "Check system health"
8. AI runs commands, shows results, provides diagnosis

- [ ] **Step 4: Final commit**

```bash
cd /mnt/d/Projects/MagicWand
git add .
git commit -m "feat: MagicWand v0.1.0 — complete AI troubleshooting system"
```
