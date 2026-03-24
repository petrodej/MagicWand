import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';

const SESSION_EXPIRY_DAYS = 30;

export async function seedAdminUser(): Promise<void> {
  const existing = await prisma.user.findFirst();
  if (existing) return;

  const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      email: config.ADMIN_EMAIL,
      passwordHash,
      name: 'Admin',
    },
  });
}

export async function login(email: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  return token;
}

export async function validateSession(token: string): Promise<string | null> {
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: newExpiry },
  });

  return session.userId;
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
