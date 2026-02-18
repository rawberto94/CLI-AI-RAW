/**
 * AI Provider Failover Service
 * Manages automatic failover between AI providers (OpenAI, Anthropic)
 */

import pino from 'pino';
import { OpenAI } from 'openai';
import { anthropicProvider, type AnthropicModelName, type CompletionOptions as AnthropicOptions, type CompletionResult } from './anthropic-provider';

const logger = pino({ name: 'ai-failover' });

// Provider types
export type AIProvider = 'openai' | 'anthropic';

// Circuit breaker states
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailure: number;
  successCount: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // ms
  halfOpenSuccesses: number;
}

interface ProviderStats {
  requests: number;
  successes: number;
  failures: number;
  avgLatency: number;
  totalCost: number;
  lastUsed: number;
  lastError?: string;
}

export interface FailoverConfig {
  primaryProvider: AIProvider;
  fallbackProvider: AIProvider;
  enableFailover: boolean;
  circuitBreaker: CircuitBreakerConfig;
  maxRetries: number;
  retryDelay: number;
}

export interface CompletionRequest {
  prompt?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface UnifiedCompletionResult extends CompletionResult {
  provider: AIProvider;
  failedOver: boolean;
  latencyMs: number;
}

const DEFAULT_CONFIG: FailoverConfig = {
  primaryProvider: 'openai',
  fallbackProvider: 'anthropic',
  enableFailover: true,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenSuccesses: 3,
  },
  maxRetries: 2,
  retryDelay: 1000,
};

/**
 * AI Provider Failover Service
 */
export class AIFailoverService {
  private config: FailoverConfig;
  private openaiClient: OpenAI | null = null;
  private circuits: Map<AIProvider, CircuitBreakerState> = new Map();
  private stats: Map<AIProvider, ProviderStats> = new Map();

  constructor(config?: Partial<FailoverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize OpenAI client
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize circuit breakers
    this.initializeCircuit('openai');
    this.initializeCircuit('anthropic');
  }

  private initializeCircuit(provider: AIProvider): void {
    this.circuits.set(provider, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailure: 0,
      successCount: 0,
    });

    this.stats.set(provider, {
      requests: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
      totalCost: 0,
      lastUsed: 0,
    });
  }

  /**
   * Check if provider is available based on circuit breaker
   */
  isProviderAvailable(provider: AIProvider): boolean {
    // Check if client exists
    if (provider === 'openai' && !this.openaiClient) return false;
    if (provider === 'anthropic' && !anthropicProvider.isAvailable()) return false;

    const circuit = this.circuits.get(provider)!;
    
    switch (circuit.state) {
      case 'CLOSED':
        return true;
      
      case 'OPEN':
        // Check if reset timeout has passed
        if (Date.now() - circuit.lastFailure > this.config.circuitBreaker.resetTimeout) {
          circuit.state = 'HALF_OPEN';
          circuit.successCount = 0;
          logger.info({ provider }, 'Circuit breaker moved to HALF_OPEN');
          return true;
        }
        return false;
      
      case 'HALF_OPEN':
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(provider: AIProvider, latencyMs: number, cost: number): void {
    const circuit = this.circuits.get(provider)!;
    const stats = this.stats.get(provider)!;

    // Update stats
    stats.requests++;
    stats.successes++;
    stats.lastUsed = Date.now();
    stats.totalCost += cost;
    stats.avgLatency = (stats.avgLatency * (stats.successes - 1) + latencyMs) / stats.successes;

    // Handle circuit breaker
    if (circuit.state === 'HALF_OPEN') {
      circuit.successCount++;
      if (circuit.successCount >= this.config.circuitBreaker.halfOpenSuccesses) {
        circuit.state = 'CLOSED';
        circuit.failureCount = 0;
        logger.info({ provider }, 'Circuit breaker CLOSED after successful recovery');
      }
    } else {
      circuit.failureCount = 0;
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(provider: AIProvider, error: string): void {
    const circuit = this.circuits.get(provider)!;
    const stats = this.stats.get(provider)!;

    // Update stats
    stats.requests++;
    stats.failures++;
    stats.lastError = error;

    // Handle circuit breaker
    circuit.failureCount++;
    circuit.lastFailure = Date.now();

    if (circuit.state === 'HALF_OPEN') {
      // Immediately reopen on failure in half-open
      circuit.state = 'OPEN';
      logger.warn({ provider }, 'Circuit breaker re-OPENED after half-open failure');
    } else if (circuit.failureCount >= this.config.circuitBreaker.failureThreshold) {
      circuit.state = 'OPEN';
      logger.warn({ provider, failureCount: circuit.failureCount }, 'Circuit breaker OPENED');
    }
  }

  /**
   * Call OpenAI
   */
  private async callOpenAI(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    
    if (request.messages) {
      messages.push(...request.messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })));
    } else if (request.prompt) {
      messages.push({ role: 'user', content: request.prompt });
    }

    const model = request.model ?? 'gpt-4o';
    
    const response = await this.openaiClient.chat.completions.create({
      model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    }, { signal: AbortSignal.timeout(30_000) });

    const choice = response.choices[0];
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;

    // Calculate cost (approximate)
    const costRates: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    };
    const rates = costRates[model] ?? { input: 0.003, output: 0.015 };
    const cost = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;

    return {
      content: choice.message.content ?? '',
      model,
      inputTokens,
      outputTokens,
      stopReason: choice.finish_reason ?? 'unknown',
      cost,
    };
  }

  /**
   * Call Anthropic
   */
  private async callAnthropic(request: CompletionRequest): Promise<CompletionResult> {
    const options: AnthropicOptions = {
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      systemPrompt: request.systemPrompt,
    };

    // Map OpenAI model to Anthropic if specified
    if (request.model) {
      const modelMap: Record<string, AnthropicModelName> = {
        'gpt-4o': 'claude-3-5-sonnet',
        'gpt-4o-mini': 'claude-3-5-haiku',
        'gpt-4-turbo': 'claude-3-opus',
        'gpt-4': 'claude-3-5-sonnet',
        'gpt-3.5-turbo': 'claude-3-5-haiku',
      };
      const mappedModel = modelMap[request.model];
      if (mappedModel) {
        options.model = mappedModel;
      }
    }

    if (request.messages && request.messages.length > 0) {
      return anthropicProvider.chat(
        request.messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        options
      );
    } else if (request.prompt) {
      return anthropicProvider.complete(request.prompt, options);
    }

    throw new Error('Either prompt or messages must be provided');
  }

  /**
   * Execute request with a specific provider
   */
  private async executeWithProvider(
    provider: AIProvider,
    request: CompletionRequest
  ): Promise<{ result: CompletionResult; latencyMs: number }> {
    const start = Date.now();

    try {
      const result = provider === 'openai'
        ? await this.callOpenAI(request)
        : await this.callAnthropic(request);

      const latencyMs = Date.now() - start;
      this.recordSuccess(provider, latencyMs, result.cost);

      return { result, latencyMs };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.recordFailure(provider, message);
      throw error;
    }
  }

  /**
   * Execute completion with automatic failover
   */
  async complete(request: CompletionRequest): Promise<UnifiedCompletionResult> {
    const providers: AIProvider[] = [
      this.config.primaryProvider,
      this.config.fallbackProvider,
    ];

    let lastError: Error | null = null;
    let failedOver = false;

    for (const provider of providers) {
      // Skip if circuit is open
      if (!this.isProviderAvailable(provider)) {
        logger.debug({ provider }, 'Provider circuit is open, skipping');
        failedOver = true;
        continue;
      }

      // Try with retries
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const { result, latencyMs } = await this.executeWithProvider(provider, request);

          return {
            ...result,
            provider,
            failedOver,
            latencyMs,
          };

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          logger.warn({
            provider,
            attempt: attempt + 1,
            maxRetries: this.config.maxRetries,
            error: lastError.message,
          }, 'Provider attempt failed');

          // Don't retry if it's a client error (4xx)
          if (lastError.message.includes('400') || 
              lastError.message.includes('401') || 
              lastError.message.includes('403')) {
            break;
          }

          // Wait before retry
          if (attempt < this.config.maxRetries) {
            await new Promise(resolve => 
              setTimeout(resolve, this.config.retryDelay * (attempt + 1))
            );
          }
        }
      }

      // Move to fallback
      failedOver = true;
      
      if (!this.config.enableFailover) {
        break;
      }
    }

    throw lastError ?? new Error('All AI providers failed');
  }

  /**
   * Get provider statistics
   */
  getStats(): Record<AIProvider, ProviderStats & { circuitState: CircuitState }> {
    const result: Record<string, ProviderStats & { circuitState: CircuitState }> = {};
    
    for (const [provider, stats] of this.stats) {
      const circuit = this.circuits.get(provider)!;
      result[provider] = {
        ...stats,
        circuitState: circuit.state,
      };
    }

    return result as Record<AIProvider, ProviderStats & { circuitState: CircuitState }>;
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuit(provider: AIProvider): void {
    const circuit = this.circuits.get(provider);
    if (circuit) {
      circuit.state = 'CLOSED';
      circuit.failureCount = 0;
      circuit.successCount = 0;
      logger.info({ provider }, 'Circuit breaker manually reset');
    }
  }

  /**
   * Force failover to specific provider
   */
  forceProvider(provider: AIProvider): void {
    this.config.primaryProvider = provider;
    logger.info({ provider }, 'Forced primary provider');
  }
}

// Export singleton
export const aiFailoverService = new AIFailoverService();

// Export factory
export function createAIFailoverService(config?: Partial<FailoverConfig>): AIFailoverService {
  return new AIFailoverService(config);
}
