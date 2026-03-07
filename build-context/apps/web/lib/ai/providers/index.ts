/**
 * AI Providers Index
 * Export all AI provider implementations
 */

// Anthropic Provider
export {
  AnthropicProvider,
  anthropicProvider,
  createAnthropicProvider,
  ANTHROPIC_MODELS,
  type AnthropicModelName,
  type AnthropicConfig,
  type CompletionOptions,
  type CompletionResult,
  type StreamingOptions,
} from './anthropic-provider';

// AI Failover Service (Circuit Breaker + Provider Switching)
export {
  AIFailoverService,
  aiFailoverService,
  createAIFailoverService,
  type AIProvider,
  type FailoverConfig,
  type CompletionRequest,
  type UnifiedCompletionResult,
} from './failover-service';
