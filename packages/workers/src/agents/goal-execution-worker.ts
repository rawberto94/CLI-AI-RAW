/**
 * BullMQ Goal Execution Worker
 * 
 * Consumes jobs from the 'agent-goals' queue (enqueued by the HITL approval API)
 * and resumes goal execution via the AutonomousAgentOrchestrator.
 * 
 * Flow:
 *   1. User approves goal in AgentApprovalQueue UI
 *   2. POST /api/agents/goals sets status=EXECUTING and enqueues a BullMQ job
 *   3. This worker picks up the job and calls createGoal() or resumes execution
 * 
 * Start this worker alongside the main app (e.g., via PM2 or Docker):
 *   node -e "require('./dist/agents/goal-execution-worker').startGoalWorker()"
 */

import pino from 'pino';

const logger = pino({ name: 'goal-execution-worker' });

let workerInstance: any = null;

/**
 * Start the BullMQ worker that processes approved agent goals.
 */
export async function startGoalWorker(): Promise<void> {
  if (workerInstance) {
    logger.warn('Goal execution worker is already running');
    return;
  }

  // Dynamic import to avoid build errors if BullMQ isn't installed
  let Worker: any;
  try {
    const bullmq = await import('bullmq');
    Worker = bullmq.Worker;
  } catch {
    logger.error('BullMQ is not installed — goal execution worker cannot start. Install with: pnpm add bullmq');
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.error('REDIS_URL is not set — goal execution worker cannot start');
    return;
  }

  // Dynamic import of orchestrator to avoid circular deps
  let getAutonomousOrchestrator: any;
  try {
    const agents = await import('@repo/agents');
    getAutonomousOrchestrator = agents.getAutonomousOrchestrator;
  } catch {
    try {
      const agents = await import('../../agents/src/autonomous-orchestrator');
      getAutonomousOrchestrator = agents.getAutonomousOrchestrator;
    } catch (err) {
      logger.error({ error: String(err) }, 'Failed to import orchestrator — worker cannot process goals');
      return;
    }
  }

  // Dynamic import of Prisma for DB state checks
  let prisma: any;
  try {
    const clientsDb = await import('clients-db');
    const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
    prisma = typeof getClient === 'function' ? getClient() : getClient;
  } catch {
    try {
      const { PrismaClient } = await import('@prisma/client');
      prisma = new PrismaClient();
    } catch {
      logger.warn('Prisma not available — worker will proceed without DB verification');
    }
  }

  workerInstance = new Worker(
    'agent-goals',
    async (job: any) => {
      const { goalId, tenantId } = job.data;

      logger.info({ goalId, tenantId, jobId: job.id }, 'Processing approved goal');

      // Verify the goal is still in EXECUTING state (hasn't been cancelled meanwhile)
      if (prisma) {
        try {
          const goal = await prisma.agentGoal.findUnique({
            where: { id: goalId },
            select: { status: true },
          });

          if (!goal) {
            logger.warn({ goalId }, 'Goal not found in DB — skipping');
            return { status: 'skipped', reason: 'goal_not_found' };
          }

          if (goal.status === 'CANCELLED') {
            logger.info({ goalId }, 'Goal was cancelled — skipping execution');
            return { status: 'skipped', reason: 'goal_cancelled' };
          }

          if (goal.status === 'COMPLETED') {
            logger.info({ goalId }, 'Goal already completed — skipping');
            return { status: 'skipped', reason: 'goal_already_completed' };
          }
        } catch (err) {
          logger.warn({ goalId, error: String(err) }, 'DB check failed — proceeding with execution');
        }
      }

      // Get the orchestrator singleton and hydrate if needed
      const orchestrator = getAutonomousOrchestrator();
      await orchestrator.hydrateFromDB(tenantId);

      // Check if the goal already exists in-memory (it should if orchestrator is running)
      const existingGoal = orchestrator.getGoal?.(goalId);
      
      if (existingGoal) {
        // Goal exists — the orchestrator's waitForApproval() poll should have already
        // detected the DB status change. But if the orchestrator restarted, the goal
        // was re-hydrated and may need re-queueing.
        if (existingGoal.status === 'awaiting_approval') {
          // Force status update so startProcessing picks it up
          existingGoal.status = 'executing';
          existingGoal.updatedAt = new Date();
          if (!orchestrator.isRunning) {
            orchestrator.startProcessing();
          }
        }
        logger.info({ goalId, status: existingGoal.status }, 'Goal found in orchestrator memory');
      } else {
        // Goal not in memory — re-create from DB data
        // The orchestrator will hydrate it and start processing
        logger.info({ goalId }, 'Goal not in orchestrator memory — triggering re-hydration');
        
        // Force re-hydration to pick up the approved goal
        try {
          // Reset hydrated flag to allow re-hydration
          (orchestrator as any).hydrated = false;
          await orchestrator.hydrateFromDB(tenantId);
          
          if (!orchestrator.isRunning) {
            orchestrator.startProcessing();
          }
        } catch (err) {
          logger.error({ goalId, error: String(err) }, 'Failed to re-hydrate orchestrator');
          throw err; // Let BullMQ retry
        }
      }

      logger.info({ goalId }, 'Goal execution triggered successfully');
      return { status: 'triggered', goalId };
    },
    {
      connection: { url: redisUrl },
      concurrency: 3,
      removeOnComplete: { age: 86400 * 7 },  // Keep completed jobs 7 days
      removeOnFail: { age: 86400 * 30 },      // Keep failed jobs 30 days
    }
  );

  workerInstance.on('completed', (job: any, result: any) => {
    logger.info({ jobId: job.id, goalId: job.data.goalId, result }, 'Goal job completed');
  });

  workerInstance.on('failed', (job: any, err: Error) => {
    logger.error({ jobId: job?.id, goalId: job?.data?.goalId, error: err.message }, 'Goal job failed');
  });

  workerInstance.on('error', (err: Error) => {
    logger.error({ error: err.message }, 'Goal worker error');
  });

  logger.info('Goal execution worker started — listening on queue "agent-goals"');
}

/**
 * Stop the worker gracefully.
 */
export async function stopGoalWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    logger.info('Goal execution worker stopped');
  }
}
