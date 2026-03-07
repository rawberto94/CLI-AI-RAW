import pino from 'pino';

const logger = pino({ name: 'adaptive-retry-strategy' });

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

export interface ModelConfig {
  name: string;
  priority: number;
  maxTokens: number;
  temperature: number;
  costPerToken: number; // Cost efficiency
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
};

/**
 * Model fallback hierarchy (ordered by capability/cost)
 */
const MODEL_HIERARCHY: ModelConfig[] = [
  {
    name: 'gpt-4o',
    priority: 1,
    maxTokens: 128000,
    temperature: 0.2,
    costPerToken: 0.005,
  },
  {
    name: 'gpt-4o-mini',
    priority: 2,
    maxTokens: 128000,
    temperature: 0.2,
    costPerToken: 0.001,
  },
  {
    name: 'gpt-3.5-turbo',
    priority: 3,
    maxTokens: 16000,
    temperature: 0.2,
    costPerToken: 0.0005,
  },
];

export enum FailureReason {
  RATE_LIMIT = 'rate_limit',
  CONTEXT_LENGTH = 'context_length',
  TIMEOUT = 'timeout',
  INVALID_RESPONSE = 'invalid_response',
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

export interface RetryContext {
  attempt: number;
  lastError: Error | null;
  lastFailureReason: FailureReason;
  currentModel: ModelConfig;
  totalDelayMs: number;
}

/**
 * Adaptive Retry Strategy with Model Fallback
 */
export class AdaptiveRetryStrategy {
  private config: RetryConfig;
  private modelHierarchy: ModelConfig[];

  constructor(config?: Partial<RetryConfig>, models?: ModelConfig[]) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.modelHierarchy = models || MODEL_HIERARCHY;
  }

  /**
   * Execute with adaptive retry and model fallback
   */
  async executeWithRetry<T>(
    operation: (model: ModelConfig, context: RetryContext) => Promise<T>,
    operationName: string
  ): Promise<T> {
    let currentModelIndex = 0;
    let attempt = 0;
    let totalDelayMs = 0;
    let lastError: Error | null = null;
    let lastFailureReason = FailureReason.UNKNOWN;

    while (attempt < this.config.maxAttempts && currentModelIndex < this.modelHierarchy.length) {
      attempt++;
      const currentModel = this.modelHierarchy[currentModelIndex]!;

      const context: RetryContext = {
        attempt,
        lastError,
        lastFailureReason,
        currentModel,
        totalDelayMs,
      };

      try {
        logger.info({
          operationName,
          attempt,
          maxAttempts: this.config.maxAttempts,
          model: currentModel.name,
          modelPriority: currentModel.priority,
        }, `🔄 Attempting operation with ${currentModel.name}`);

        const result = await operation(currentModel, context);

        logger.info({
          operationName,
          attempt,
          model: currentModel.name,
          totalDelayMs,
        }, `✅ Operation succeeded with ${currentModel.name}`);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        lastFailureReason = this.classifyError(lastError);

        logger.warn({
          operationName,
          attempt,
          model: currentModel.name,
          failureReason: lastFailureReason,
          error: lastError.message,
        }, `❌ Attempt ${attempt} failed`);

        // Determine next action based on failure reason
        const shouldFallback = this.shouldFallbackToNextModel(
          lastFailureReason,
          attempt,
          currentModelIndex
        );

        if (shouldFallback) {
          currentModelIndex++;
          attempt = 0; // Reset attempts for new model
          logger.info({
            operationName,
            nextModel: this.modelHierarchy[currentModelIndex]?.name,
            reason: lastFailureReason,
          }, `🔀 Falling back to next model`);
        } else if (attempt < this.config.maxAttempts) {
          // Calculate delay with exponential backoff + jitter
          const delay = this.calculateDelay(attempt, lastFailureReason);
          totalDelayMs += delay;

          logger.info({
            operationName,
            delayMs: delay,
            nextAttempt: attempt + 1,
          }, `⏳ Waiting before retry`);

          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    logger.error({
      operationName,
      totalAttempts: attempt,
      totalDelayMs,
      lastError: lastError?.message,
      lastFailureReason,
    }, `❌ All retry attempts exhausted`);

    throw new Error(
      `Operation "${operationName}" failed after ${attempt} attempts across ${currentModelIndex + 1} models. Last error: ${lastError?.message}`
    );
  }

  /**
   * Classify error to determine retry strategy
   */
  private classifyError(error: Error): FailureReason {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return FailureReason.RATE_LIMIT;
    }
    if (message.includes('context length') || message.includes('token limit') || message.includes('too long')) {
      return FailureReason.CONTEXT_LENGTH;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return FailureReason.TIMEOUT;
    }
    if (message.includes('invalid') || message.includes('malformed') || message.includes('parse')) {
      return FailureReason.INVALID_RESPONSE;
    }
    if (message.includes('authentication') || message.includes('401') || message.includes('403')) {
      return FailureReason.AUTHENTICATION;
    }
    if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
      return FailureReason.NETWORK;
    }

    return FailureReason.UNKNOWN;
  }

  /**
   * Determine if should fallback to next model
   */
  private shouldFallbackToNextModel(
    failureReason: FailureReason,
    attempt: number,
    currentModelIndex: number
  ): boolean {
    // Don't fallback if no more models
    if (currentModelIndex >= this.modelHierarchy.length - 1) {
      return false;
    }

    // Always fallback on context length errors (try smaller context model)
    if (failureReason === FailureReason.CONTEXT_LENGTH) {
      return true;
    }

    // Fallback on repeated rate limit errors
    if (failureReason === FailureReason.RATE_LIMIT && attempt >= 2) {
      return true;
    }

    // Fallback on authentication errors (API key might be invalid for this model)
    if (failureReason === FailureReason.AUTHENTICATION) {
      return true;
    }

    // Don't fallback on network errors or timeouts (retry same model)
    if (failureReason === FailureReason.NETWORK || failureReason === FailureReason.TIMEOUT) {
      return false;
    }

    // Fallback on repeated invalid responses
    if (failureReason === FailureReason.INVALID_RESPONSE && attempt >= 2) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff + jitter
   */
  private calculateDelay(attempt: number, failureReason: FailureReason): number {
    // Base delay with exponential backoff
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelayMs);

    // Longer delays for rate limits
    if (failureReason === FailureReason.RATE_LIMIT) {
      delay *= 2;
    }

    // Add jitter to avoid thundering herd
    const jitter = delay * this.config.jitterFactor * (Math.random() * 2 - 1);
    delay += jitter;

    return Math.max(100, Math.floor(delay)); // Min 100ms
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get recommended model for retry
   */
  getRecommendedModel(context: RetryContext): ModelConfig {
    let modelIndex = this.modelHierarchy.findIndex(m => m.name === context.currentModel.name);

    // If context length error, try to use next model with smaller context
    if (context.lastFailureReason === FailureReason.CONTEXT_LENGTH) {
      modelIndex = Math.min(modelIndex + 1, this.modelHierarchy.length - 1);
    }

    return this.modelHierarchy[modelIndex] || context.currentModel;
  }

  /**
   * Calculate retry health score (for monitoring)
   */
  calculateRetryHealth(attempts: number, delays: number[]): number {
    // Perfect score if succeeded on first attempt
    if (attempts === 1) return 1.0;

    // Penalize based on attempts and delays
    const attemptPenalty = (attempts - 1) / this.config.maxAttempts;
    const delayPenalty = delays.reduce((a, b) => a + b, 0) / this.config.maxDelayMs;

    return Math.max(0, 1.0 - (attemptPenalty * 0.6 + delayPenalty * 0.4));
  }
}

/**
 * Chunk text to fit model context window
 */
export function chunkTextForModel(
  text: string,
  model: ModelConfig,
  reserveTokens: number = 4000
): string[] {
  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = (model.maxTokens - reserveTokens) * 4;

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    // Try to break at paragraph boundary
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      if (lastParagraph > start + maxChars * 0.7) {
        end = lastParagraph;
      } else {
        // Break at sentence boundary
        const lastPeriod = text.lastIndexOf('. ', end);
        if (lastPeriod > start + maxChars * 0.7) {
          end = lastPeriod + 1;
        }
      }
    }

    chunks.push(text.substring(start, end));
    start = end;
  }

  return chunks;
}
