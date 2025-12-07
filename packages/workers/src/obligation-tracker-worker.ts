import dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bullmq';
import getClient from 'clients-db';
import { getQueueService } from '../../utils/src/queue/queue-service';
import pino from 'pino';

const logger = pino({ name: 'obligation-tracker-worker' });
const prisma = getClient();

// Queue name for obligation tracking
export const OBLIGATION_TRACKER_QUEUE = 'obligation-tracker';

interface ObligationCheckJobData {
  tenantId?: string; // If provided, only check contracts for this tenant
  daysAhead: number; // How many days ahead to check for due obligations
  includeOverdue: boolean; // Whether to include overdue obligations
}

interface ObligationAlert {
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
}

interface SLAStatusAlert {
  contractId: string;
  contractName: string;
  metric: string;
  target: string | number;
  currentValue?: string | number;
  status: 'met' | 'at-risk' | 'breached';
  penalty?: string;
  tenantId: string;
}

interface ObligationCheckResult {
  obligationAlerts: number;
  slaAlerts: number;
  contractsChecked: number;
  obligations: ObligationAlert[];
  slaStatuses: SLAStatusAlert[];
}

/**
 * Obligation Tracker Worker
 * Scans contracts for upcoming obligations, SLA tracking, and milestone deadlines
 */
export async function checkObligationsJob(
  job: Job<ObligationCheckJobData>
): Promise<ObligationCheckResult> {
  const { tenantId, daysAhead = 30, includeOverdue = true } = job.data;

  logger.info(
    { tenantId, daysAhead, includeOverdue, jobId: job.id },
    'Starting obligation check scan'
  );

  const obligations: ObligationAlert[] = [];
  const slaStatuses: SLAStatusAlert[] = [];

  try {
    await job.updateProgress(5);

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
    const checkDate = new Date();
    checkDate.setDate(today.getDate() + daysAhead);

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
            if (obl.dueDate) {
              const dueDate = new Date(obl.dueDate);
              const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              // Check for overdue
              if (includeOverdue && daysRemaining < 0) {
                obligations.push({
                  contractId: contract.id,
                  contractName: contract.name || 'Unnamed Contract',
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
                });
              }
              // Check for upcoming
              else if (daysRemaining >= 0 && daysRemaining <= daysAhead) {
                let alertType: 'critical' | 'warning' | 'info';
                if (daysRemaining <= 3) {
                  alertType = 'critical';
                } else if (daysRemaining <= 7) {
                  alertType = 'warning';
                } else {
                  alertType = 'info';
                }

                obligations.push({
                  contractId: contract.id,
                  contractName: contract.name || 'Unnamed Contract',
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
                });
              }
            }

            // Track recurring obligations
            if (obl.recurring && !obl.dueDate) {
              obligations.push({
                contractId: contract.id,
                contractName: contract.name || 'Unnamed Contract',
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
            if (milestone.date) {
              const milestoneDate = new Date(milestone.date);
              const daysRemaining = Math.ceil((milestoneDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              if (includeOverdue && daysRemaining < 0 && milestone.status !== 'completed') {
                obligations.push({
                  contractId: contract.id,
                  contractName: contract.name || 'Unnamed Contract',
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
                const alertType = daysRemaining <= 7 ? 'critical' : daysRemaining <= 14 ? 'warning' : 'info';

                obligations.push({
                  contractId: contract.id,
                  contractName: contract.name || 'Unnamed Contract',
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
                contractName: contract.name || 'Unnamed Contract',
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

    logger.info(
      { 
        contractsChecked: contracts.length, 
        obligationAlerts: obligations.length,
        slaAlerts: slaStatuses.length 
      },
      'Obligation check completed'
    );

    return {
      obligationAlerts: obligations.length,
      slaAlerts: slaStatuses.length,
      contractsChecked: contracts.length,
      obligations,
      slaStatuses,
    };

  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Obligation check failed');
    throw error;
  }
}

/**
 * Schedule daily obligation checks
 */
export async function scheduleObligationCheck(tenantId?: string) {
  const queueService = getQueueService();
  const queue = queueService.getQueue(OBLIGATION_TRACKER_QUEUE);

  // Add a job to check obligations
  await queue.add(
    'check-obligations',
    { tenantId, daysAhead: 30, includeOverdue: true },
    {
      repeat: {
        pattern: '0 7 * * *', // Run daily at 7 AM
      },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 50 },
    }
  );

  logger.info({ tenantId }, 'Scheduled daily obligation check');
}

/**
 * Get obligation summary for a specific contract
 */
export async function getContractObligationSummary(contractId: string) {
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

  const worker = queueService.registerWorker<ObligationCheckJobData, ObligationCheckResult>(
    OBLIGATION_TRACKER_QUEUE,
    checkObligationsJob,
    {
      concurrency: 1,
    }
  );

  logger.info('Obligation tracker worker registered');

  return worker;
}
