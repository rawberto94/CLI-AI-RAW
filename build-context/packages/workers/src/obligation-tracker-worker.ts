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
import { getQueueService, JobType } from '@repo/utils/queue/queue-service';

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

    // Build query for contracts with obligation artifacts
    const whereClause: any = {
      artifacts: {
        some: {
          type: 'OBLIGATIONS',
        },
      },
      status: 'COMPLETED',
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    // Fetch contracts with obligation artifacts
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      include: {
        artifacts: {
          where: { type: 'OBLIGATIONS' },
        },
      },
    });

    await job.updateProgress(20);

    const today = new Date();

    let processedCount = 0;
    const totalContracts = contracts.length;

    for (const contract of contracts) {
      try {
        const obligationArtifact = contract.artifacts[0];
        if (!obligationArtifact) continue;

        const obligationData = obligationArtifact.data as any;
        
        // Process individual obligations
        if (obligationData.obligations && Array.isArray(obligationData.obligations)) {
          for (const obl of obligationData.obligations) {
            // Filter by type if specified
            if (obligationType !== 'all' && obl.type !== obligationType) continue;
            
            // Filter by party if specified
            if (partyFilter && obl.party !== partyFilter) continue;
            
            if (obl.dueDate) {
              const dueDate = new Date(obl.dueDate);
              const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              // Check for overdue
              if (includeOverdue && daysRemaining < 0) {
                obligations.push({
                  contractId: contract.id,
                  contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                  obligationId: obl.id,
                  obligationTitle: obl.title,
                  party: obl.party || 'Unknown',
                  type: obl.type || 'other',
                  alertType: 'overdue',
                  message: `Overdue by ${Math.abs(daysRemaining)} days: ${obl.title}`,
                  dueDate: obl.dueDate,
                  daysRemaining,
                  slaCriteria: obl.slaCriteria,
                  penalty: obl.penalty,
                  tenantId: contract.tenantId,
                  sourceClause: obl.sourceClause,
                });
              }
              // Check for upcoming
              else if (daysRemaining >= 0 && daysRemaining <= daysAhead) {
                const alertType = daysRemaining <= criticalThresholdDays ? 'critical' : 
                                  daysRemaining <= warningThresholdDays ? 'warning' : 'info';

                obligations.push({
                  contractId: contract.id,
                  contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                  obligationId: obl.id,
                  obligationTitle: obl.title,
                  party: obl.party || 'Unknown',
                  type: obl.type || 'other',
                  alertType,
                  message: `Due in ${daysRemaining} days: ${obl.title}`,
                  dueDate: obl.dueDate,
                  daysRemaining,
                  slaCriteria: obl.slaCriteria,
                  penalty: obl.penalty,
                  tenantId: contract.tenantId,
                  sourceClause: obl.sourceClause,
                });
              }
            }

            // Track recurring obligations
            if (obl.recurring && !obl.dueDate) {
              obligations.push({
                contractId: contract.id,
                contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                obligationId: obl.id,
                obligationTitle: obl.title,
                party: obl.party || 'Unknown',
                type: obl.type || 'other',
                alertType: 'info',
                message: `Recurring ${obl.recurring.frequency}: ${obl.title}`,
                dueDate: null,
                daysRemaining: null,
                slaCriteria: obl.slaCriteria,
                penalty: obl.penalty,
                tenantId: contract.tenantId,
              });
            }
          }
        }

        // Process milestones
        if (obligationData.milestones && Array.isArray(obligationData.milestones)) {
          for (const milestone of obligationData.milestones) {
            if (obligationType !== 'all' && obligationType !== 'milestone') continue;
            
            if (milestone.date) {
              const milestoneDate = new Date(milestone.date);
              const daysRemaining = Math.ceil((milestoneDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              if (includeOverdue && daysRemaining < 0 && milestone.status !== 'completed') {
                obligations.push({
                  contractId: contract.id,
                  contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                  obligationId: milestone.id,
                  obligationTitle: milestone.name,
                  party: 'Both Parties',
                  type: 'milestone',
                  alertType: 'overdue',
                  message: `Milestone missed by ${Math.abs(daysRemaining)} days: ${milestone.name}`,
                  dueDate: milestone.date,
                  daysRemaining,
                  tenantId: contract.tenantId,
                });
              } else if (daysRemaining >= 0 && daysRemaining <= daysAhead) {
                const alertType = daysRemaining <= warningThresholdDays ? 'critical' : 
                                  daysRemaining <= 14 ? 'warning' : 'info';

                obligations.push({
                  contractId: contract.id,
                  contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                  obligationId: milestone.id,
                  obligationTitle: milestone.name,
                  party: 'Both Parties',
                  type: 'milestone',
                  alertType,
                  message: `Milestone due in ${daysRemaining} days: ${milestone.name}`,
                  dueDate: milestone.date,
                  daysRemaining,
                  tenantId: contract.tenantId,
                });
              }
            }
          }
        }

        // Process SLA metrics
        if (obligationData.slaMetrics && Array.isArray(obligationData.slaMetrics)) {
          for (const sla of obligationData.slaMetrics) {
            if (sla.status === 'at-risk' || sla.status === 'breached') {
              slaStatuses.push({
                contractId: contract.id,
                contractName: (contract.originalName ?? contract.fileName) || 'Unnamed Contract',
                metric: sla.metric,
                target: sla.target,
                currentValue: sla.currentValue,
                status: sla.status,
                penalty: sla.penalty,
                tenantId: contract.tenantId,
              });
            }
          }
        }

        processedCount++;
        const progress = 20 + Math.floor((processedCount / totalContracts) * 70);
        await job.updateProgress(progress);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Contract ${contract.id}: ${errorMsg}`);
        logger.error({ error, contractId: contract.id }, 'Error processing contract for obligations');
      }
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
        contractsChecked: contracts.length, 
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
      contractsChecked: contracts.length,
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
