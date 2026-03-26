import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List scheduled tasks
router.get('/', async (req, res) => {
  const tasks = await prisma.scheduledTask.findMany({
    where: { userId: req.userId },
    include: { computer: { select: { name: true, hostname: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

// Create scheduled task
const createSchema = z.object({
  name: z.string().min(1).max(100),
  computerId: z.string().min(1),
  command: z.string().min(1),
  shell: z.string().optional(),
  cronExpr: z.string().min(1),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid task data.' });
    return;
  }

  // Verify computer belongs to user
  const computer = await prisma.computer.findFirst({
    where: { id: parsed.data.computerId, userId: req.userId },
  });
  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Computer not found.' });
    return;
  }

  const task = await prisma.scheduledTask.create({
    data: {
      userId: req.userId!,
      computerId: parsed.data.computerId,
      name: parsed.data.name,
      command: parsed.data.command,
      shell: parsed.data.shell || 'powershell',
      cronExpr: parsed.data.cronExpr,
    },
    include: { computer: { select: { name: true, hostname: true } } },
  });

  res.json(task);
});

// Toggle enabled
router.put('/:id/toggle', async (req, res) => {
  const task = await prisma.scheduledTask.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!task) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const updated = await prisma.scheduledTask.update({
    where: { id: req.params.id },
    data: { enabled: !task.enabled },
  });
  res.json(updated);
});

// Delete scheduled task
router.delete('/:id', async (req, res) => {
  const result = await prisma.scheduledTask.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json({ ok: true });
});

export default router;
