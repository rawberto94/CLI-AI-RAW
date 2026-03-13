/**
 * AI Chat Stream Modules
 * 
 * Decomposed from the monolithic stream/route.ts for maintainability.
 */

export { openai, anthropic, type ModelConfig, MODEL_FAILOVER_CHAIN, canUseTool, MAX_TOOL_ITERATIONS, type QueryComplexity, detectQueryComplexity, buildModelChain } from './model-routing';
export { gatherContext, type GatheredContext } from './context-gathering';
export { buildSystemPrompt, applyAgentPersona, type SystemPromptInput } from './system-prompt';
export { detectTopic, summarizeToolResult, deduplicateActions, buildToolPreview } from './sse-helpers';
