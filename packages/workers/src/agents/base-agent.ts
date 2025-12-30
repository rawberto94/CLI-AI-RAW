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
   * Record agent event for analytics
   */
  protected async recordEvent(event: Omit<AgentEvent, 'id'>): Promise<void> {
    try {
      // This would typically save to database
      // For now, just log it
      logger.debug({ event }, 'Agent event recorded');
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
   * Get performance metrics for this agent
   */
  async getPerformanceMetrics(tenantId: string): Promise<AgentPerformanceMetrics> {
    // This would typically query database for metrics
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
