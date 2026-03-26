import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Get audit logs with pagination and filters
router.get('/logs', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const action = req.query.action as string | undefined;
  const computerId = req.query.computerId as string | undefined;

  const where: Record<string, unknown> = { userId: req.userId };
  if (action) where.action = action;
  if (computerId) where.computerId = computerId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        computer: { select: { name: true, hostname: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
});

// Clear all audit logs
router.delete('/logs', async (req, res) => {
  await prisma.auditLog.deleteMany({ where: { userId: req.userId } });
  res.json({ ok: true });
});

export default router;
