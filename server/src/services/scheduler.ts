import { prisma } from '../db.js';
import { executeAgentCommand } from './agentBridge.js';
import { logAudit } from './audit.js';
import { logger } from '../index.js';

function parseCronField(field: string, min: number, max: number): number[] {
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.push(i);
    } else if (part.includes('/')) {
      const [base, stepStr] = part.split('/');
      const step = parseInt(stepStr);
      const start = base === '*' ? min : parseInt(base);
      for (let i = start; i <= max; i += step) values.push(i);
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = a; i <= b; i++) values.push(i);
    } else {
      values.push(parseInt(part));
    }
  }
  return values;
}

function matchesCron(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minF, hourF, domF, monF, dowF] = parts;
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dom = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay(); // 0=Sunday

  return (
    parseCronField(minF, 0, 59).includes(minute) &&
    parseCronField(hourF, 0, 23).includes(hour) &&
    parseCronField(domF, 1, 31).includes(dom) &&
    parseCronField(monF, 1, 12).includes(month) &&
    parseCronField(dowF, 0, 6).includes(dow)
  );
}

function getNextRun(cronExpr: string): Date | null {
  const now = new Date();
  // Check next 1440 minutes (24 hours)
  for (let i = 1; i <= 1440; i++) {
    const candidate = new Date(now.getTime() + i * 60000);
    candidate.setSeconds(0, 0);
    if (matchesCron(cronExpr, candidate)) return candidate;
  }
  return null;
}

async function runScheduledTask(taskId: string) {
  const task = await prisma.scheduledTask.findUnique({
    where: { id: taskId },
    include: { computer: true },
  });
  if (!task || !task.enabled) return;

  try {
    const result = await executeAgentCommand(task.computerId, 'execute_command', {
      command: task.command,
      shell: task.shell,
      timeout: 60,
    });

    await prisma.scheduledTask.update({
      where: { id: taskId },
      data: {
        lastRun: new Date(),
        lastResult: JSON.stringify(result),
        nextRun: getNextRun(task.cronExpr),
      },
    });

    logAudit({
      userId: task.userId,
      action: 'scheduled_task_run',
      computerId: task.computerId,
      details: { taskName: task.name, command: task.command },
    });
  } catch (err: any) {
    await prisma.scheduledTask.update({
      where: { id: taskId },
      data: {
        lastRun: new Date(),
        lastResult: JSON.stringify({ error: err.message || 'Failed' }),
        nextRun: getNextRun(task.cronExpr),
      },
    });
  }
}

export function startScheduler() {
  // Check every 60 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      const tasks = await prisma.scheduledTask.findMany({
        where: { enabled: true },
      });

      for (const task of tasks) {
        if (matchesCron(task.cronExpr, now)) {
          // Don't run if already ran this minute
          if (task.lastRun) {
            const diff = now.getTime() - task.lastRun.getTime();
            if (diff < 55000) continue;
          }
          runScheduledTask(task.id).catch(() => {});
        }
      }
    } catch (err) {
      logger.error(`Scheduler error: ${err}`);
    }
  }, 60000);
}
