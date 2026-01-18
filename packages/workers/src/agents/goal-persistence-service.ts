/**
 * Agent Goal Persistence Service
 * Provides database storage for agent goals, steps, and triggers
 */

import { prisma } from '../lib/prisma';
import pino from 'pino';

const logger = pino({ name: 'goal-persistence-service' });

// Types matching the Prisma schema
type AgentGoalStatus = 'PENDING' | 'PLANNING' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
type AgentGoalStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
type AgentTriggerType = 'SCHEDULE' | 'EVENT' | 'THRESHOLD' | 'MANUAL';

export interface CreateGoalInput {
  tenantId: string;
  userId?: string;
  type: string;
  title: string;
  description?: string;
  priority?: number;
  contractId?: string;
  context?: Record<string, unknown>;
  requiresApproval?: boolean;
  scheduledFor?: Date;
}

export interface GoalPlanStep {
  name: string;
  type: string;
  input?: Record<string, unknown>;
}

export interface UpdateGoalInput {
  status?: AgentGoalStatus;
  progress?: number;
  currentStep?: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateTriggerInput {
  tenantId: string;
  goalId?: string;
  name: string;
  type: AgentTriggerType;
  cronExpression?: string;
  eventType?: string;
  eventFilter?: Record<string, unknown>;
  metric?: string;
  operator?: string;
  threshold?: number;
}

/**
 * Goal Persistence Service
 */
export class GoalPersistenceService {
  /**
   * Create a new agent goal
   */
  async createGoal(input: CreateGoalInput): Promise<string> {
    try {
      const goal = await prisma.agentGoal.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          description: input.description,
          priority: input.priority ?? 5,
          contractId: input.contractId,
          context: input.context ?? {},
          requiresApproval: input.requiresApproval ?? false,
          scheduledFor: input.scheduledFor,
          status: 'PENDING',
        },
      });

      logger.info({ goalId: goal.id, type: input.type }, 'Created agent goal');
      return goal.id;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create agent goal');
      throw error;
    }
  }

  /**
   * Get a goal by ID
   */
  async getGoal(goalId: string) {
    return prisma.agentGoal.findUnique({
      where: { id: goalId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        triggers: true,
      },
    });
  }

  /**
   * Get goals by tenant and optionally by status
   */
  async getGoalsByTenant(
    tenantId: string,
    options?: {
      status?: AgentGoalStatus | AgentGoalStatus[];
      limit?: number;
      offset?: number;
    }
  ) {
    const where: Record<string, unknown> = { tenantId };
    
    if (options?.status) {
      where.status = Array.isArray(options.status) 
        ? { in: options.status }
        : options.status;
    }

    return prisma.agentGoal.findMany({
      where,
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Get pending goals ready for execution
   */
  async getPendingGoals(tenantId?: string) {
    const where: Record<string, unknown> = {
      status: { in: ['PENDING', 'PLANNING'] },
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: new Date() } },
      ],
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    return prisma.agentGoal.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { scheduledFor: 'asc' },
      ],
      take: 100,
    });
  }

  /**
   * Get goals awaiting approval
   */
  async getGoalsAwaitingApproval(tenantId: string) {
    return prisma.agentGoal.findMany({
      where: {
        tenantId,
        status: 'AWAITING_APPROVAL',
      },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update goal status and properties
   */
  async updateGoal(goalId: string, update: UpdateGoalInput) {
    try {
      const goal = await prisma.agentGoal.update({
        where: { id: goalId },
        data: update,
      });

      logger.debug({ goalId, status: update.status }, 'Updated goal');
      return goal;
    } catch (error) {
      logger.error({ error, goalId, update }, 'Failed to update goal');
      throw error;
    }
  }

  /**
   * Set the execution plan for a goal
   */
  async setPlan(goalId: string, steps: GoalPlanStep[]) {
    try {
      // Create steps in the database
      await prisma.$transaction(async (tx) => {
        // Delete existing steps
        await tx.agentGoalStep.deleteMany({
          where: { goalId },
        });

        // Create new steps
        await tx.agentGoalStep.createMany({
          data: steps.map((step, index) => ({
            goalId,
            name: step.name,
            type: step.type,
            order: index,
            input: step.input ?? {},
            status: 'PENDING',
          })),
        });

        // Update goal with plan metadata
        await tx.agentGoal.update({
          where: { id: goalId },
          data: {
            plan: steps,
            totalSteps: steps.length,
            status: 'PLANNING',
          },
        });
      });

      logger.info({ goalId, stepCount: steps.length }, 'Set goal plan');
    } catch (error) {
      logger.error({ error, goalId }, 'Failed to set goal plan');
      throw error;
    }
  }

  /**
   * Start goal execution
   */
  async startExecution(goalId: string) {
    return this.updateGoal(goalId, {
      status: 'EXECUTING',
      startedAt: new Date(),
    });
  }

  /**
   * Complete a goal successfully
   */
  async completeGoal(goalId: string, result?: Record<string, unknown>) {
    return this.updateGoal(goalId, {
      status: 'COMPLETED',
      progress: 100,
      result,
      completedAt: new Date(),
    });
  }

  /**
   * Fail a goal with error
   */
  async failGoal(goalId: string, error: string) {
    return this.updateGoal(goalId, {
      status: 'FAILED',
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Cancel a goal
   */
  async cancelGoal(goalId: string) {
    return this.updateGoal(goalId, {
      status: 'CANCELLED',
      completedAt: new Date(),
    });
  }

  /**
   * Approve a goal for execution
   */
  async approveGoal(goalId: string, approvedBy: string) {
    return prisma.agentGoal.update({
      where: { id: goalId },
      data: {
        status: 'PENDING',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Update a step's status
   */
  async updateStep(
    stepId: string,
    update: {
      status?: AgentGoalStepStatus;
      progress?: number;
      output?: Record<string, unknown>;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
      duration?: number;
    }
  ) {
    return prisma.agentGoalStep.update({
      where: { id: stepId },
      data: update,
    });
  }

  /**
   * Start executing a step
   */
  async startStep(stepId: string) {
    return this.updateStep(stepId, {
      status: 'RUNNING',
      startedAt: new Date(),
    });
  }

  /**
   * Complete a step successfully
   */
  async completeStep(stepId: string, output?: Record<string, unknown>) {
    const step = await prisma.agentGoalStep.findUnique({
      where: { id: stepId },
    });

    const duration = step?.startedAt 
      ? Date.now() - step.startedAt.getTime()
      : undefined;

    return this.updateStep(stepId, {
      status: 'COMPLETED',
      progress: 100,
      output,
      completedAt: new Date(),
      duration,
    });
  }

  /**
   * Fail a step with error
   */
  async failStep(stepId: string, error: string) {
    const step = await prisma.agentGoalStep.findUnique({
      where: { id: stepId },
    });

    const duration = step?.startedAt 
      ? Date.now() - step.startedAt.getTime()
      : undefined;

    return this.updateStep(stepId, {
      status: 'FAILED',
      error,
      completedAt: new Date(),
      duration,
    });
  }

  /**
   * Create a trigger
   */
  async createTrigger(input: CreateTriggerInput) {
    try {
      const trigger = await prisma.agentTrigger.create({
        data: {
          tenantId: input.tenantId,
          goalId: input.goalId,
          name: input.name,
          type: input.type,
          cronExpression: input.cronExpression,
          eventType: input.eventType,
          eventFilter: input.eventFilter,
          metric: input.metric,
          operator: input.operator,
          threshold: input.threshold,
        },
      });

      logger.info({ triggerId: trigger.id, type: input.type }, 'Created trigger');
      return trigger;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create trigger');
      throw error;
    }
  }

  /**
   * Get active triggers
   */
  async getActiveTriggers(tenantId?: string, type?: AgentTriggerType) {
    const where: Record<string, unknown> = { isActive: true };
    
    if (tenantId) where.tenantId = tenantId;
    if (type) where.type = type;

    return prisma.agentTrigger.findMany({
      where,
      include: { goal: true },
    });
  }

  /**
   * Record trigger execution
   */
  async recordTriggerExecution(triggerId: string) {
    return prisma.agentTrigger.update({
      where: { id: triggerId },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });
  }

  /**
   * Deactivate a trigger
   */
  async deactivateTrigger(triggerId: string) {
    return prisma.agentTrigger.update({
      where: { id: triggerId },
      data: { isActive: false },
    });
  }

  /**
   * Get goal statistics for a tenant
   */
  async getGoalStats(tenantId: string) {
    const [total, byStatus, recentCompleted] = await Promise.all([
      prisma.agentGoal.count({ where: { tenantId } }),
      prisma.agentGoal.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      prisma.agentGoal.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      pending: statusCounts['PENDING'] ?? 0,
      executing: statusCounts['EXECUTING'] ?? 0,
      completed: statusCounts['COMPLETED'] ?? 0,
      failed: statusCounts['FAILED'] ?? 0,
      awaitingApproval: statusCounts['AWAITING_APPROVAL'] ?? 0,
      completedLast7Days: recentCompleted,
    };
  }

  /**
   * Cleanup old completed goals
   */
  async cleanupOldGoals(retentionDays: number = 90) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.agentGoal.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
        completedAt: { lt: cutoffDate },
      },
    });

    logger.info({ deleted: result.count, retentionDays }, 'Cleaned up old goals');
    return result.count;
  }
}

// Export singleton instance
export const goalPersistenceService = new GoalPersistenceService();
