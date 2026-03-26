import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db.js';

const router = Router();

const enrollSchema = z.object({
  token: z.string().min(1),
  hostname: z.string().min(1),
  os: z.string().min(1),
  cpuModel: z.string().optional(),
  ramTotalMb: z.number().optional(),
  agentVersion: z.string().optional(),
  macAddress: z.string().optional(),
});

router.post('/enroll', async (req, res) => {
  const parsed = enrollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid enrollment data.' });
    return;
  }

  const { token, hostname, os, cpuModel, ramTotalMb, agentVersion, macAddress } = parsed.data;

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
      macAddress: macAddress || null,
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

// Agent update check — receives file hashes, returns list of changed files
router.post('/check-update', async (req, res) => {
  const clientHashes: Record<string, string> = req.body.hashes || {};

  const agentDir = path.resolve(process.cwd(), '../agent');
  const files = [
    'main.py', 'config.py', 'connection.py', 'security.py', 'requirements.txt',
  ];
  const cmdFiles = [
    '__init__.py', 'execute.py', 'screenshot.py', 'system_info.py', 'processes.py',
    'event_logs.py', 'services.py', 'software.py', 'files.py', 'network.py',
    'input_control.py', 'file_manager.py',
  ];

  const updates: { path: string; url: string }[] = [];

  for (const file of files) {
    const filePath = path.join(agentDir, file);
    try {
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('md5').update(content).digest('hex');
      if (clientHashes[file] !== hash) {
        updates.push({ path: file, url: `/api/download/agent/${file}` });
      }
    } catch {}
  }

  for (const file of cmdFiles) {
    const filePath = path.join(agentDir, 'commands', file);
    const key = `commands/${file}`;
    try {
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('md5').update(content).digest('hex');
      if (clientHashes[key] !== hash) {
        updates.push({ path: key, url: `/api/download/agent/commands/${file}` });
      }
    } catch {}
  }

  res.json({ updates, requiresRestart: updates.some((u) => u.path === 'main.py' || u.path === 'connection.py' || u.path === 'requirements.txt') });
});

export default router;
