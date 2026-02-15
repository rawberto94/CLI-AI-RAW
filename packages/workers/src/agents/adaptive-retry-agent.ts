/**
 * Adaptive Retry Agent
 * Learns from failures and adapts retry strategy intelligently
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  FailureEvent,
  FailurePattern,
  RetryStrategy,
  AgentAction,
} from './types';
import { logger } from '../utils/logger';

export class AdaptiveRetryAgent extends BaseAgent {
  name = 'adaptive-retry-agent';
  version = '1.0.0';
  capabilities = ['retry-strategy', 'failure-analysis', 'learning'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { failureHistory, contractType, artifactType } = input.context;

    const strategy = await this.determineRetryStrategy(
      failureHistory as FailureEvent[],
      contractType,
      artifactType
    );

    const actions: AgentAction[] = [];

    // Create retry action
    actions.push({
      id: `retry-${Date.now()}`,
      type: 'retry',
      description: strategy.reason,
      priority: strategy.attempt > 2 ? 'high' : 'medium',
      automated: strategy.strategy !== 'human-intervention',
      targetEntity: {
        type: 'contract',
        id: input.contractId,
      },
      payload: {
        strategy: strategy.strategy,
        attempt: strategy.attempt,
        modelToUse: strategy.modelToUse,
        promptModifications: strategy.promptModifications,
        backoffDelay: this.calculateBackoffDelay(strategy),
      },
      estimatedImpact: `${(strategy.estimatedSuccess * 100).toFixed(0)}% success probability`,
    });

    // If human intervention needed, create escalation action
    if (strategy.strategy === 'human-intervention') {
      actions.push({
        id: `escalate-${Date.now()}`,
        type: 'escalate',
        description: `Manual intervention required after ${strategy.attempt} failed attempts`,
        priority: 'urgent',
        automated: false,
        targetEntity: {
          type: 'contract',
          id: input.contractId,
        },
        payload: {
          failureHistory,
          suggestedActions: [
            'Review contract quality',
            'Check OCR accuracy',
            'Validate extraction prompts',
            'Consider alternative processing method',
          ],
        },
      });
    }

    return {
      success: true,
      data: strategy,
      actions,
      confidence: strategy.estimatedSuccess,
      reasoning: this.formatReasoning([
        `Attempt: ${strategy.attempt}/${strategy.maxRetries || 5}`,
        `Strategy: ${strategy.strategy}`,
        `Estimated Success: ${(strategy.estimatedSuccess * 100).toFixed(0)}%`,
        `Reason: ${strategy.reason}`,
        ...(strategy.modelToUse ? [`Model: ${strategy.modelToUse}`] : []),
        ...(strategy.promptModifications ? ['Prompt Modifications:', ...strategy.promptModifications.map(m => `  - ${m}`)] : []),
      ]),
      metadata: {
        processingTime: Date.now() - (input.metadata?.timestamp?.getTime() ?? Date.now()),
      },
    };
  }

  protected getEventType(): 'retry_attempted' {
    return 'retry_attempted';
  }

  /**
   * Determine optimal retry strategy based on failure history
   */
  private async determineRetryStrategy(
    failureHistory: FailureEvent[],
    contractType: string,
    artifactType: string
  ): Promise<RetryStrategy> {
    // Analyze failure patterns
    const patterns = this.analyzeFailurePatterns(failureHistory);

    const attempt = failureHistory.length + 1;
    const maxRetries = 5;

    // Pattern 1: High hallucination rate
    if (patterns.hallucinationRate > 0.3) {
      return {
        attempt,
        strategy: 'simplified-prompt',
        reason: `High hallucination rate detected (${(patterns.hallucinationRate * 100).toFixed(0)}%), switching to conservative extraction with strict validation`,
        estimatedSuccess: 0.85,
        promptModifications: [
          'Add explicit "Extract only information present in the text"',
          'Add "If uncertain, return null instead of guessing"',
          'Reduce temperature to 0.0',
          'Request confidence scores for each field',
        ],
        maxRetries,
      };
    }

    // Pattern 2: Token limit errors
    if (patterns.tokenLimitErrors > 0) {
      return {
        attempt,
        strategy: 'alternative-model',
        reason: 'Token limit exceeded, switching to model with larger context window',
        estimatedSuccess: 0.90,
        modelToUse: 'gpt-4-turbo-preview',
        maxRetries,
      };
    }

    // Pattern 3: Consistent timeout errors
    if (patterns.timeoutErrors > 2) {
      return {
        attempt,
        strategy: 'split-and-retry',
        reason: 'Multiple timeouts detected, splitting into smaller chunks',
        estimatedSuccess: 0.80,
        promptModifications: [
          'Process contract in sections',
          'Reduce scope per API call',
          'Implement streaming responses',
        ],
        maxRetries,
      };
    }

    // Pattern 4: Data quality issues
    if (patterns.dataQualityIssues > 0) {
      return {
        attempt,
        strategy: 'alternative-model',
        reason: 'Poor OCR quality detected, using vision model for re-extraction',
        estimatedSuccess: 0.75,
        modelToUse: 'gpt-4-vision-preview',
        maxRetries,
      };
    }

    // Pattern 5: Too many retries
    if (attempt >= maxRetries) {
      return {
        attempt,
        strategy: 'human-intervention',
        reason: `Maximum retries (${maxRetries}) reached, manual review required`,
        estimatedSuccess: 0.0,
        maxRetries,
      };
    }

    // Pattern 6: API errors
    if (patterns.apiErrors > 0) {
      return {
        attempt,
        strategy: 'exponential_backoff',
        reason: 'API errors detected, retrying with exponential backoff',
        estimatedSuccess: 0.70,
        backoffMultiplier: Math.pow(2, attempt),
        maxRetries,
      };
    }

    // Default: Standard retry with increased backoff
    return {
      attempt,
      strategy: 'standard',
      reason: 'Transient error, retrying with standard backoff',
      estimatedSuccess: Math.max(0.7 - (attempt * 0.1), 0.3),
      backoffMultiplier: 1.5,
      maxRetries,
    };
  }

  /**
   * Analyze failure patterns from history
   */
  private analyzeFailurePatterns(failureHistory: FailureEvent[]): FailurePattern {
    const pattern: FailurePattern = {
      hallucinationRate: 0,
      tokenLimitErrors: 0,
      timeoutErrors: 0,
      apiErrors: 0,
      dataQualityIssues: 0,
      commonErrorMessages: [],
    };

    if (failureHistory.length === 0) return pattern;

    // Count error types
    for (const failure of failureHistory) {
      const errorLower = failure.error.toLowerCase();

      if (errorLower.includes('hallucin') || errorLower.includes('placeholder')) {
        pattern.hallucinationRate++;
      }

      if (errorLower.includes('token') || errorLower.includes('context length')) {
        pattern.tokenLimitErrors++;
      }

      if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
        pattern.timeoutErrors++;
      }

      if (errorLower.includes('api') || errorLower.includes('rate limit')) {
        pattern.apiErrors++;
      }

      if (errorLower.includes('ocr') || errorLower.includes('quality') || errorLower.includes('unreadable')) {
        pattern.dataQualityIssues++;
      }

      // Track common error messages
      if (!pattern.commonErrorMessages.includes(failure.errorType)) {
        pattern.commonErrorMessages.push(failure.errorType);
      }
    }

    // Calculate hallucination rate as percentage
    pattern.hallucinationRate = pattern.hallucinationRate / failureHistory.length;

    return pattern;
  }

  /**
   * Calculate backoff delay in milliseconds
   */
  private calculateBackoffDelay(strategy: RetryStrategy): number {
    const baseDelay = 5000; // 5 seconds

    switch (strategy.strategy) {
      case 'exponential_backoff':
        return baseDelay * Math.pow(2, strategy.attempt - 1);
      
      case 'standard':
        return baseDelay * (strategy.backoffMultiplier || 1.5);
      
      case 'alternative-model':
      case 'simplified-prompt':
        // Immediate retry with new strategy
        return 1000;
      
      case 'split-and-retry':
        // Slight delay to prepare chunks
        return 2000;
      
      case 'human-intervention':
        // No automatic retry
        return 0;
      
      default:
        return baseDelay;
    }
  }
}

// Export singleton instance
export const adaptiveRetryAgent = new AdaptiveRetryAgent();
