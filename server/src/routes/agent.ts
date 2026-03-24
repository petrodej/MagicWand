import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';

const router = Router();

const enrollSchema = z.object({
  token: z.string().min(1),
  hostname: z.string().min(1),
  os: z.string().min(1),
  cpuModel: z.string().optional(),
  ramTotalMb: z.number().optional(),
  agentVersion: z.string().optional(),
});

router.post('/enroll', async (req, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid enrollment data.' });
    return;
  }

  const { token, hostname, os, cpuModel, ramTotalMb, agentVersion } = parsed.data;

  // Find computer with this enrollment token
  const computer = await prisma.computer.findUnique({
    where: { enrollToken: token },
  });

  if (!computer) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid enrollment token.' });
    return;
  }

  // Check expiry
  if (computer.enrollExpiry && computer.enrollExpiry < new Date()) {
    res.status(410).json({ error: 'TOKEN_EXPIRED', message: 'Enrollment token has expired.' });
    return;
  }

  // Update computer with machine info, clear enrollment token
  const updated = await prisma.computer.update({
    where: { id: computer.id },
    data: {
      hostname,
      os,
      cpuModel: cpuModel || null,
      ramTotalMb: ramTotalMb || null,
      agentVersion: agentVersion || null,
      enrollToken: null,
      enrollExpiry: null,
      ipAddress: req.ip || null,
    },
  });

  res.json({
    agentSecret: updated.agentSecret,
    computerId: updated.id,
  });
});

export default router;
