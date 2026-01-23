/**
 * AI Analytics Service
 * 
 * Tracks and aggregates AI usage metrics including:
 * - Token consumption by model
 * - Request latency
 * - Cost tracking
 * - Error rates
 * - Feature usage
 */

import { prisma } from '@/lib/prisma';

// Types
export interface AIUsageEvent {
  model: string;
  endpoint: string;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  userId?: string;
  tenantId?: string;
  contractId?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

export interface ModelMetrics {
  model: string;
  requests: number;
  avgLatency: number;
  successRate: number;
  avgTokens: number;
  cost: number;
}

export interface EndpointMetrics {
  endpoint: string;
  calls: number;
  avgLatency: number;
  errorRate: number;
}

export interface AIMetrics {
  period: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  tokenUsageByDay: TokenUsage[];
  modelBreakdown: ModelMetrics[];
  endpointBreakdown: EndpointMetrics[];
  topFeatures: Array<{ feature: string; usage: number }>;
  errors: Array<{ type: string; count: number; lastOccurred: string }>;
}

// Model pricing (per 1K tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
  'mistral-large': { input: 0.004, output: 0.012 },
  'mistral-medium': { input: 0.0027, output: 0.0081 },
  'mistral-small': { input: 0.001, output: 0.003 },
};

// In-memory cache for aggregations (refresh every 5 minutes)
let metricsCache: { data: AIMetrics | null; timestamp: number; period: string } = {
  data: null,
  timestamp: 0,
  period: '',
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class AIAnalyticsService {
  /**
   * Track an AI usage event
   */
  async trackUsage(event: AIUsageEvent): Promise<void> {
    const cost = this.calculateCost(event.model, event.inputTokens, event.outputTokens);

    try {
      await (prisma as any).aiUsageLog?.create({
        data: {
          model: event.model,
          endpoint: event.endpoint,
          feature: event.feature,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.inputTokens + event.outputTokens,
          latencyMs: event.latencyMs,
          cost,
          success: event.success,
          errorType: event.errorType,
          userId: event.userId,
          tenantId: event.tenantId,
          contractId: event.contractId,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
          createdAt: new Date(),
        },
      });

      // Invalidate cache
      metricsCache.data = null;
    } catch (error) {
      // Log but don't fail the main request
      console.error('Failed to track AI usage:', error);
    }
  }

  /**
   * Calculate cost for a request
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  }

  /**
   * Get aggregated metrics for a time period
   */
  async getMetrics(period: '7d' | '30d' | '90d', tenantId?: string): Promise<AIMetrics> {
    // Check cache
    const now = Date.now();
    if (
      metricsCache.data &&
      metricsCache.period === period &&
      now - metricsCache.timestamp < CACHE_TTL
    ) {
      return metricsCache.data;
    }

    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      createdAt: { gte: startDate },
      ...(tenantId && { tenantId }),
    };

    // Get all logs for the period
    const logs = await (prisma as any).aiUsageLog?.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
    }) || [];

    // Aggregate metrics
    const totalRequests = logs.length;
    const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0);
    const avgLatency = logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length)
      : 0;
    const successCount = logs.filter(l => l.success).length;
    const successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 100;

    // Token usage by day
    const tokensByDay = new Map<string, TokenUsage>();
    for (const log of logs) {
      const date = log.createdAt.toISOString().split('T')[0];
      const existing = tokensByDay.get(date) || {
        date,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
      existing.inputTokens += log.inputTokens;
      existing.outputTokens += log.outputTokens;
      existing.totalTokens += log.totalTokens;
      existing.cost += log.cost;
      tokensByDay.set(date, existing);
    }

    // Fill in missing days
    const tokenUsageByDay: TokenUsage[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      tokenUsageByDay.push(tokensByDay.get(date) || {
        date,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
      });
    }

    // Model breakdown
    const modelMap = new Map<string, {
      requests: number;
      totalLatency: number;
      successCount: number;
      totalTokens: number;
      cost: number;
    }>();
    for (const log of logs) {
      const existing = modelMap.get(log.model) || {
        requests: 0,
        totalLatency: 0,
        successCount: 0,
        totalTokens: 0,
        cost: 0,
      };
      existing.requests++;
      existing.totalLatency += log.latencyMs;
      if (log.success) existing.successCount++;
      existing.totalTokens += log.totalTokens;
      existing.cost += log.cost;
      modelMap.set(log.model, existing);
    }

    const modelBreakdown: ModelMetrics[] = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      requests: data.requests,
      avgLatency: Math.round(data.totalLatency / data.requests),
      successRate: (data.successCount / data.requests) * 100,
      avgTokens: Math.round(data.totalTokens / data.requests),
      cost: data.cost,
    }));

    // Endpoint breakdown
    const endpointMap = new Map<string, {
      calls: number;
      totalLatency: number;
      errorCount: number;
    }>();
    for (const log of logs) {
      const existing = endpointMap.get(log.endpoint) || {
        calls: 0,
        totalLatency: 0,
        errorCount: 0,
      };
      existing.calls++;
      existing.totalLatency += log.latencyMs;
      if (!log.success) existing.errorCount++;
      endpointMap.set(log.endpoint, existing);
    }

    const endpointBreakdown: EndpointMetrics[] = Array.from(endpointMap.entries()).map(([endpoint, data]) => ({
      endpoint,
      calls: data.calls,
      avgLatency: Math.round(data.totalLatency / data.calls),
      errorRate: (data.errorCount / data.calls) * 100,
    }));

    // Top features
    const featureMap = new Map<string, number>();
    for (const log of logs) {
      featureMap.set(log.feature, (featureMap.get(log.feature) || 0) + 1);
    }
    const topFeatures = Array.from(featureMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([feature, usage]) => ({ feature, usage }));

    // Errors
    const errorMap = new Map<string, { count: number; lastOccurred: Date }>();
    for (const log of logs) {
      if (!log.success && log.errorType) {
        const existing = errorMap.get(log.errorType) || { count: 0, lastOccurred: new Date(0) };
        existing.count++;
        if (log.createdAt > existing.lastOccurred) {
          existing.lastOccurred = log.createdAt;
        }
        errorMap.set(log.errorType, existing);
      }
    }
    const errors = Array.from(errorMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([type, data]) => ({
        type,
        count: data.count,
        lastOccurred: data.lastOccurred.toISOString(),
      }));

    const metrics: AIMetrics = {
      period,
      totalRequests,
      totalTokens,
      totalCost,
      avgLatency,
      successRate,
      tokenUsageByDay,
      modelBreakdown,
      endpointBreakdown,
      topFeatures,
      errors,
    };

    // Update cache
    metricsCache = { data: metrics, timestamp: now, period };

    return metrics;
  }

  /**
   * Get real-time usage for the current day
   */
  async getTodayUsage(tenantId?: string): Promise<{
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const logs = await (prisma as any).aiUsageLog?.findMany({
      where: {
        createdAt: { gte: startOfDay },
        ...(tenantId && { tenantId }),
      },
    }) || [];

    return {
      requests: logs.length,
      tokens: logs.reduce((sum, l) => sum + l.totalTokens, 0),
      cost: logs.reduce((sum, l) => sum + l.cost, 0),
      avgLatency: logs.length > 0
        ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length)
        : 0,
    };
  }

  /**
   * Get usage by user
   */
  async getUserUsage(
    userId: string,
    period: '7d' | '30d' | '90d' = '30d'
  ): Promise<{
    requests: number;
    tokens: number;
    cost: number;
    topFeatures: Array<{ feature: string; usage: number }>;
  }> {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await (prisma as any).aiUsageLog?.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    }) || [];

    const featureMap = new Map<string, number>();
    for (const log of logs) {
      featureMap.set(log.feature, (featureMap.get(log.feature) || 0) + 1);
    }

    return {
      requests: logs.length,
      tokens: logs.reduce((sum, l) => sum + l.totalTokens, 0),
      cost: logs.reduce((sum, l) => sum + l.cost, 0),
      topFeatures: Array.from(featureMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([feature, usage]) => ({ feature, usage })),
    };
  }
}

export const aiAnalytics = new AIAnalyticsService();
