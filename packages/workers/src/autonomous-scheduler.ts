/**
 * Autonomous Agent Scheduler
 * 
 * Bridges the AutonomousAgentOrchestrator's trigger definitions to BullMQ
 * repeatable (cron) jobs. This is the missing piece that actually DEPLOYS
 * the 6 default triggers (contract expiry, anomaly detection, savings scanner,
 * compliance audit, workflow escalation, auto-start workflows).
 * 
 * Architecture:
 * - Reads trigger definitions from DB (AgentTrigger table)
 * - Creates BullMQ repeatable jobs with cron patterns
 * - Each tick evaluates whether the trigger condition is met
 * - If met, creates an AgentGoal and enqueues agent-orchestration work
 */

import { getQueueService } from '@repo/utils/queue/queue-service';
import { QUEUE_NAMES, JOB_NAMES } from '@repo/utils/queue/contract-queue';
import clientsDb from 'clients-db';
import pino from 'pino';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();
const logger = pino({ name: 'autonomous-scheduler' });

// ============================================================================
// TRIGGER DEFINITIONS (synced to DB on startup)
// ============================================================================

interface TriggerDefinition {
  name: string;
  type: 'SCHEDULE' | 'EVENT';
  cronExpression?: string;
  eventType?: string;
  goalType: string;
  goalTitle: string;
  goalDescription: string;
  priority: number; // 1=highest, 10=lowest
}

const DEFAULT_TRIGGERS: TriggerDefinition[] = [
  {
    name: 'Contract Expiry Alert',
    type: 'SCHEDULE',
    cronExpression: '0 9 * * *', // Daily at 9 AM
    goalType: 'contract_expiry_review',
    goalTitle: 'Review Expiring Contracts',
    goalDescription: 'Review contracts expiring in the next 30 days and prepare renewal recommendations',
    priority: 2,
  },
  {
    name: 'Savings Opportunity Scanner',
    type: 'SCHEDULE',
    cronExpression: '0 6 * * 1', // Every Monday at 6 AM
    goalType: 'savings_opportunity_scan',
    goalTitle: 'Scan for Cost Savings',
    goalDescription: 'Analyze contracts and spending patterns to identify cost savings opportunities',
    priority: 5,
  },
  {
    name: 'Compliance Audit',
    type: 'SCHEDULE',
    cronExpression: '0 0 1 * *', // First day of each month
    goalType: 'compliance_audit',
    goalTitle: 'Monthly Compliance Audit',
    goalDescription: 'Perform automated compliance audit across all active contracts',
    priority: 2,
  },
  {
    name: 'Workflow Escalation Check',
    type: 'SCHEDULE',
    cronExpression: '0 */4 * * *', // Every 4 hours
    goalType: 'workflow_escalation',
    goalTitle: 'Check Overdue Workflows',
    goalDescription: 'Check for overdue workflow steps and escalate as needed',
    priority: 3,
  },
  {
    name: 'Contract Health Monitor',
    type: 'SCHEDULE',
    cronExpression: '0 7 * * *', // Daily at 7 AM
    goalType: 'contract_health_check',
    goalTitle: 'Daily Contract Health Check',
    goalDescription: 'Monitor key contract health indicators: obligations due, milestones approaching, risk signals',
    priority: 3,
  },
  {
    name: 'Post-Upload Intelligence',
    type: 'EVENT',
    eventType: 'contract_indexed',
    goalType: 'auto_intelligence_brief',
    goalTitle: 'Generate Contract Intelligence Brief',
    goalDescription: 'Automatically analyze newly indexed contract: extract key terms, assess risks, compare clauses, generate intelligence brief',
    priority: 1,
  },
];

// ============================================================================
// TRIGGER EVALUATION LOGIC
// ============================================================================

/**
 * Evaluate a scheduled trigger — check if there's actual work to do
 * Returns tenant IDs that need this goal executed
 */
async function evaluateScheduledTrigger(goalType: string): Promise<string[]> {
  const tenantsWithWork: string[] = [];

  try {
    switch (goalType) {
      case 'contract_expiry_review': {
        // Find tenants with contracts expiring in next 30 days
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
        const results = await prisma.$queryRaw<Array<{ tenantId: string }>>`
          SELECT DISTINCT "tenantId"
          FROM "Contract"
          WHERE "endDate" IS NOT NULL
            AND "endDate" <= ${thirtyDaysOut}
            AND "endDate" >= NOW()
            AND "status" IN ('ACTIVE', 'PENDING')
        `;
        tenantsWithWork.push(...results.map((r: any) => r.tenantId));
        break;
      }

      case 'savings_opportunity_scan': {
        // Find tenants with enough active contracts to warrant analysis
        const results = await prisma.$queryRaw<Array<{ tenantId: string; cnt: bigint }>>`
          SELECT "tenantId", COUNT(*) as cnt
          FROM "Contract"
          WHERE "status" = 'ACTIVE'
          GROUP BY "tenantId"
          HAVING COUNT(*) >= 5
        `;
        tenantsWithWork.push(...results.map((r: any) => r.tenantId));
        break;
      }

      case 'compliance_audit': {
        // All tenants with active contracts get monthly compliance audit
        const results = await prisma.$queryRaw<Array<{ tenantId: string }>>`
          SELECT DISTINCT "tenantId"
          FROM "Contract"
          WHERE "status" IN ('ACTIVE', 'PENDING')
        `;
        tenantsWithWork.push(...results.map((r: any) => r.tenantId));
        break;
      }

      case 'workflow_escalation': {
        // Find tenants with overdue workflow steps
        const results = await prisma.$queryRaw<Array<{ tenantId: string }>>`
          SELECT DISTINCT wf."tenantId"
          FROM "WorkflowExecution" wf
          WHERE wf."status" = 'IN_PROGRESS'
            AND wf."updatedAt" < NOW() - INTERVAL '24 hours'
        `;
        tenantsWithWork.push(...results.map((r: any) => r.tenantId));
        break;
      }

      case 'contract_health_check': {
        // All active tenants
        const results = await prisma.$queryRaw<Array<{ tenantId: string }>>`
          SELECT DISTINCT "tenantId"
          FROM "Contract"
          WHERE "status" = 'ACTIVE'
            AND "updatedAt" > NOW() - INTERVAL '90 days'
        `;
        tenantsWithWork.push(...results.map((r: any) => r.tenantId));
        break;
      }
    }
  } catch (error) {
    logger.error({ goalType, error: (error as Error).message }, 'Trigger evaluation failed');
  }

  return tenantsWithWork;
}

// ============================================================================
// GOAL CREATION
// ============================================================================

/**
 * Create an AgentGoal in the database and enqueue it for execution
 */
async function createAndEnqueueGoal(
  tenantId: string,
  trigger: TriggerDefinition
): Promise<void> {
  try {
    // Check for recent duplicate goals (don't re-trigger if one is already running)
    const recentGoal = await prisma.agentGoal.findFirst({
      where: {
        tenantId,
        type: trigger.goalType,
        status: { in: ['PENDING', 'PLANNING', 'EXECUTING', 'AWAITING_APPROVAL'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
      },
    });

    if (recentGoal) {
      logger.debug({ tenantId, goalType: trigger.goalType, existingGoalId: recentGoal.id }, 'Skipping — goal already in progress');
      return;
    }

    // Create goal in DB
    const goal = await prisma.agentGoal.create({
      data: {
        tenantId,
        type: trigger.goalType,
        title: trigger.goalTitle,
        description: trigger.goalDescription,
        priority: trigger.priority,
        status: 'PENDING',
        context: { trigger: trigger.name, automated: true },
      },
    });

    // Enqueue for the agent orchestrator worker
    const queueService = getQueueService();
    await queueService.addJob(
      QUEUE_NAMES.AGENT_ORCHESTRATION,
      JOB_NAMES.RUN_AGENT,
      {
        contractId: 'system', // System-level goal, not contract-specific
        tenantId,
        goalId: goal.id,
        goalType: trigger.goalType,
        iteration: 0,
        autonomous: true,
      },
      {
        priority: trigger.priority,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      } as any
    );

    logger.info({ tenantId, goalType: trigger.goalType, goalId: goal.id }, 'Autonomous goal created and enqueued');

    // Update trigger last-fired timestamp
    await prisma.agentTrigger.updateMany({
      where: { tenantId: 'system', name: trigger.name },
      data: { lastTriggeredAt: new Date(), triggerCount: { increment: 1 } },
    });
  } catch (error) {
    logger.error({ tenantId, goalType: trigger.goalType, error: (error as Error).message }, 'Failed to create autonomous goal');
  }
}

// ============================================================================
// SCHEDULED TRIGGER RUNNER (called by BullMQ repeatable jobs)
// ============================================================================

/**
 * Process a scheduled trigger tick — evaluate condition and fire if needed
 */
export async function processScheduledTrigger(
  triggerName: string,
  goalType: string,
  trigger: TriggerDefinition
): Promise<{ tenantsProcessed: number; goalsCreated: number }> {
  logger.info({ triggerName, goalType }, 'Evaluating scheduled trigger');

  const tenantsWithWork = await evaluateScheduledTrigger(goalType);
  let goalsCreated = 0;

  for (const tenantId of tenantsWithWork) {
    await createAndEnqueueGoal(tenantId, trigger);
    goalsCreated++;
  }

  logger.info({ triggerName, tenantsEvaluated: tenantsWithWork.length, goalsCreated }, 'Trigger evaluation complete');
  return { tenantsProcessed: tenantsWithWork.length, goalsCreated };
}

// ============================================================================
// EVENT-BASED TRIGGER (called directly by upload pipeline, etc.)
// ============================================================================

/**
 * Fire an event-based trigger (e.g., contract_uploaded)
 * Called from upload route or worker after contract processing completes.
 */
export async function fireEventTrigger(
  eventType: string,
  data: { contractId: string; tenantId: string; userId?: string; [key: string]: unknown }
): Promise<void> {
  logger.info({ eventType, contractId: data.contractId }, 'Event trigger fired');

  // Find matching active event triggers
  const triggers = await prisma.agentTrigger.findMany({
    where: { eventType, isActive: true },
  });

  // Also match against default event triggers
  const eventTriggers = DEFAULT_TRIGGERS.filter(t => t.type === 'EVENT' && t.eventType === eventType);

  for (const trigger of [...eventTriggers, ...triggers.map((t: any) => ({
    name: t.name,
    goalType: t.goal?.type || 'auto_process_contract',
    goalTitle: t.name,
    goalDescription: `Automatically triggered by ${eventType}`,
    priority: 3,
    type: 'EVENT' as const,
    eventType,
  }))]) {
    await createAndEnqueueGoal(data.tenantId, trigger as TriggerDefinition);
  }
}

// ============================================================================
// STARTUP: REGISTER REPEATABLE JOBS
// ============================================================================

/**
 * Register all schedule-based triggers as BullMQ repeatable jobs.
 * Called once during worker startup.
 */
export async function registerAutonomousTriggers(): Promise<void> {
  const isEnabled = process.env.AUTONOMOUS_AGENTS_ENABLED !== 'false'; // Enabled by default
  if (!isEnabled) {
    logger.info('Autonomous agent triggers disabled (AUTONOMOUS_AGENTS_ENABLED=false)');
    return;
  }

  logger.info('🤖 Registering autonomous agent triggers...');

  const queueService = getQueueService();

  // Sync default triggers to DB
  for (const trigger of DEFAULT_TRIGGERS) {
    if (trigger.type !== 'SCHEDULE' || !trigger.cronExpression) continue;

    try {
      // Upsert trigger definition in DB
      const existing = await prisma.agentTrigger.findFirst({
        where: { tenantId: 'system', name: trigger.name },
      });

      if (!existing) {
        await prisma.agentTrigger.create({
          data: {
            tenantId: 'system',
            name: trigger.name,
            type: trigger.type,
            isActive: true,
            cronExpression: trigger.cronExpression,
          },
        });
        logger.info({ trigger: trigger.name, cron: trigger.cronExpression }, 'Created trigger in DB');
      }

      // Register BullMQ repeatable job
      await queueService.addJob(
        QUEUE_NAMES.AGENT_ORCHESTRATION,
        `autonomous:${trigger.goalType}`,
        {
          triggerName: trigger.name,
          goalType: trigger.goalType,
          trigger,
          autonomous: true,
          iteration: 0,
          contractId: 'system',
          tenantId: 'system',
        },
        {
          repeat: { pattern: trigger.cronExpression },
          jobId: `autonomous-${trigger.goalType}`,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 20 },
        } as any
      );

      logger.info({ trigger: trigger.name, cron: trigger.cronExpression }, '⏰ Registered repeatable job');
    } catch (error) {
      logger.error({ trigger: trigger.name, error: (error as Error).message }, 'Failed to register trigger');
    }
  }

  logger.info(`🤖 ${DEFAULT_TRIGGERS.filter(t => t.type === 'SCHEDULE').length} autonomous triggers registered`);
}
