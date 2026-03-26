import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { executeAgentCommand, AgentOfflineError } from '../services/agentBridge.js';

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

// File manager — proxy commands to agent
router.post('/:id/files/list', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!computer) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  try {
    const result = await executeAgentCommand(computer.id, 'list_directory', { path: req.body.path || 'C:\\' });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentOfflineError) { res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list directory.' });
  }
});

router.post('/:id/files/download', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!computer) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  try {
    const result = await executeAgentCommand(computer.id, 'download_file', { path: req.body.path });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentOfflineError) { res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to download file.' });
  }
});

router.post('/:id/files/upload', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!computer) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  try {
    const result = await executeAgentCommand(computer.id, 'upload_file', {
      path: req.body.path,
      data_base64: req.body.data_base64,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentOfflineError) { res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to upload file.' });
  }
});

router.post('/:id/files/delete', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!computer) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  try {
    const result = await executeAgentCommand(computer.id, 'delete_path', { path: req.body.path });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentOfflineError) { res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete.' });
  }
});

router.post('/:id/files/mkdir', async (req, res) => {
  const computer = await prisma.computer.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!computer) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  try {
    const result = await executeAgentCommand(computer.id, 'create_directory', { path: req.body.path });
    res.json(result);
  } catch (err) {
    if (err instanceof AgentOfflineError) { res.status(400).json({ error: 'AGENT_OFFLINE', message: 'Computer is offline.' }); return; }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create directory.' });
  }
});

export default router;
