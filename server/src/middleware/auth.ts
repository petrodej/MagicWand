import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.js';
import { prisma } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
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

  // Load role
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  req.userRole = user?.role || 'viewer';

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    return;
  }
  next();
}
