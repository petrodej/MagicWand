import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { executeAgentCommand, AgentOfflineError } from '../services/agentBridge.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

// List scripts
router.get('/', async (req, res) => {
  const scripts = await prisma.script.findMany({
    where: { userId: req.userId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(scripts);
});

// Create script
const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  command: z.string().min(1),
  shell: z.string().optional(),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR' });
    return;
  }

  const script = await prisma.script.create({
    data: {
      userId: req.userId!,
      name: parsed.data.name,
      description: parsed.data.description || '',
      command: parsed.data.command,
      shell: parsed.data.shell || 'powershell',
    },
  });
  res.json(script);
});

// Update script
router.put('/:id', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR' });
    return;
  }

  const result = await prisma.script.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || '',
      command: parsed.data.command,
      shell: parsed.data.shell || 'powershell',
    },
  });
  if (result.count === 0) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ success: true });
});

// Delete script
router.delete('/:id', async (req, res) => {
  const result = await prisma.script.deleteMany({
    where: { id: req.params.id, userId: req.userId },
  });
  if (result.count === 0) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ success: true });
});

// Run script on a computer
router.post('/:id/run', async (req, res) => {
  const script = await prisma.script.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!script) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const computerId = req.body.computerId;
  if (!computerId) { res.status(400).json({ error: 'VALIDATION_ERROR', message: 'computerId required' }); return; }

  const computer = await prisma.computer.findFirst({
    where: { id: computerId, userId: req.userId },
  });
  if (!computer) { res.status(404).json({ error: 'COMPUTER_NOT_FOUND' }); return; }

  try {
    const result = await executeAgentCommand(computerId, 'execute_command', {
      command: script.command,
      shell: script.shell,
      timeout: 60,
    });
    logAudit({ userId: req.userId!, action: 'run_script', computerId, details: { scriptName: script.name }, ipAddress: req.ip });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentOfflineError) { res.status(400).json({ error: 'AGENT_OFFLINE' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
