/**
 * AI Cost Optimizer Service
 * 
 * Intelligently routes requests to minimize costs while maintaining quality:
 * - Model selection based on complexity
 * - Caching strategies
 * - Batch optimization
 * - Budget tracking
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';

const logger = createLogger('cost-optimizer');

// =============================================================================
// TYPES
// =============================================================================

export type AIModel = 
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'claude-3-5-haiku';

export interface ModelPricing {
  model: AIModel;
  inputCostPer1K: number;  // USD per 1000 tokens
  outputCostPer1K: number; // USD per 1000 tokens
  contextWindow: number;
  qualityTier: 'premium' | 'standard' | 'economy';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: AIModel;
  timestamp: Date;
  taskType: string;
  tenantId: string;
}

export interface CostEstimate {
  recommendedModel: AIModel;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  alternativeModels: Array<{
    model: AIModel;
    cost: number;
    qualityTradeoff: string;
  }>;
  cachingPotential: number; // 0-1, how much could be saved with caching
}

export interface BudgetConfig {
  dailyLimit: number;
  monthlyLimit: number;
  warningThreshold: number; // 0-1
  fallbackModel: AIModel;
  priorityTasks: string[]; // Tasks that get priority budget
}

export interface UsageReport {
  period: 'day' | 'week' | 'month';
  totalCost: number;
  byModel: Record<AIModel, { cost: number; requests: number; tokens: number }>;
  byTask: Record<string, { cost: number; requests: number }>;
  topExpensiveTasks: Array<{ task: string; cost: number; count: number }>;
  savingsFromCaching: number;
  recommendations: string[];
}

// =============================================================================
// PRICING DATA
// =============================================================================

const MODEL_PRICING: Record<AIModel, ModelPricing> = {
  'gpt-4o': {
    model: 'gpt-4o',
    inputCostPer1K: 0.005,
    outputCostPer1K: 0.015,
    contextWindow: 128000,
    qualityTier: 'premium',
  },
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    contextWindow: 128000,
    qualityTier: 'standard',
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    contextWindow: 128000,
    qualityTier: 'premium',
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    inputCostPer1K: 0.0005,
    outputCostPer1K: 0.0015,
    contextWindow: 16384,
    qualityTier: 'economy',
  },
  'claude-3-opus': {
    model: 'claude-3-opus',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    contextWindow: 200000,
    qualityTier: 'premium',
  },
  'claude-3-sonnet': {
    model: 'claude-3-sonnet',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    contextWindow: 200000,
    qualityTier: 'standard',
  },
  'claude-3-haiku': {
    model: 'claude-3-haiku',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.00125,
    contextWindow: 200000,
    qualityTier: 'economy',
  },
  'claude-3-5-haiku': {
    model: 'claude-3-5-haiku',
    inputCostPer1K: 0.0008,
    outputCostPer1K: 0.004,
    contextWindow: 200000,
    qualityTier: 'standard',
  },
};

// =============================================================================
// TASK COMPLEXITY MATRIX
// =============================================================================

interface TaskComplexity {
  minQualityTier: 'premium' | 'standard' | 'economy';
  expectedInputTokens: number;
  expectedOutputTokens: number;
  cacheable: boolean;
  cacheTTL: number; // seconds
}

const TASK_COMPLEXITY: Record<string, TaskComplexity> = {
  // High complexity - need premium models
  'contract-classification': { minQualityTier: 'standard', expectedInputTokens: 2000, expectedOutputTokens: 200, cacheable: true, cacheTTL: 3600 },
  'complex-clause-extraction': { minQualityTier: 'premium', expectedInputTokens: 8000, expectedOutputTokens: 2000, cacheable: false, cacheTTL: 0 },
  'legal-risk-analysis': { minQualityTier: 'premium', expectedInputTokens: 10000, expectedOutputTokens: 3000, cacheable: false, cacheTTL: 0 },
  'multi-party-extraction': { minQualityTier: 'premium', expectedInputTokens: 5000, expectedOutputTokens: 1500, cacheable: false, cacheTTL: 0 },
  
  // Medium complexity - standard models work well
  'date-extraction': { minQualityTier: 'economy', expectedInputTokens: 1500, expectedOutputTokens: 500, cacheable: true, cacheTTL: 86400 },
  'party-identification': { minQualityTier: 'standard', expectedInputTokens: 2000, expectedOutputTokens: 800, cacheable: true, cacheTTL: 3600 },
  'monetary-extraction': { minQualityTier: 'standard', expectedInputTokens: 1500, expectedOutputTokens: 400, cacheable: true, cacheTTL: 3600 },
  'obligation-extraction': { minQualityTier: 'standard', expectedInputTokens: 4000, expectedOutputTokens: 1500, cacheable: false, cacheTTL: 0 },
  
  // Low complexity - economy models sufficient
  'language-detection': { minQualityTier: 'economy', expectedInputTokens: 500, expectedOutputTokens: 50, cacheable: true, cacheTTL: 86400 },
  'summary-generation': { minQualityTier: 'economy', expectedInputTokens: 3000, expectedOutputTokens: 500, cacheable: true, cacheTTL: 3600 },
  'translation': { minQualityTier: 'standard', expectedInputTokens: 2000, expectedOutputTokens: 2000, cacheable: true, cacheTTL: 86400 },
  'simple-field-extraction': { minQualityTier: 'economy', expectedInputTokens: 1000, expectedOutputTokens: 200, cacheable: true, cacheTTL: 3600 },
};

// =============================================================================
// AI COST OPTIMIZER SERVICE
// =============================================================================

export class AICostOptimizerService {
  private static instance: AICostOptimizerService;
  private usageHistory: TokenUsage[] = [];
  private budgetConfigs: Map<string, BudgetConfig> = new Map();
  private cacheHits: Map<string, number> = new Map();
  private cacheMisses: Map<string, number> = new Map();

  private constructor() {
    this.setDefaultBudget();
  }

  static getInstance(): AICostOptimizerService {
    if (!AICostOptimizerService.instance) {
      AICostOptimizerService.instance = new AICostOptimizerService();
    }
    return AICostOptimizerService.instance;
  }

  // ===========================================================================
  // MODEL SELECTION
  // ===========================================================================

  selectOptimalModel(
    taskType: string,
    inputText: string,
    options: {
      tenantId?: string;
      qualityOverride?: 'premium' | 'standard' | 'economy';
      maxCost?: number;
    } = {}
  ): { model: AIModel; reason: string } {
    const { tenantId = 'default', qualityOverride, maxCost } = options;
    
    // Get task complexity
    const complexity = TASK_COMPLEXITY[taskType] || {
      minQualityTier: 'standard',
      expectedInputTokens: 2000,
      expectedOutputTokens: 500,
      cacheable: false,
      cacheTTL: 0,
    };

    const requiredTier = qualityOverride || complexity.minQualityTier;

    // Check budget constraints
    const budget = this.budgetConfigs.get(tenantId);
    const dailySpend = this.getDailySpend(tenantId);
    
    if (budget && dailySpend >= budget.dailyLimit * budget.warningThreshold) {
      // Near budget limit - use fallback
      return {
        model: budget.fallbackModel,
        reason: `Budget constraint: ${(dailySpend / budget.dailyLimit * 100).toFixed(0)}% of daily limit used`,
      };
    }

    // Get eligible models by tier
    const eligibleModels = Object.values(MODEL_PRICING)
      .filter(m => {
        if (requiredTier === 'premium') return m.qualityTier === 'premium';
        if (requiredTier === 'standard') return m.qualityTier !== 'economy';
        return true;
      })
      .sort((a, b) => 
        (a.inputCostPer1K + a.outputCostPer1K) - (b.inputCostPer1K + b.outputCostPer1K)
      );

    // Check max cost constraint
    if (maxCost !== undefined) {
      const inputTokens = this.estimateTokens(inputText);
      const outputTokens = complexity.expectedOutputTokens;

      for (const model of eligibleModels) {
        const cost = this.calculateCost(model.model, inputTokens, outputTokens);
        if (cost <= maxCost) {
          return {
            model: model.model,
            reason: `Within cost limit ($${maxCost.toFixed(4)})`,
          };
        }
      }
    }

    // Default selection - cheapest eligible model
    const selected = eligibleModels[0];
    return {
      model: selected.model,
      reason: `Optimal for ${taskType} (${selected.qualityTier} tier)`,
    };
  }

  // ===========================================================================
  // COST ESTIMATION
  // ===========================================================================

  estimateCost(
    taskType: string,
    inputText: string,
    preferredModel?: AIModel
  ): CostEstimate {
    const inputTokens = this.estimateTokens(inputText);
    const complexity = TASK_COMPLEXITY[taskType] || {
      minQualityTier: 'standard',
      expectedInputTokens: 2000,
      expectedOutputTokens: 500,
      cacheable: false,
      cacheTTL: 0,
    };
    const outputTokens = complexity.expectedOutputTokens;

    const recommendedModel = preferredModel || this.selectOptimalModel(taskType, inputText).model;
    const estimatedCost = this.calculateCost(recommendedModel, inputTokens, outputTokens);

    // Calculate alternatives
    const alternatives = Object.values(MODEL_PRICING)
      .filter(m => m.model !== recommendedModel)
      .map(m => ({
        model: m.model,
        cost: this.calculateCost(m.model, inputTokens, outputTokens),
        qualityTradeoff: this.getQualityTradeoff(recommendedModel, m.model),
      }))
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 3);

    // Estimate caching potential
    const cachingPotential = complexity.cacheable ? 0.5 : 0;

    return {
      recommendedModel,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCost,
      alternativeModels: alternatives,
      cachingPotential,
    };
  }

  private calculateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model];
    return (inputTokens / 1000 * pricing.inputCostPer1K) + 
           (outputTokens / 1000 * pricing.outputCostPer1K);
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  private getQualityTradeoff(from: AIModel, to: AIModel): string {
    const fromPricing = MODEL_PRICING[from];
    const toPricing = MODEL_PRICING[to];

    if (toPricing.qualityTier === fromPricing.qualityTier) {
      return 'Similar quality';
    }

    const tierOrder = { premium: 3, standard: 2, economy: 1 };
    if (tierOrder[toPricing.qualityTier] < tierOrder[fromPricing.qualityTier]) {
      return 'Lower quality, cheaper';
    }
    return 'Higher quality, more expensive';
  }

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  recordUsage(usage: Omit<TokenUsage, 'timestamp'>): void {
    this.usageHistory.push({
      ...usage,
      timestamp: new Date(),
    });

    // Keep last 100000 records
    if (this.usageHistory.length > 100000) {
      this.usageHistory = this.usageHistory.slice(-50000);
    }

    const cost = this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens);
    logger.debug({
      model: usage.model,
      task: usage.taskType,
      tokens: usage.inputTokens + usage.outputTokens,
      cost: cost.toFixed(4),
    }, 'Recorded AI usage');
  }

  recordCacheHit(taskType: string): void {
    const current = this.cacheHits.get(taskType) || 0;
    this.cacheHits.set(taskType, current + 1);
  }

  recordCacheMiss(taskType: string): void {
    const current = this.cacheMisses.get(taskType) || 0;
    this.cacheMisses.set(taskType, current + 1);
  }

  // ===========================================================================
  // BUDGET MANAGEMENT
  // ===========================================================================

  setBudget(tenantId: string, config: BudgetConfig): void {
    this.budgetConfigs.set(tenantId, config);
  }

  private setDefaultBudget(): void {
    this.budgetConfigs.set('default', {
      dailyLimit: 100, // $100/day
      monthlyLimit: 2000, // $2000/month
      warningThreshold: 0.8,
      fallbackModel: 'gpt-3.5-turbo',
      priorityTasks: ['legal-risk-analysis', 'complex-clause-extraction'],
    });
  }

  private getDailySpend(tenantId: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.usageHistory
      .filter(u => u.tenantId === tenantId && u.timestamp >= today)
      .reduce((sum, u) => sum + this.calculateCost(u.model, u.inputTokens, u.outputTokens), 0);
  }

  getBudgetStatus(tenantId: string = 'default'): {
    dailySpend: number;
    dailyLimit: number;
    dailyRemaining: number;
    percentUsed: number;
    status: 'ok' | 'warning' | 'critical';
  } {
    const budget = this.budgetConfigs.get(tenantId) || this.budgetConfigs.get('default')!;
    const dailySpend = this.getDailySpend(tenantId);
    const percentUsed = dailySpend / budget.dailyLimit;

    let status: 'ok' | 'warning' | 'critical';
    if (percentUsed >= 1) {
      status = 'critical';
    } else if (percentUsed >= budget.warningThreshold) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    return {
      dailySpend,
      dailyLimit: budget.dailyLimit,
      dailyRemaining: Math.max(0, budget.dailyLimit - dailySpend),
      percentUsed,
      status,
    };
  }

  // ===========================================================================
  // REPORTING
  // ===========================================================================

  generateUsageReport(
    tenantId: string = 'default',
    period: 'day' | 'week' | 'month' = 'month'
  ): UsageReport {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const relevantUsage = this.usageHistory.filter(
      u => u.tenantId === tenantId && u.timestamp >= startDate
    );

    // Aggregate by model
    const byModel: Record<AIModel, { cost: number; requests: number; tokens: number }> = {} as any;
    for (const model of Object.keys(MODEL_PRICING) as AIModel[]) {
      byModel[model] = { cost: 0, requests: 0, tokens: 0 };
    }

    // Aggregate by task
    const byTask: Record<string, { cost: number; requests: number }> = {};

    let totalCost = 0;

    for (const usage of relevantUsage) {
      const cost = this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens);
      totalCost += cost;

      byModel[usage.model].cost += cost;
      byModel[usage.model].requests += 1;
      byModel[usage.model].tokens += usage.inputTokens + usage.outputTokens;

      if (!byTask[usage.taskType]) {
        byTask[usage.taskType] = { cost: 0, requests: 0 };
      }
      byTask[usage.taskType].cost += cost;
      byTask[usage.taskType].requests += 1;
    }

    // Top expensive tasks
    const topExpensiveTasks = Object.entries(byTask)
      .map(([task, data]) => ({ task, cost: data.cost, count: data.requests }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Calculate cache savings
    const totalCacheHits = Array.from(this.cacheHits.values()).reduce((a, b) => a + b, 0);
    const totalCacheMisses = Array.from(this.cacheMisses.values()).reduce((a, b) => a + b, 0);
    const cacheRate = totalCacheHits + totalCacheMisses > 0 
      ? totalCacheHits / (totalCacheHits + totalCacheMisses) 
      : 0;
    
    // Estimate savings (cache hits would have cost the same as average request)
    const avgCostPerRequest = relevantUsage.length > 0 ? totalCost / relevantUsage.length : 0;
    const savingsFromCaching = totalCacheHits * avgCostPerRequest;

    // Generate recommendations
    const recommendations = this.generateRecommendations(byModel, byTask, cacheRate);

    return {
      period,
      totalCost,
      byModel,
      byTask,
      topExpensiveTasks,
      savingsFromCaching,
      recommendations,
    };
  }

  private generateRecommendations(
    byModel: Record<AIModel, { cost: number; requests: number; tokens: number }>,
    byTask: Record<string, { cost: number; requests: number }>,
    cacheRate: number
  ): string[] {
    const recommendations: string[] = [];

    // Check if using expensive models for simple tasks
    if (byModel['gpt-4o'].requests > byModel['gpt-4o-mini'].requests * 2) {
      recommendations.push('Consider using GPT-4o-mini for simpler tasks to reduce costs by up to 90%');
    }

    // Check cache rate
    if (cacheRate < 0.3) {
      recommendations.push('Low cache hit rate. Review caching strategy for repeated queries.');
    }

    // Check for high-volume tasks that could be batched
    for (const [task, data] of Object.entries(byTask)) {
      if (data.requests > 100 && data.cost / data.requests < 0.01) {
        recommendations.push(`Task "${task}" has high volume - consider batch processing to reduce overhead`);
      }
    }

    // Recommend model alternatives
    if (byModel['gpt-4-turbo'].cost > 50) {
      recommendations.push('GPT-4 Turbo usage is high. GPT-4o offers similar quality at lower cost.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cost optimization looks good. Continue monitoring usage patterns.');
    }

    return recommendations;
  }

  // ===========================================================================
  // BATCH OPTIMIZATION
  // ===========================================================================

  optimizeBatch(
    requests: Array<{ taskType: string; inputText: string }>
  ): {
    groupedByModel: Map<AIModel, Array<{ taskType: string; inputText: string }>>;
    estimatedTotalCost: number;
    estimatedSavings: number;
  } {
    const groupedByModel = new Map<AIModel, Array<{ taskType: string; inputText: string }>>();
    let totalCost = 0;
    let naiveCost = 0;

    for (const request of requests) {
      const { model } = this.selectOptimalModel(request.taskType, request.inputText);
      
      if (!groupedByModel.has(model)) {
        groupedByModel.set(model, []);
      }
      groupedByModel.get(model)!.push(request);

      // Calculate optimized cost
      const estimate = this.estimateCost(request.taskType, request.inputText, model);
      totalCost += estimate.estimatedCost;

      // Calculate naive cost (if everything used GPT-4o)
      const naiveEstimate = this.estimateCost(request.taskType, request.inputText, 'gpt-4o');
      naiveCost += naiveEstimate.estimatedCost;
    }

    return {
      groupedByModel,
      estimatedTotalCost: totalCost,
      estimatedSavings: naiveCost - totalCost,
    };
  }

  // ===========================================================================
  // CACHING INTEGRATION
  // ===========================================================================

  async getCachedOrCompute<T>(
    taskType: string,
    inputHash: string,
    computeFn: () => Promise<T>
  ): Promise<{ result: T; fromCache: boolean }> {
    const complexity = TASK_COMPLEXITY[taskType];
    
    if (!complexity?.cacheable) {
      const result = await computeFn();
      return { result, fromCache: false };
    }

    const cacheKey = `ai:${taskType}:${inputHash}`;
    const cached = await cacheAdaptor.get<T>(cacheKey);

    if (cached) {
      this.recordCacheHit(taskType);
      logger.debug({ taskType, cacheKey }, 'Cache hit');
      return { result: cached, fromCache: true };
    }

    this.recordCacheMiss(taskType);
    const result = await computeFn();
    
    await cacheAdaptor.set(cacheKey, result, complexity.cacheTTL);
    
    return { result, fromCache: false };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const aiCostOptimizerService = AICostOptimizerService.getInstance();
