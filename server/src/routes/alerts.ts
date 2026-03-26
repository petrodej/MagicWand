import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List alert rules
router.get('/rules', async (req, res) => {
  const rules = await prisma.alertRule.findMany({
    where: { userId: req.userId },
    include: { computer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rules);
});

// Create alert rule
router.post('/rules', async (req, res) => {
  const { computerId, type, threshold, webhookUrl } = req.body;

  if (!type || !['offline', 'cpu', 'ram', 'disk'].includes(type)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid alert type.' });
    return;
  }

  if ((type === 'cpu' || type === 'ram' || type === 'disk') && (threshold == null || threshold < 1 || threshold > 100)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Threshold must be 1-100.' });
    return;
  }

  const rule = await prisma.alertRule.create({
    data: {
      userId: req.userId!,
      computerId: computerId || null,
      type,
      threshold: threshold || null,
      webhookUrl: webhookUrl || null,
    },
  });
  res.json(rule);
});

// Delete alert rule
router.delete('/rules/:id', async (req, res) => {
  const result = await prisma.alertRule.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json({ success: true });
});

// Toggle alert rule
router.put('/rules/:id/toggle', async (req, res) => {
  const rule = await prisma.alertRule.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!rule) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  await prisma.alertRule.update({
    where: { id: rule.id },
    data: { enabled: !rule.enabled },
  });
  res.json({ success: true, enabled: !rule.enabled });
});

// Get alert logs
router.get('/logs', async (req, res) => {
  const logs = await prisma.alertLog.findMany({
    where: { userId: req.userId },
    include: { computer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(logs);
});

// Clear alert logs
router.delete('/logs', async (req, res) => {
  await prisma.alertLog.deleteMany({ where: { userId: req.userId } });
  res.json({ success: true });
});

export default router;
