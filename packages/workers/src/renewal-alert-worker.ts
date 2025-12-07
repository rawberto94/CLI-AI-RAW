import dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bullmq';
import getClient from 'clients-db';
import { getQueueService } from '../../utils/src/queue/queue-service';
import pino from 'pino';

const logger = pino({ name: 'renewal-alert-worker' });
const prisma = getClient();

// Queue name for renewal alerts
export const RENEWAL_ALERT_QUEUE = 'renewal-alerts';

interface RenewalCheckJobData {
  tenantId?: string; // If provided, only check contracts for this tenant
  daysAhead: number; // How many days ahead to check for renewals
}

interface RenewalAlert {
  contractId: string;
  contractName: string;
  alertType: 'critical' | 'warning' | 'info';
  message: string;
  dueDate: string;
  daysRemaining: number;
  autoRenewal: boolean;
  tenantId: string;
}

interface RenewalCheckResult {
  alertsGenerated: number;
  contractsChecked: number;
  alerts: RenewalAlert[];
}

/**
 * Renewal Alert Worker
 * Scans contracts for upcoming renewal deadlines and opt-out dates
 */
export async function checkRenewalsJob(
  job: Job<RenewalCheckJobData>
): Promise<RenewalCheckResult> {
  const { tenantId, daysAhead = 90 } = job.data;

  logger.info(
    { tenantId, daysAhead, jobId: job.id },
    'Starting renewal check scan'
  );

  const alerts: RenewalAlert[] = [];

  try {
    await job.updateProgress(5);

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
    const checkDate = new Date();
    checkDate.setDate(today.getDate() + daysAhead);

    let processedCount = 0;
    const totalContracts = contracts.length;

    for (const contract of contracts) {
      try {
        const renewalArtifact = contract.artifacts[0];
        if (!renewalArtifact) continue;

        const renewalData = renewalArtifact.data as any;
        
        // Check current term end date
        if (renewalData.currentTermEnd) {
          const termEndDate = new Date(renewalData.currentTermEnd);
          const daysUntilEnd = Math.ceil((termEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilEnd > 0 && daysUntilEnd <= daysAhead) {
            const alertType = daysUntilEnd <= 14 ? 'critical' : daysUntilEnd <= 30 ? 'warning' : 'info';
            
            alerts.push({
              contractId: contract.id,
              contractName: contract.name || 'Unnamed Contract',
              alertType,
              message: `Contract term ends in ${daysUntilEnd} days`,
              dueDate: renewalData.currentTermEnd,
              daysRemaining: daysUntilEnd,
              autoRenewal: renewalData.autoRenewal || false,
              tenantId: contract.tenantId,
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
                  contractName: contract.name || 'Unnamed Contract',
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
                contractName: contract.name || 'Unnamed Contract',
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

    // Store alerts in database if needed (could use a notifications table)
    // For now, we return them for the calling code to handle
    
    await job.updateProgress(100);

    logger.info(
      { contractsChecked: contracts.length, alertsGenerated: alerts.length },
      'Renewal check completed'
    );

    return {
      alertsGenerated: alerts.length,
      contractsChecked: contracts.length,
      alerts,
    };

  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Renewal check failed');
    throw error;
  }
}

/**
 * Schedule daily renewal checks
 */
export async function scheduleRenewalCheck(tenantId?: string) {
  const queueService = getQueueService();
  const queue = queueService.getQueue(RENEWAL_ALERT_QUEUE);

  // Add a job to check renewals
  await queue.add(
    'check-renewals',
    { tenantId, daysAhead: 90 },
    {
      repeat: {
        pattern: '0 8 * * *', // Run daily at 8 AM
      },
      removeOnComplete: { count: 30 }, // Keep last 30 completed jobs
      removeOnFail: { count: 50 },
    }
  );

  logger.info({ tenantId }, 'Scheduled daily renewal check');
}

/**
 * Register renewal alert worker
 */
export function registerRenewalAlertWorker() {
  const queueService = getQueueService();

  const worker = queueService.registerWorker<RenewalCheckJobData, RenewalCheckResult>(
    RENEWAL_ALERT_QUEUE,
    checkRenewalsJob,
    {
      concurrency: 1, // Run one at a time
    }
  );

  logger.info('Renewal alert worker registered');

  return worker;
}
