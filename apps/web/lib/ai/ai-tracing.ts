/**
 * AI/LLM Observability & Tracing Service
 * 
 * Tracks LLM calls, token usage, latency, costs, and quality metrics.
 * Supports both in-memory buffering and optional export to OpenTelemetry collectors.
 * 
 * Usage:
 *   const span = aiTracer.startLLMSpan({ model: 'gpt-4o-mini', operation: 'chat' });
 *   // ... LLM call ...
 *   aiTracer.endLLMSpan(span, { promptTokens: 500, completionTokens: 200, success: true });
 */

import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LLMSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  operation: 'chat' | 'embedding' | 'moderation' | 'structured_output' | 'rerank' | 'tool_call';
  model: string;
  provider: 'openai' | 'anthropic' | 'cohere' | 'azure' | 'other';
  startTime: number;
  endTime?: number;
  latencyMs?: number;

  // Token metrics
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;

  // Cost tracking (USD)
  estimatedCost?: number;

  // Quality signals
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  retryCount?: number;

  // Context
  tenantId?: string;
  userId?: string;
  contractId?: string;
  feature?: string;          // e.g. 'chatbot', 'artifact_generation', 'rag_search'
  
  // Response quality
  responseFormat?: 'text' | 'json_object' | 'json_schema';
  jsonParseSuccess?: boolean;
  schemaValidationSuccess?: boolean;

  // Tags for grouping
  tags: Record<string, string>;
}

export interface LLMSpanOptions {
  model: string;
  operation: LLMSpan['operation'];
  provider?: LLMSpan['provider'];
  traceId?: string;
  parentSpanId?: string;
  tenantId?: string;
  userId?: string;
  contractId?: string;
  feature?: string;
  responseFormat?: LLMSpan['responseFormat'];
  tags?: Record<string, string>;
}

export interface LLMSpanResult {
  promptTokens?: number;
  completionTokens?: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  retryCount?: number;
  jsonParseSuccess?: boolean;
  schemaValidationSuccess?: boolean;
}

export interface AggregateMetrics {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  byModel: Record<string, { calls: number; tokens: number; cost: number; avgLatencyMs: number }>;
  byOperation: Record<string, { calls: number; tokens: number; avgLatencyMs: number }>;
  byFeature: Record<string, { calls: number; tokens: number; cost: number }>;
  errorBreakdown: Record<string, number>;
}

// ─── Cost Table (per 1M tokens, USD) ────────────────────────────────────────

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o':                  { input: 2.5,   output: 10.0  },
  'gpt-4o-mini':             { input: 0.15,  output: 0.6   },
  'gpt-4-turbo':             { input: 10.0,  output: 30.0  },
  'gpt-4':                   { input: 30.0,  output: 60.0  },
  'gpt-3.5-turbo':           { input: 0.5,   output: 1.5   },
  'claude-sonnet-4-20250514':        { input: 3.0,   output: 15.0  },
  'claude-3-5-haiku-20241022':    { input: 0.8,   output: 4.0   },
  'claude-3-5-sonnet-20241022':   { input: 3.0,   output: 15.0  },
  'text-embedding-3-large':  { input: 0.13,  output: 0     },
  'text-embedding-3-small':  { input: 0.02,  output: 0     },
  'rerank-v3.5':             { input: 2.0,   output: 0     },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = COST_PER_1M[model];
  if (!costs) return 0;
  return (promptTokens * costs.input + completionTokens * costs.output) / 1_000_000;
}

function detectProvider(model: string): LLMSpan['provider'] {
  if (model.startsWith('gpt-') || model.startsWith('text-embedding')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('rerank-') || model.startsWith('command-')) return 'cohere';
  return 'other';
}

// ─── AITracer Class ─────────────────────────────────────────────────────────

const MAX_BUFFER_SIZE = 5000;
const METRICS_WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window

class AITracer {
  private spans: LLMSpan[] = [];
  private activeSpans = new Map<string, LLMSpan>();
  private callbacks: Array<(span: LLMSpan) => void> = [];

  /** Start a new LLM span. Returns the span object to pass to endLLMSpan. */
  startLLMSpan(opts: LLMSpanOptions): LLMSpan {
    const span: LLMSpan = {
      id: randomUUID(),
      traceId: opts.traceId || randomUUID(),
      parentSpanId: opts.parentSpanId,
      operation: opts.operation,
      model: opts.model,
      provider: opts.provider || detectProvider(opts.model),
      startTime: Date.now(),
      success: false, // will be set on end
      tenantId: opts.tenantId,
      userId: opts.userId,
      contractId: opts.contractId,
      feature: opts.feature,
      responseFormat: opts.responseFormat,
      tags: opts.tags || {},
    };
    this.activeSpans.set(span.id, span);
    return span;
  }

  /** End an LLM span with result metrics. */
  endLLMSpan(span: LLMSpan, result: LLMSpanResult): void {
    span.endTime = Date.now();
    span.latencyMs = span.endTime - span.startTime;
    span.success = result.success;
    span.promptTokens = result.promptTokens;
    span.completionTokens = result.completionTokens;
    span.totalTokens = (result.promptTokens || 0) + (result.completionTokens || 0);
    span.estimatedCost = estimateCost(span.model, result.promptTokens || 0, result.completionTokens || 0);
    span.errorType = result.errorType;
    span.errorMessage = result.errorMessage;
    span.retryCount = result.retryCount;
    span.jsonParseSuccess = result.jsonParseSuccess;
    span.schemaValidationSuccess = result.schemaValidationSuccess;

    this.activeSpans.delete(span.id);
    this.spans.push(span);

    // Trim buffer
    while (this.spans.length > MAX_BUFFER_SIZE) {
      this.spans.shift();
    }

    // Notify callbacks
    for (const cb of this.callbacks) {
      try { cb(span); } catch { /* ignore */ }
    }
  }

  /** Convenience: trace an async LLM call. */
  async trace<T>(
    opts: LLMSpanOptions,
    fn: (span: LLMSpan) => Promise<{ result: T; tokenUsage?: { promptTokens?: number; completionTokens?: number } }>
  ): Promise<T> {
    const span = this.startLLMSpan(opts);
    try {
      const { result, tokenUsage } = await fn(span);
      this.endLLMSpan(span, {
        success: true,
        promptTokens: tokenUsage?.promptTokens,
        completionTokens: tokenUsage?.completionTokens,
      });
      return result;
    } catch (error) {
      this.endLLMSpan(span, {
        success: false,
        errorType: error instanceof Error ? error.name : 'Error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Register a callback for completed spans (e.g. export to OTel collector). */
  onSpanComplete(cb: (span: LLMSpan) => void): void {
    this.callbacks.push(cb);
  }

  /** Get aggregate metrics for the rolling window. */
  getMetrics(windowMs: number = METRICS_WINDOW_MS): AggregateMetrics {
    const cutoff = Date.now() - windowMs;
    const recent = this.spans.filter(s => s.startTime >= cutoff);

    const metrics: AggregateMetrics = {
      totalCalls: recent.length,
      totalTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      successRate: 0,
      byModel: {},
      byOperation: {},
      byFeature: {},
      errorBreakdown: {},
    };

    if (recent.length === 0) return metrics;

    const latencies: number[] = [];
    let successCount = 0;

    for (const span of recent) {
      metrics.totalTokens += span.totalTokens || 0;
      metrics.totalCost += span.estimatedCost || 0;
      if (span.latencyMs) latencies.push(span.latencyMs);
      if (span.success) successCount++;

      // By model
      const m = metrics.byModel[span.model] || { calls: 0, tokens: 0, cost: 0, avgLatencyMs: 0 };
      m.calls++;
      m.tokens += span.totalTokens || 0;
      m.cost += span.estimatedCost || 0;
      m.avgLatencyMs += span.latencyMs || 0;
      metrics.byModel[span.model] = m;

      // By operation
      const o = metrics.byOperation[span.operation] || { calls: 0, tokens: 0, avgLatencyMs: 0 };
      o.calls++;
      o.tokens += span.totalTokens || 0;
      o.avgLatencyMs += span.latencyMs || 0;
      metrics.byOperation[span.operation] = o;

      // By feature
      if (span.feature) {
        const f = metrics.byFeature[span.feature] || { calls: 0, tokens: 0, cost: 0 };
        f.calls++;
        f.tokens += span.totalTokens || 0;
        f.cost += span.estimatedCost || 0;
        metrics.byFeature[span.feature] = f;
      }

      // Errors
      if (!span.success && span.errorType) {
        metrics.errorBreakdown[span.errorType] = (metrics.errorBreakdown[span.errorType] || 0) + 1;
      }
    }

    // Compute averages
    latencies.sort((a, b) => a - b);
    metrics.avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    metrics.p95LatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] || 0 : 0;
    metrics.successRate = successCount / recent.length;

    for (const m of Object.values(metrics.byModel)) {
      m.avgLatencyMs = m.calls > 0 ? m.avgLatencyMs / m.calls : 0;
    }
    for (const o of Object.values(metrics.byOperation)) {
      o.avgLatencyMs = o.calls > 0 ? o.avgLatencyMs / o.calls : 0;
    }

    return metrics;
  }

  /** Get recent span data for debugging. */
  getRecentSpans(limit = 50): LLMSpan[] {
    return this.spans.slice(-limit);
  }

  /** Get spans matching a traceId. */
  getTraceSpans(traceId: string): LLMSpan[] {
    return this.spans.filter(s => s.traceId === traceId);
  }
}

/** Singleton AI tracer instance. */
export const aiTracer = new AITracer();
