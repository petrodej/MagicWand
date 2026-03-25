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

  res.json({ success: true, status: 'processing' });

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
