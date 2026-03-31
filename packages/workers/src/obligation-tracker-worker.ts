/**
 * Obligation Tracker Worker
 * 
 * Background worker that monitors contract obligations, SLAs, milestones,
 * and deliverable deadlines.
 * 
 * Features:
 * - Configurable scan windows
 * - Overdue detection
 * - SLA status tracking
 * - Party-specific filtering
 * - Scheduled daily monitoring
 */

import dotenv from 'dotenv';
dotenv.config();

// Use local type definition for cross-package compatibility
type Job<T = any> = { id?: string; name: string; data: T; attemptsMade: number; opts: any };
import pino from 'pino';
import { getQueueService, type JobType } from './compat/repo-utils';

const logger = pino({ name: 'obligation-tracker-worker' });

// ============================================================================
// TYPES
// ============================================================================

export interface ObligationCheckJobData {
  tenantId?: string;
  /** How many days ahead to check (default: 30) */
  daysAhead?: number;
  /** Whether to include overdue obligations (default: true) */
  includeOverdue?: boolean;
  /** Filter by obligation type */
  obligationType?: 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'all';
  /** Filter by party name */
  partyFilter?: string;
  /** Alert threshold for critical (default: 3 days) */
  criticalThresholdDays?: number;
  /** Alert threshold for warning (default: 7 days) */
  warningThresholdDays?: number;
  /** Priority of the check */
  priority?: 'high' | 'normal' | 'low';
  /** Source that triggered the check */
  source?: 'scheduled' | 'manual' | 'webhook';
}

export interface ObligationAlert {
  contractId: string;
  contractName: string;
  obligationId: string;
  obligationTitle: string;
  party: string;
  type: 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'other';
  alertType: 'critical' | 'warning' | 'info' | 'overdue';
  message: string;
  dueDate: string | null;
  daysRemaining: number | null;
  slaCriteria?: {
    metric: string;
    target: string | number;
    unit?: string;
  };
  penalty?: string;
  tenantId: string;
  sourceClause?: string;
}

export interface SLAStatusAlert {
  contractId: string;
  contractName: string;
  metric: string;
  target: string | number;
  currentValue?: string | number;
  status: 'met' | 'at-risk' | 'breached';
  penalty?: string;
  tenantId: string;
}

export interface ObligationCheckResult {
  success: boolean;
  obligationAlerts: number;
  slaAlerts: number;
  contractsChecked: number;
  obligations: ObligationAlert[];
  slaStatuses: SLAStatusAlert[];
  processingTimeMs: number;
  errors?: string[];
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const OBLIGATION_TRACKER_QUEUE = 'obligation-tracker';

export const OBLIGATION_TRACKER_CONFIG = {
  name: OBLIGATION_TRACKER_QUEUE,
  concurrency: 2,
  limiter: {
    max: 10,
    duration: 60000, // 10 per minute
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
      age: 7 * 24 * 60 * 60, // 7 days
    },
    removeOnFail: {
      count: 200,
      age: 30 * 24 * 60 * 60, // 30 days
    },
  },
};

const OBLIGATION_TYPE_FILTERS: Record<NonNullable<ObligationCheckJobData['obligationType']>, string[] | null> = {
  deliverable: ['DELIVERY'],
  sla: ['SERVICE_LEVEL'],
  milestone: ['MILESTONE'],
  reporting: ['REPORTING'],
  compliance: ['COMPLIANCE'],
  all: null,
};

type PendingNotification = {
  obligationId: string;
  contractId: string;
  tenantId: string;
  type: 'reminder' | 'alert' | 'escalation';
  subject: string;
  message: string;
  scheduledFor: Date;
  recipients: Array<{ userId?: string; email?: string; name?: string }>;
};

function mapObligationTypeToAlertType(type?: string | null): ObligationAlert['type'] {
  switch ((type || '').toUpperCase()) {
    case 'DELIVERY':
      return 'deliverable';
    case 'SERVICE_LEVEL':
      return 'sla';
    case 'MILESTONE':
      return 'milestone';
    case 'REPORTING':
      return 'reporting';
    case 'COMPLIANCE':
      return 'compliance';
    default:
      return 'other';
  }
}

function mapOwnerLabel(owner?: string | null): string {
  switch ((owner || '').toUpperCase()) {
    case 'US':
      return 'Us';
    case 'COUNTERPARTY':
      return 'Counterparty';
    case 'BOTH':
      return 'Both Parties';
    case 'THIRD_PARTY':
      return 'Third Party';
    default:
      return 'Unknown';
  }
}

function parseReminderDays(value: unknown, fallback: number[]): number[] {
  const candidates = Array.isArray(value) ? value : fallback;
  const parsed = candidates
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
}

function matchesPartyFilter(
  partyFilter: string | undefined,
  owner?: string | null,
  assignedName?: string | null
): boolean {
  if (!partyFilter) return true;

  const normalizedFilter = partyFilter.trim().toLowerCase();
  const candidates = [owner, assignedName]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());

  return candidates.some((candidate) =>
    candidate === normalizedFilter || candidate.includes(normalizedFilter)
  );
}

function mapAlertTypeToNotificationType(
  alertType: ObligationAlert['alertType']
): PendingNotification['type'] {
  if (alertType === 'overdue') return 'escalation';
  if (alertType === 'info') return 'reminder';
  return 'alert';
}

function buildNotificationSubject(alert: ObligationAlert): string {
  if (alert.alertType === 'overdue') {
    return `Overdue obligation: ${alert.obligationTitle}`;
  }

  if (alert.alertType === 'critical') {
    return `Critical obligation due soon: ${alert.obligationTitle}`;
  }

  if (alert.alertType === 'warning') {
    return `Upcoming obligation: ${alert.obligationTitle}`;
  }

  return `Obligation reminder: ${alert.obligationTitle}`;
}

// ============================================================================
// WORKER FUNCTION
// ============================================================================

/**
 * Process an obligation check job
 */
export async function checkObligationsJob(
  job: JobType<ObligationCheckJobData>
): Promise<ObligationCheckResult> {
  const { 
    tenantId, 
    daysAhead = 30, 
    includeOverdue = true,
    obligationType = 'all',
    partyFilter,
    criticalThresholdDays = 3,
    warningThresholdDays = 7,
    source = 'scheduled'
  } = job.data;

  const startTime = Date.now();
  const errors: string[] = [];
  const obligations: ObligationAlert[] = [];
  const slaStatuses: SLAStatusAlert[] = [];

  logger.info(
    { tenantId, daysAhead, includeOverdue, source, jobId: job.id },
    'Starting obligation check scan'
  );

  try {
    await job.updateProgress(5);

    // Dynamic import to avoid circular dependencies
    const getClient = (await import('clients-db')).default;
    const prisma = getClient();
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setHours(23, 59, 59, 999);
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const obligationWhere: Record<string, any> = {
      status: {
        notIn: ['COMPLETED', 'WAIVED', 'CANCELLED'],
      },
      OR: includeOverdue
        ? [
            { dueDate: { not: null, lte: cutoffDate } },
            { nextOccurrenceDate: { not: null, lte: cutoffDate } },
          ]
        : [
            { dueDate: { not: null, gte: today, lte: cutoffDate } },
            { nextOccurrenceDate: { not: null, gte: today, lte: cutoffDate } },
          ],
    };

    if (tenantId) {
      obligationWhere.tenantId = tenantId;
    }

    const typeFilter = OBLIGATION_TYPE_FILTERS[obligationType] || null;
    if (typeFilter) {
      obligationWhere.type = { in: typeFilter };
    }

    const trackedObligations = await prisma.obligation.findMany({
      where: obligationWhere,
      include: {
        contract: {
          select: {
            id: true,
            tenantId: true,
            contractTitle: true,
            originalName: true,
            fileName: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await job.updateProgress(20);

    let processedCount = 0;
    const totalObligations = trackedObligations.length;
    const pendingNotifications: PendingNotification[] = [];
    const pendingStatusUpdates = new Map<string, 'OVERDUE' | 'AT_RISK'>();

    for (const obligation of trackedObligations) {
      try {
        const dueDate = obligation.nextOccurrenceDate || obligation.dueDate;
        const assignedName = obligation.assignedToUser
          ? `${obligation.assignedToUser.firstName || ''} ${obligation.assignedToUser.lastName || ''}`.trim() || obligation.assignedToUser.email
          : null;

        if (!dueDate || !matchesPartyFilter(partyFilter, obligation.owner, assignedName)) {
          processedCount++;
          const progress = 20 + Math.floor((processedCount / Math.max(totalObligations, 1)) * 70);
          await job.updateProgress(progress);
          continue;
        }

        const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const reminderDays = parseReminderDays(obligation.reminderDays, [30, 14, warningThresholdDays, criticalThresholdDays, 7, 1]);

        let alertType: ObligationAlert['alertType'] | null = null;
        if (includeOverdue && daysRemaining < 0) {
          alertType = 'overdue';
          if (obligation.status !== 'OVERDUE') {
            pendingStatusUpdates.set(obligation.id, 'OVERDUE');
          }
        } else if (
          daysRemaining >= 0 &&
          daysRemaining <= daysAhead &&
          (daysRemaining <= warningThresholdDays || reminderDays.includes(daysRemaining))
        ) {
          alertType = daysRemaining <= criticalThresholdDays
            ? 'critical'
            : daysRemaining <= warningThresholdDays
              ? 'warning'
              : 'info';

          if (daysRemaining <= criticalThresholdDays && obligation.status !== 'AT_RISK') {
            pendingStatusUpdates.set(obligation.id, 'AT_RISK');
          }
        }

        if (!alertType) {
          processedCount++;
          const progress = 20 + Math.floor((processedCount / Math.max(totalObligations, 1)) * 70);
          await job.updateProgress(progress);
          continue;
        }

        const contractName = obligation.contract.contractTitle || obligation.contract.originalName || obligation.contract.fileName || 'Unnamed Contract';
        const obligationTypeLabel = mapObligationTypeToAlertType(obligation.type);
        const alert: ObligationAlert = {
          contractId: obligation.contractId,
          contractName,
          obligationId: obligation.id,
          obligationTitle: obligation.title,
          party: mapOwnerLabel(obligation.owner),
          type: obligationTypeLabel,
          alertType,
          message: alertType === 'overdue'
            ? `Overdue by ${Math.abs(daysRemaining)} days: ${obligation.title}`
            : `Due in ${daysRemaining} days: ${obligation.title}`,
          dueDate: dueDate.toISOString(),
          daysRemaining,
          penalty: obligation.penaltyForMissing || undefined,
          tenantId: obligation.tenantId,
          sourceClause: obligation.clauseReference || obligation.sourceSection || undefined,
        };

        obligations.push(alert);

        if (obligation.type === 'SERVICE_LEVEL' && alertType !== 'info') {
          slaStatuses.push({
            contractId: obligation.contractId,
            contractName,
            metric: obligation.title,
            target: dueDate.toISOString(),
            currentValue: alertType === 'overdue'
              ? `${Math.abs(daysRemaining)} days overdue`
              : `${daysRemaining} days remaining`,
            status: alertType === 'overdue' ? 'breached' : 'at-risk',
            penalty: obligation.penaltyForMissing || undefined,
            tenantId: obligation.tenantId,
          });
        }

        pendingNotifications.push({
          obligationId: obligation.id,
          contractId: obligation.contractId,
          tenantId: obligation.tenantId,
          type: mapAlertTypeToNotificationType(alertType),
          subject: buildNotificationSubject(alert),
          message: alert.message,
          scheduledFor: new Date(),
          recipients: obligation.assignedToUser
            ? [{
                userId: obligation.assignedToUser.id,
                email: obligation.assignedToUser.email,
                name: assignedName || obligation.assignedToUser.email,
              }]
            : [],
        });

        processedCount++;
        const progress = 20 + Math.floor((processedCount / Math.max(totalObligations, 1)) * 70);
        await job.updateProgress(progress);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Obligation ${obligation.id}: ${errorMsg}`);
        logger.error({ error, obligationId: obligation.id }, 'Error processing persisted obligation');
      }
    }

    if (pendingNotifications.length > 0) {
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      const existingNotifications = await prisma.obligationNotification.findMany({
        where: {
          obligationId: { in: Array.from(new Set(pendingNotifications.map((notification) => notification.obligationId))) },
          status: { in: ['PENDING', 'SENT'] },
          createdAt: { gte: startOfDay },
        },
        select: {
          obligationId: true,
          type: true,
        },
      });

      const existingKeys = new Set(
        existingNotifications.map((notification) => `${notification.obligationId}:${String(notification.type).toLowerCase()}`)
      );

      const notificationCounts = new Map<string, number>();

      for (const notification of pendingNotifications) {
        const dedupeKey = `${notification.obligationId}:${notification.type}`;
        if (existingKeys.has(dedupeKey)) {
          continue;
        }

        await prisma.obligationNotification.create({
          data: {
            tenantId: notification.tenantId,
            contractId: notification.contractId,
            obligationId: notification.obligationId,
            type: notification.type,
            status: 'PENDING',
            scheduledFor: notification.scheduledFor,
            subject: notification.subject,
            message: notification.message,
            recipients: notification.recipients,
          },
        });

        existingKeys.add(dedupeKey);
        notificationCounts.set(
          notification.obligationId,
          (notificationCounts.get(notification.obligationId) || 0) + 1
        );
      }

      const now = new Date();
      await Promise.all(
        Array.from(new Set([
          ...Array.from(notificationCounts.keys()),
          ...Array.from(pendingStatusUpdates.keys()),
        ])).map(async (obligationId) => {
          const data: Record<string, unknown> = {};
          const nextStatus = pendingStatusUpdates.get(obligationId);
          const reminderIncrement = notificationCounts.get(obligationId) || 0;

          if (nextStatus) {
            data.status = nextStatus;
          }

          if (reminderIncrement > 0) {
            data.lastReminderAt = now;
            data.remindersSent = { increment: reminderIncrement };
          }

          if (Object.keys(data).length === 0) {
            return;
          }

          await prisma.obligation.update({
            where: { id: obligationId },
            data,
          });
        })
      );
    } else if (pendingStatusUpdates.size > 0) {
      await Promise.all(
        Array.from(pendingStatusUpdates.entries()).map(async ([obligationId, status]) => {
          await prisma.obligation.update({
            where: { id: obligationId },
            data: { status },
          });
        })
      );
    }

    // Sort by urgency (overdue first, then by days remaining)
    obligations.sort((a, b) => {
      if (a.alertType === 'overdue' && b.alertType !== 'overdue') return -1;
      if (a.alertType !== 'overdue' && b.alertType === 'overdue') return 1;
      return (a.daysRemaining || 0) - (b.daysRemaining || 0);
    });

    await job.updateProgress(100);

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      { 
        contractsChecked: new Set(trackedObligations.map((obligation) => obligation.contractId)).size, 
        obligationAlerts: obligations.length,
        slaAlerts: slaStatuses.length,
        processingTimeMs
      },
      'Obligation check completed'
    );

    return {
      success: true,
      obligationAlerts: obligations.length,
      slaAlerts: slaStatuses.length,
      contractsChecked: new Set(trackedObligations.map((obligation) => obligation.contractId)).size,
      obligations,
      slaStatuses,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    
    logger.error({ error, jobId: job.id }, 'Obligation check failed');
    
    return {
      success: false,
      obligationAlerts: 0,
      slaAlerts: 0,
      contractsChecked: 0,
      obligations: [],
      slaStatuses: [],
      processingTimeMs,
      errors,
    };
  }
}

// ============================================================================
// SCHEDULING & REGISTRATION
// ============================================================================

/**
 * Schedule daily obligation checks
 */
export async function scheduleObligationCheck(tenantId?: string, options?: Partial<ObligationCheckJobData>) {
  const { getQueueService } = await import('@repo/utils/queue/queue-service');
  const queueService = getQueueService();
  const queue = queueService.getQueue(OBLIGATION_TRACKER_QUEUE);

  await queue.add(
    'check-obligations',
    { 
      tenantId, 
      daysAhead: options?.daysAhead ?? 30, 
      includeOverdue: options?.includeOverdue ?? true,
      source: 'scheduled',
      ...options
    },
    {
      jobId: tenantId ? `obligation-daily:${tenantId}` : 'obligation-daily:all-tenants',
      repeat: {
        pattern: '0 7 * * *', // Run daily at 7 AM
      },
      ...OBLIGATION_TRACKER_CONFIG.defaultJobOptions,
    }
  );

  logger.info({ tenantId }, 'Scheduled daily obligation check');
}

/**
 * Trigger immediate obligation check
 */
export async function triggerObligationCheck(data: ObligationCheckJobData) {
  const { getQueueService } = await import('@repo/utils/queue/queue-service');
  const queueService = getQueueService();
  const queue = queueService.getQueue(OBLIGATION_TRACKER_QUEUE);

  const job = await queue.add(
    'manual-obligation-check',
    { ...data, source: data.source || 'manual' },
    {
      priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5,
      ...OBLIGATION_TRACKER_CONFIG.defaultJobOptions,
    }
  );

  logger.info({ jobId: job.id, tenantId: data.tenantId }, 'Triggered manual obligation check');
  return job;
}

/**
 * Get obligation summary for a specific contract
 */
export async function getContractObligationSummary(contractId: string) {
  const getClient = (await import('clients-db')).default;
  const prisma = getClient();
  
  const artifact = await prisma.artifact.findFirst({
    where: {
      contractId,
      type: 'OBLIGATIONS',
    },
  });

  if (!artifact) {
    return null;
  }

  const data = artifact.data as any;
  const today = new Date();

  const upcomingObligations = (data.obligations || []).filter((obl: any) => {
    if (!obl.dueDate) return false;
    const dueDate = new Date(obl.dueDate);
    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining >= 0 && daysRemaining <= 30;
  });

  const overdueObligations = (data.obligations || []).filter((obl: any) => {
    if (!obl.dueDate) return false;
    const dueDate = new Date(obl.dueDate);
    return dueDate < today;
  });

  const atRiskSLAs = (data.slaMetrics || []).filter((sla: any) => 
    sla.status === 'at-risk' || sla.status === 'breached'
  );

  return {
    totalObligations: (data.obligations || []).length,
    upcomingCount: upcomingObligations.length,
    overdueCount: overdueObligations.length,
    atRiskSLACount: atRiskSLAs.length,
    upcomingObligations,
    overdueObligations,
    atRiskSLAs,
    milestones: data.milestones || [],
    summary: data.summary,
  };
}

/**
 * Register obligation tracker worker
 */
export function registerObligationTrackerWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker(
    OBLIGATION_TRACKER_QUEUE,
    checkObligationsJob,
    {
      concurrency: OBLIGATION_TRACKER_CONFIG.concurrency,
      limiter: OBLIGATION_TRACKER_CONFIG.limiter,
    }
  );

  logger.info('Obligation tracker worker registered');

  return worker;
}
