import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/stats', async (req, res) => {
  const userId = req.userId!;

  const [
    totalComputers,
    onlineComputers,
    recentAlerts,
    recentAuditCount,
    scheduledTaskCount,
  ] = await Promise.all([
    prisma.computer.count({ where: { userId, hostname: { not: 'pending' } } }),
    prisma.computer.count({ where: { userId, isOnline: true } }),
    prisma.alertLog.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.auditLog.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.scheduledTask.count({ where: { userId, enabled: true } }),
  ]);

  res.json({
    totalComputers,
    onlineComputers,
    recentAlerts,
    recentAuditCount,
    scheduledTaskCount,
  });
});

export default router;
