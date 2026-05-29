import { sendEmail, emailTemplates } from '@/lib/email-service';
import { redis } from '@/lib/redis';

const ALERT_LOCK_KEY = 'alerts:last-run';
const ALERT_LOCK_TTL = 3600; // 1 hour between runs

interface AlertConfig {
  renewalDays: number[];
  obligationDays: number[];
  enabled: boolean;
  recipientEmails: string[];
}

function getDefaultConfig(): AlertConfig {
  return {
    renewalDays: [30, 14, 7, 1],
    obligationDays: [14, 7, 1],
    enabled: true,
    recipientEmails: [],
  };
}

export async function getAlertConfig(tenantId: string): Promise<AlertConfig> {
  try {
    const raw = await redis.get(`alerts:config:${tenantId}`);
    if (raw) {
      return { ...getDefaultConfig(), ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return getDefaultConfig();
}

export async function setAlertConfig(tenantId: string, config: Partial<AlertConfig>): Promise<AlertConfig> {
  const current = await getAlertConfig(tenantId);
  const updated = { ...current, ...config };
  await redis.setex(`alerts:config:${tenantId}`, 86400 * 30, JSON.stringify(updated));
  return updated;
}

interface AlertResult {
  sent: number;
  errors: number;
  renewalsChecked: number;
  obligationsChecked: number;
}

export async function runAlertCheck(tenantId: string, force = false): Promise<AlertResult> {
  const lockKey = `${ALERT_LOCK_KEY}:${tenantId}`;

  if (!force) {
    const locked = await redis.get(lockKey);
    if (locked) {
      return { sent: 0, errors: 0, renewalsChecked: 0, obligationsChecked: 0 };
    }
  }

  await redis.setex(lockKey, ALERT_LOCK_TTL, new Date().toISOString());

  const config = await getAlertConfig(tenantId);
  if (!config.enabled) {
    return { sent: 0, errors: 0, renewalsChecked: 0, obligationsChecked: 0 };
  }

  const { prisma } = await import('@/lib/prisma');
  const now = new Date();
  const result: AlertResult = { sent: 0, errors: 0, renewalsChecked: 0, obligationsChecked: 0 };

  // Get recipient emails
  let recipients = config.recipientEmails;
  if (recipients.length === 0) {
    const admins = await prisma.user.findMany({
      where: { tenantId, role: { in: ['admin', 'manager'] }, status: 'ACTIVE' },
      select: { email: true },
    });
    recipients = admins.map(a => a.email).filter(Boolean);
  }

  if (recipients.length === 0) {
    return result;
  }

  // Check renewals
  const renewalDeadline = new Date(now);
  renewalDeadline.setDate(renewalDeadline.getDate() + Math.max(...config.renewalDays));

  const expiringContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      expirationDate: { lte: renewalDeadline, gte: now },
      isDeleted: false,
    },
    select: {
      id: true,
      contractTitle: true,
      expirationDate: true,
      supplierName: true,
    },
  });

  result.renewalsChecked = expiringContracts.length;

  for (const contract of expiringContracts) {
    if (!contract.expirationDate) continue;
    const daysUntil = Math.ceil((contract.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (!config.renewalDays.includes(daysUntil)) continue;

    const alreadySent = await redis.get(`alert:renewal:${tenantId}:${contract.id}:${daysUntil}`);
    if (alreadySent) continue;

    const template = emailTemplates.contractExpiring({
      contractTitle: contract.contractTitle || contract.supplierName || 'Untitled Contract',
      expirationDate: contract.expirationDate.toLocaleDateString('de-CH'),
      daysUntilExpiration: daysUntil,
      contractUrl: `${process.env.NEXTAUTH_URL}/contracts/${contract.id}`,
    });

    for (const email of recipients) {
      const res = await sendEmail({ to: email, subject: template.subject, html: template.html });
      if (res.success) result.sent++;
      else result.errors++;
    }

    await redis.setex(`alert:renewal:${tenantId}:${contract.id}:${daysUntil}`, 86400 * 7, '1');
  }

  // Check obligations
  const obligationDeadline = new Date(now);
  obligationDeadline.setDate(obligationDeadline.getDate() + Math.max(...config.obligationDays));

  const upcomingObligations = await prisma.obligation.findMany({
    where: {
      tenantId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: { lte: obligationDeadline, gte: now },
    },
    include: {
      contract: { select: { id: true, contractTitle: true } },
    },
  });

  result.obligationsChecked = upcomingObligations.length;

  for (const ob of upcomingObligations) {
    if (!ob.dueDate) continue;
    const daysUntil = Math.ceil((ob.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (!config.obligationDays.includes(daysUntil)) continue;

    const alreadySent = await redis.get(`alert:obligation:${tenantId}:${ob.id}:${daysUntil}`);
    if (alreadySent) continue;

    const template = emailTemplates.renewalReminder({
      contractTitle: `${ob.title} — ${ob.contract?.contractTitle || 'Contract'}`,
      renewalDate: ob.dueDate.toLocaleDateString('de-CH'),
      daysUntilRenewal: daysUntil,
      contractUrl: `${process.env.NEXTAUTH_URL}/contracts/${ob.contractId}`,
    });

    for (const email of recipients) {
      const res = await sendEmail({ to: email, subject: template.subject, html: template.html });
      if (res.success) result.sent++;
      else result.errors++;
    }

    await redis.setex(`alert:obligation:${tenantId}:${ob.id}:${daysUntil}`, 86400 * 7, '1');
  }

  return result;
}
