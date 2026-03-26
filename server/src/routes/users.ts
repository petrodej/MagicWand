import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

// List users
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

// Create user
const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6),
  role: z.enum(['admin', 'viewer']),
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid user data.' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    res.status(409).json({ error: 'CONFLICT', message: 'Email already in use.' });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  res.json(user);
});

// Update user role
router.put('/:id/role', async (req, res) => {
  const role = req.body.role;
  if (!['admin', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid role.' });
    return;
  }

  // Prevent demoting yourself
  if (req.params.id === req.userId) {
    res.status(400).json({ error: 'SELF_DEMOTE', message: 'Cannot change your own role.' });
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: req.params.id },
    data: { role },
  });
  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json({ success: true });
});

// Delete user
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.userId) {
    res.status(400).json({ error: 'SELF_DELETE', message: 'Cannot delete yourself.' });
    return;
  }

  const result = await prisma.user.deleteMany({ where: { id: req.params.id } });
  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json({ success: true });
});

// Reset user password
router.put('/:id/password', async (req, res) => {
  const password = req.body.password;
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.user.updateMany({
    where: { id: req.params.id },
    data: { passwordHash },
  });
  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json({ success: true });
});

export default router;
