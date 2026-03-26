/**
 * Model Routing & Configuration for AI Chat Stream
 * 
 * Contains model failover chain, query complexity detection,
 * smart model routing, and tool permission checks.
 */

import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey } from '@/lib/openai-client';
import Anthropic from '@anthropic-ai/sdk';
import { routeToModel, type TaskType } from '@/lib/ai/model-router.service';
import { countTokens } from '@/lib/ai/token-counter';
import { logger } from '@/lib/logger';

// ─── Clients ────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = getOpenAIApiKey();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    _openai = createOpenAIClient(key);
  }
  return _openai;
}
// Keep backward-compat reference (used throughout this file)
export const openai = new Proxy({} as OpenAI, { get: (_, prop) => (getOpenAI() as any)[prop] });

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Model Failover Chain ───────────────────────────────────────────────

export interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  priority: number;
}

// Build failover chain dynamically based on available API keys
export const MODEL_FAILOVER_CHAIN: ModelConfig[] = [
  { provider: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', priority: 1 },
  { provider: 'openai', model: 'gpt-4o', priority: 2 },
  // Only include Anthropic models if API key is configured
  ...(process.env.ANTHROPIC_API_KEY ? [
    { provider: 'anthropic' as const, model: process.env.ANTHROPIC_MODEL_FAST || 'claude-3-5-haiku-20241022', priority: 3 },
    { provider: 'anthropic' as const, model: process.env.ANTHROPIC_MODEL_SMART || 'claude-sonnet-4-20250514', priority: 4 },
  ] : []),
];

// Log available models at startup
if (typeof window === 'undefined') {
  logger.info(`[AI Chat Stream] Available models: ${MODEL_FAILOVER_CHAIN.map(c => `${c.provider}/${c.model}`).join(', ')}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.info('[AI Chat Stream] Anthropic failover disabled (ANTHROPIC_API_KEY not set)');
  }
}

// ─── Role-based tool permissions ────────────────────────────────────────

const WRITE_TOOLS = new Set([
  'start_workflow',
  'approve_or_reject_step',
  'create_workflow',
  'cancel_workflow',
  'assign_approver',
  'escalate_workflow',
  'create_contract',
  'update_contract',
]);

const ADMIN_TOOLS = new Set<string>([
  // Future: tools that require admin role
]);

export function canUseTool(toolName: string, userRole: string): boolean {
  if (ADMIN_TOOLS.has(toolName) && userRole !== 'ADMIN') return false;
  if (WRITE_TOOLS.has(toolName) && userRole === 'VIEWER') return false;
  return true;
}

// Maximum tool-calling iterations before forcing a final response
export const MAX_TOOL_ITERATIONS = parseInt(process.env.MAX_TOOL_ITERATIONS || '5', 10);

// ─── Smart Model Routing ────────────────────────────────────────────────

export type QueryComplexity = 'simple' | 'moderate' | 'complex';

// Default complex-query keywords; override via COMPLEXITY_KEYWORDS_COMPLEX env var (comma-separated)
const DEFAULT_COMPLEX_KEYWORDS = [
  'compare', 'analyze', 'summarize all', 'across all', 'trend',
  'risk assessment', 'compliance audit', 'negotiate', 'strategy',
  'implications', 'recommend', 'evaluate', 'what should',
  'how can we', 'optimize', 'consolidate', 'benchmark',
  'clause by clause', 'draft a', 'create a report', 'full analysis',
  'generate contract', 'redline', 'indemnification', 'force majeure',
  'liability cap', 'termination clause', 'intellectual property',
  'data privacy', 'portfolio risk', 'spend analysis',
];

function getComplexKeywords(): string[] {
  const env = process.env.COMPLEXITY_KEYWORDS_COMPLEX;
  return env ? env.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : DEFAULT_COMPLEX_KEYWORDS;
}

export function detectQueryComplexity(message: string): QueryComplexity {
  const q = message.toLowerCase().trim();
  const wordCount = message.split(/\s+/).length;

  // Simple: greetings, confirmations, trivial lookups
  const simplePatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|bye|sup|yo)\b/,
    /^what time/,
    /^(who|what) (is|are) (you|contigo|this)/,
    /^(show|go to|open|navigate)/,
  ];
  if (simplePatterns.some(p => p.test(q)) && wordCount <= 8) return 'simple';

  // Complex: multi-part analysis, comparisons, legal reasoning, strategy
  const complexIndicators = getComplexKeywords();
  const complexCount = complexIndicators.filter(k => q.includes(k)).length;
  if (complexCount >= 1 || wordCount > 50) return 'complex';

  return 'moderate';
}

export function buildModelChain(complexity: QueryComplexity, query?: string): ModelConfig[] {
  const baseModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Use smart model router for dynamic selection
  if (query) {
    try {
      const taskTypeMap: Record<QueryComplexity, TaskType> = {
        simple: 'simple_qa',
        moderate: 'extraction',
        complex: 'analysis',
      };
      const routing = routeToModel({
        query,
        taskType: taskTypeMap[complexity],
        inputTokens: countTokens(query).tokens,
      });
      // Build chain with routed model first, then fallbacks
      const chain: ModelConfig[] = [
        { provider: 'openai', model: routing.model, priority: 1 },
      ];
      if (routing.model !== 'gpt-4o') {
        chain.push({ provider: 'openai', model: 'gpt-4o', priority: 2 });
      }
      if (routing.model !== baseModel && routing.model !== 'gpt-4o') {
        chain.push({ provider: 'openai', model: baseModel, priority: 3 });
      }
      if (process.env.ANTHROPIC_API_KEY) {
        chain.push({ provider: 'anthropic', model: process.env.ANTHROPIC_MODEL_SMART || 'claude-sonnet-4-20250514', priority: chain.length + 1 });
      }
      return chain;
    } catch {
      // Fall through to default logic
    }
  }

  if (complexity === 'complex') {
    // Route complex queries to gpt-4o first, then fall back
    return [
      { provider: 'openai', model: 'gpt-4o', priority: 1 },
      { provider: 'openai', model: baseModel, priority: 2 },
      ...(process.env.ANTHROPIC_API_KEY ? [
        { provider: 'anthropic' as const, model: process.env.ANTHROPIC_MODEL_SMART || 'claude-sonnet-4-20250514', priority: 3 },
      ] : []),
    ];
  }

  // Simple & moderate: use the default chain
  return MODEL_FAILOVER_CHAIN;
}
