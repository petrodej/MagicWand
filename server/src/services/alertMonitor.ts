import { prisma } from '../db.js';
import { logger } from '../index.js';

// Track last alert times to avoid spamming (computerId:type → timestamp)
const lastAlertTime = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between duplicate alerts

export function startAlertMonitor() {
  // Check offline computers every 60 seconds
  setInterval(checkOfflineAlerts, 60000);

  logger.info('Alert monitor started');
}

export async function checkHeartbeatAlerts(computerId: string, cpuPercent: number, ramPercent: number) {
  try {
    const rules = await prisma.alertRule.findMany({
      where: {
        enabled: true,
        OR: [
          { computerId, type: { in: ['cpu', 'ram'] } },
          { computerId: null, type: { in: ['cpu', 'ram'] } }, // Global rules
        ],
      },
      include: { computer: true },
    });

    for (const rule of rules) {
      if (!rule.threshold) continue;

      let triggered = false;
      let message = '';

      if (rule.type === 'cpu' && cpuPercent >= rule.threshold) {
        triggered = true;
        message = `CPU usage at ${cpuPercent.toFixed(1)}% (threshold: ${rule.threshold}%)`;
      } else if (rule.type === 'ram' && ramPercent >= rule.threshold) {
        triggered = true;
        message = `RAM usage at ${ramPercent.toFixed(1)}% (threshold: ${rule.threshold}%)`;
      }

      if (triggered) {
        await fireAlert(rule.userId, computerId, rule.type, message, rule.webhookUrl);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error checking heartbeat alerts');
  }
}

async function checkOfflineAlerts() {
  try {
    const rules = await prisma.alertRule.findMany({
      where: { enabled: true, type: 'offline' },
    });

    for (const rule of rules) {
      // Find computers that are offline
      const where: any = { isOnline: false, userId: rule.userId };
      if (rule.computerId) where.id = rule.computerId;

      const offlineComputers = await prisma.computer.findMany({
        where,
        select: { id: true, name: true, lastSeen: true },
      });

      for (const computer of offlineComputers) {
        // Only alert if was seen recently (last 10 minutes) — means it just went offline
        if (computer.lastSeen) {
          const offlineSince = Date.now() - computer.lastSeen.getTime();
          if (offlineSince < 10 * 60 * 1000) {
            const message = `${computer.name} went offline`;
            await fireAlert(rule.userId, computer.id, 'offline', message, rule.webhookUrl);
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error checking offline alerts');
  }
}

async function fireAlert(userId: string, computerId: string, type: string, message: string, webhookUrl?: string | null) {
  const key = `${computerId}:${type}`;
  const now = Date.now();
  const last = lastAlertTime.get(key);

  if (last && now - last < COOLDOWN_MS) return; // Cooldown
  lastAlertTime.set(key, now);

  // Log to database
  await prisma.alertLog.create({
    data: { userId, computerId, type, message },
  });

  logger.warn({ computerId, type, message }, 'Alert fired');

  // Send webhook if configured
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          computerId,
          message,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.error({ err, webhookUrl }, 'Failed to send webhook');
    }
  }
}
