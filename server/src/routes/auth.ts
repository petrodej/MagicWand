import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
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
    maxAge: 30 * 24 * 60 * 60 * 1000,
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
  res.json({ userId: req.userId, role: req.userRole });
});

// Short-lived WS token (avoids leaking httpOnly cookie to JS)
const wsTokens = new Map<string, { userId: string; expiresAt: number }>();

router.get('/ws-token', requireAuth, async (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  wsTokens.set(token, { userId: req.userId!, expiresAt: Date.now() + 60000 });
  res.json({ token });
});

export function validateWsToken(token: string): string | null {
  const entry = wsTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    wsTokens.delete(token);
    return null;
  }
  wsTokens.delete(token);
  return entry.userId;
}

export default router;
