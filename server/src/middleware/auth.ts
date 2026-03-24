import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.js';

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
