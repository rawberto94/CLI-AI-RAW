/**
 * Renewal Alert Worker
 * 
 * Background worker that scans contracts for upcoming renewal deadlines,
 * opt-out dates, and termination notice periods.
 * 
 * Features:
 * - Configurable scan windows (days ahead)
 * - Priority-based alerting (critical/warning/info)
 * - Per-tenant or global scanning
 * - Scheduled daily checks
 * - Auto-renewal detection
 */

import dotenv from 'dotenv';
dotenv.config();

import type { Job } from 'bullmq';
import pino from 'pino';
import { getQueueService, JobType } from 'utils/queue/queue-service';

const logger = pino({ name: 'renewal-alert-worker' });

// ============================================================================
// TYPES
// ============================================================================

export interface RenewalCheckJobData {
  tenantId?: string;
  /** How many days ahead to check for renewals (default: 90) */
  daysAhead?: number;
  /** Alert threshold for critical alerts (default: 14 days) */
  criticalThresholdDays?: number;
  /** Alert threshold for warning alerts (default: 30 days) */
  warningThresholdDays?: number;
  /** Whether to include auto-renewal contracts only */
  autoRenewalOnly?: boolean;
  /** Priority of the check */
  priority?: 'high' | 'normal' | 'low';
  /** Source that triggered the check */
  source?: 'scheduled' | 'manual' | 'webhook';
}

export interface RenewalAlert {
  contractId: string;
  contractName: string;
  alertType: 'critical' | 'warning' | 'info';
  message: string;
  dueDate: string;
  daysRemaining: number;
  autoRenewal: boolean;
  tenantId: string;
  sourceClause?: string;
}

export interface RenewalCheckResult {
  success: boolean;
  alertsGenerated: number;
  contractsChecked: number;
  alerts: RenewalAlert[];
  processingTimeMs: number;
  errors?: string[];
}

// ============================================================================
// QUEUE CONFIGURATION
// ============================================================================

export const RENEWAL_ALERT_QUEUE = 'renewal-alerts';

export const RENEWAL_ALERT_CONFIG = {
  name: RENEWAL_ALERT_QUEUE,
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

// ============================================================================
// WORKER FUNCTION
// ============================================================================

/**
 * Process a renewal check job
 */
export async function checkRenewalsJob(
  job: JobType<RenewalCheckJobData>
): Promise<RenewalCheckResult> {
  const { 
    tenantId, 
    daysAhead = 90,
    criticalThresholdDays = 14,
    warningThresholdDays = 30,
    autoRenewalOnly = false,
    source = 'scheduled'
  } = job.data;

  const startTime = Date.now();
  const errors: string[] = [];
  const alerts: RenewalAlert[] = [];

  logger.info(
    { tenantId, daysAhead, source, jobId: job.id },
    'Starting renewal check scan'
  );

  try {
    await job.updateProgress(5);

    // Dynamic import to avoid circular dependencies
    const getClient = (await import('clients-db')).default;
    const prisma = getClient();

    // Build query for contracts with renewal artifacts
    const whereClause: any = {
      artifacts: {
        some: {
          type: 'RENEWAL',
        },
      },
      status: 'COMPLETED',
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    // Fetch contracts with renewal artifacts
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      include: {
        artifacts: {
          where: { type: 'RENEWAL' },
        },
      },
    });

    await job.updateProgress(20);

    const today = new Date();

    let processedCount = 0;
    const totalContracts = contracts.length;

    for (const contract of contracts) {
      try {
        const renewalArtifact = contract.artifacts[0];
        if (!renewalArtifact) continue;

        const renewalData = renewalArtifact.data as any;
        
        // Skip non-auto-renewal if filter is set
        if (autoRenewalOnly && !renewalData.autoRenewal) continue;
        
        // Check current term end date
        if (renewalData.currentTermEnd) {
          const termEndDate = new Date(renewalData.currentTermEnd);
          const daysUntilEnd = Math.ceil((termEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilEnd > 0 && daysUntilEnd <= daysAhead) {
            const alertType = daysUntilEnd <= criticalThresholdDays ? 'critical' : daysUntilEnd <= warningThresholdDays ? 'warning' : 'info';
            
            alerts.push({
              contractId: contract.id,
              contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
              alertType,
              message: `Contract term ends in ${daysUntilEnd} days`,
              dueDate: renewalData.currentTermEnd,
              daysRemaining: daysUntilEnd,
              autoRenewal: renewalData.autoRenewal || false,
              tenantId: contract.tenantId,
              sourceClause: renewalData.renewalTerms?.source,
            });
          }
        }

        // Check opt-out deadlines
        if (renewalData.optOutDeadlines && Array.isArray(renewalData.optOutDeadlines)) {
          for (const deadline of renewalData.optOutDeadlines) {
            if (deadline.date) {
              const optOutDate = new Date(deadline.date);
              const daysUntilOptOut = Math.ceil((optOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              if (daysUntilOptOut > 0 && daysUntilOptOut <= daysAhead) {
                const alertType = daysUntilOptOut <= 7 ? 'critical' : daysUntilOptOut <= 21 ? 'warning' : 'info';
                
                alerts.push({
                  contractId: contract.id,
                  contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                  alertType,
                  message: `Opt-out deadline in ${daysUntilOptOut} days: ${deadline.description || 'Auto-renewal opt-out'}`,
                  dueDate: deadline.date,
                  daysRemaining: daysUntilOptOut,
                  autoRenewal: renewalData.autoRenewal || false,
                  tenantId: contract.tenantId,
                });
              }
            }
          }
        }

        // Check renewal terms notice period
        if (renewalData.renewalTerms?.optOutDeadline) {
          const optOutDate = new Date(renewalData.renewalTerms.optOutDeadline);
          const daysUntilOptOut = Math.ceil((optOutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilOptOut > 0 && daysUntilOptOut <= daysAhead) {
            const alertType = daysUntilOptOut <= 7 ? 'critical' : daysUntilOptOut <= 21 ? 'warning' : 'info';
            
            // Avoid duplicate alerts
            const existingAlert = alerts.find(a => 
              a.contractId === contract.id && 
              a.dueDate === renewalData.renewalTerms.optOutDeadline
            );

            if (!existingAlert) {
              alerts.push({
                contractId: contract.id,
                contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                alertType,
                message: `Notice period deadline in ${daysUntilOptOut} days - ${renewalData.renewalTerms.noticePeriodDays || 30} days notice required`,
                dueDate: renewalData.renewalTerms.optOutDeadline,
                daysRemaining: daysUntilOptOut,
                autoRenewal: renewalData.autoRenewal || false,
                tenantId: contract.tenantId,
              });
            }
          }
        }

        processedCount++;
        const progress = 20 + Math.floor((processedCount / totalContracts) * 70);
        await job.updateProgress(progress);

      } catch (error) {
        logger.error({ error, contractId: contract.id }, 'Error processing contract for renewals');
      }
    }

    // Sort alerts by days remaining (most urgent first)
    alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

    await job.updateProgress(100);

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      { contractsChecked: contracts.length, alertsGenerated: alerts.length, processingTimeMs },
      'Renewal check completed'
    );

    return {
      success: true,
      alertsGenerated: alerts.length,
      contractsChecked: contracts.length,
      alerts,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    
    logger.error({ error, jobId: job.id }, 'Renewal check failed');
    
    return {
      success: false,
      alertsGenerated: 0,
      contractsChecked: 0,
      alerts: [],
      processingTimeMs,
      errors,
    };
  }
}

// ============================================================================
// SCHEDULING & REGISTRATION
// ============================================================================

/**
 * Schedule daily renewal checks
 */
export async function scheduleRenewalCheck(tenantId?: string, options?: Partial<RenewalCheckJobData>) {
  const { getQueueService } = await import('utils/queue/queue-service');
  const queueService = getQueueService();
  const queue = queueService.getQueue(RENEWAL_ALERT_QUEUE);

  await queue.add(
    'check-renewals',
    { 
      tenantId, 
      daysAhead: options?.daysAhead ?? 90,
      criticalThresholdDays: options?.criticalThresholdDays ?? 14,
      warningThresholdDays: options?.warningThresholdDays ?? 30,
      source: 'scheduled',
      ...options
    },
    {
      repeat: {
        pattern: '0 8 * * *', // Run daily at 8 AM
      },
      ...RENEWAL_ALERT_CONFIG.defaultJobOptions,
    }
  );

  logger.info({ tenantId }, 'Scheduled daily renewal check');
}

/**
 * Trigger immediate renewal check
 */
export async function triggerRenewalCheck(data: RenewalCheckJobData) {
  const { getQueueService } = await import('utils/queue/queue-service');
  const queueService = getQueueService();
  const queue = queueService.getQueue(RENEWAL_ALERT_QUEUE);

  const job = await queue.add(
    'manual-renewal-check',
    { ...data, source: data.source || 'manual' },
    {
      priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 10 : 5,
      ...RENEWAL_ALERT_CONFIG.defaultJobOptions,
    }
  );

  logger.info({ jobId: job.id, tenantId: data.tenantId }, 'Triggered manual renewal check');
  return job;
}

/**
 * Register renewal alert worker
 */
export function registerRenewalAlertWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker(
    RENEWAL_ALERT_QUEUE,
    checkRenewalsJob,
    {
      concurrency: RENEWAL_ALERT_CONFIG.concurrency,
      limiter: RENEWAL_ALERT_CONFIG.limiter,
    }
  );

  logger.info('Renewal alert worker registered');

  return worker;
}
