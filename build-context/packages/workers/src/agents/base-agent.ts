/**
 * Base Agent Class
 * Provides common functionality for all agentic workers
 */

import type {
  AgentInput,
  AgentOutput,
  AgentEvent,
  AgentPerformanceMetrics,
  AgentConfig,
} from './types';
import { logger } from '../utils/logger';
import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

export abstract class BaseAgent {
  abstract name: string;
  abstract version: string;
  abstract capabilities: string[];

  protected config: AgentConfig = {
    enabled: true,
    autoExecute: true,
    confidenceThreshold: 0.7,
    maxRetries: 3,
  };

  constructor(config?: Partial<AgentConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Main execution method - must be implemented by each agent
   */
  abstract execute(input: AgentInput): Promise<AgentOutput>;

  /**
   * Validate input before execution
   */
  protected validateInput(input: AgentInput): void {
    if (!input.contractId) {
      throw new Error('contractId is required');
    }
    if (!input.tenantId) {
      throw new Error('tenantId is required');
    }
  }

  /**
   * Execute with error handling and logging
   */
  async executeWithTracking(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      this.validateInput(input);

      logger.info({
        agent: this.name,
        contractId: input.contractId,
        tenantId: input.tenantId,
      }, `🤖 ${this.name} starting execution`);

      const output = await this.execute(input);

      const duration = Date.now() - startTime;

      logger.info({
        agent: this.name,
        contractId: input.contractId,
        success: output.success,
        confidence: output.confidence,
        duration,
      }, `✅ ${this.name} completed`);

      // Record event
      await this.recordEvent({
        agentName: this.name,
        eventType: this.getEventType(),
        timestamp: new Date(),
        contractId: input.contractId,
        tenantId: input.tenantId,
        payload: {
          input,
          output: {
            success: output.success,
            confidence: output.confidence,
            actionsCount: output.actions?.length || 0,
            recommendationsCount: output.recommendations?.length || 0,
          },
        },
        outcome: output.success ? 'success' : 'failure',
        metadata: {
          duration,
          confidence: output.confidence,
        },
      });

      return output;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error({
        agent: this.name,
        contractId: input.contractId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      }, `❌ ${this.name} failed`);

      // Record failure event
      await this.recordEvent({
        agentName: this.name,
        eventType: this.getEventType(),
        timestamp: new Date(),
        contractId: input.contractId,
        tenantId: input.tenantId,
        payload: {
          input,
          error: error instanceof Error ? error.message : String(error),
        },
        outcome: 'failure',
        metadata: { duration },
      });

      // Return failure output
      return {
        success: false,
        confidence: 0,
        reasoning: `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Record agent event for analytics — persists to AuditLog
   */
  protected async recordEvent(event: Omit<AgentEvent, 'id'>): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: event.tenantId,
          action: `agent:${event.eventType}`,
          entityType: 'agent',
          entityId: event.contractId || 'system',
          details: {
            agentName: event.agentName,
            eventType: event.eventType,
            outcome: event.outcome,
            payload: event.payload,
            metadata: event.metadata,
          } as any,
        },
      });
      logger.debug({ event: event.eventType, agent: event.agentName }, 'Agent event persisted');
    } catch (error) {
      logger.error({ error }, 'Failed to record agent event');
    }
  }

  /**
   * Get event type for this agent
   */
  protected abstract getEventType(): AgentEvent['eventType'];

  /**
   * Calculate confidence score based on multiple factors
   */
  protected calculateConfidence(factors: {
    dataQuality?: number;
    modelConfidence?: number;
    validationPassed?: boolean;
    historicalAccuracy?: number;
  }): number {
    const weights = {
      dataQuality: 0.3,
      modelConfidence: 0.4,
      validationPassed: 0.2,
      historicalAccuracy: 0.1,
    };

    let confidence = 0;
    let totalWeight = 0;

    if (factors.dataQuality !== undefined) {
      confidence += factors.dataQuality * weights.dataQuality;
      totalWeight += weights.dataQuality;
    }

    if (factors.modelConfidence !== undefined) {
      confidence += factors.modelConfidence * weights.modelConfidence;
      totalWeight += weights.modelConfidence;
    }

    if (factors.validationPassed !== undefined) {
      confidence += (factors.validationPassed ? 1 : 0) * weights.validationPassed;
      totalWeight += weights.validationPassed;
    }

    if (factors.historicalAccuracy !== undefined) {
      confidence += factors.historicalAccuracy * weights.historicalAccuracy;
      totalWeight += weights.historicalAccuracy;
    }

    return totalWeight > 0 ? confidence / totalWeight : 0.5;
  }

  /**
   * Get performance metrics for this agent from AuditLog history
   */
  async getPerformanceMetrics(tenantId: string): Promise<AgentPerformanceMetrics> {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days
      const logs = await prisma.auditLog.findMany({
        where: {
          tenantId,
          action: { startsWith: 'agent:' },
          details: { path: ['agentName'], equals: this.name },
          createdAt: { gte: since },
        },
        select: { details: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      const total = logs.length;
      const successes = logs.filter((l: any) => (l.details as any)?.outcome === 'success').length;
      const confidences = logs
        .map((l: any) => (l.details as any)?.metadata?.confidence)
        .filter((c: any): c is number => typeof c === 'number');
      const durations = logs
        .map((l: any) => (l.details as any)?.metadata?.duration)
        .filter((d: any): d is number => typeof d === 'number');

      return {
        agentName: this.name,
        totalExecutions: total,
        successRate: total > 0 ? successes / total : 0,
        averageConfidence: confidences.length > 0 ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length : 0,
        averageExecutionTime: durations.length > 0 ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0,
        totalCost: 0, // Cost tracking via AiCostLog is separate
        lastExecuted: logs[0]?.createdAt || new Date(),
      };
    } catch (error) {
      logger.warn({ error, agent: this.name }, 'Failed to query agent metrics');
      return {
        agentName: this.name,
        totalExecutions: 0,
        successRate: 0,
        averageConfidence: 0,
        averageExecutionTime: 0,
        totalCost: 0,
        lastExecuted: new Date(),
      };
    }
  }

  /**
   * Check if agent should execute based on configuration
   */
  shouldExecute(confidence: number): boolean {
    return this.config.enabled && confidence >= this.config.confidenceThreshold;
  }

  /**
   * Format reasoning for human readability
   */
  protected formatReasoning(points: string[]): string {
    return points.map((point, idx) => `${idx + 1}. ${point}`).join('\n');
  }
}
