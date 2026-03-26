import { prisma } from '../db.js';

export async function logAudit(params: {
  userId: string;
  action: string;
  computerId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      computerId: params.computerId || null,
      details: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress || null,
    },
  });
}
