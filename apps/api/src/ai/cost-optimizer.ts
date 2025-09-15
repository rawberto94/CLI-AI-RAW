/**
 * AI Cost Optimization Service
 * Advanced cost management and budget controls for AI operations
 */

import { AppError } from '../errors';

interface CostBudget {
  tenantId: string;
  dailyLimit: number;
  monthlyLimit: number;
  alertThresholds: {
    daily: number; // Percentage (0-100)
    monthly: number; // Percentage (0-100)
  };
  restrictions: {
    maxCostPerRequest: number;
    allowedModels: string[];
    priorityLimits: Record<string, number>; // Cost limits by priority level
  };
}

interface CostMetrics {
  tenantId: string;
  date: string; // YYYY-MM-DD
  totalCost: number;
  requestCount: number;
  modelBreakdown: Record<string, { cost: number; requests: number }>;
  taskTypeBreakdown: Record<string, { cost: number; requests: number }>;
}

interface CostAlert {
  tenantId: string;
  type: 'daily' | 'monthly' | 'request' | 'model';
  threshold: number;
  currentValue: number;
  timestamp: Date;
  message: string;
}

export class CostOptimizationService {
  private budgets: Map<string, CostBudget> = new Map();
  private dailyMetrics: Map<string, CostMetrics> = new Map(); // Key: tenantId:date
  private monthlyMetrics: Map<string, CostMetrics> = new Map(); // Key: tenantId:month
  private alerts: CostAlert[] = [];

  constructor() {
    // Initialize default budgets
    this.setDefaultBudgets();
    
    // Start daily cleanup and aggregation
    setInterval(() => this.performDailyCleanup(), 24 * 60 * 60 * 1000); // Daily
  }

  /**
   * Set budget limits for a tenant
   */
  setBudget(budget: CostBudget): void {
    this.budgets.set(budget.tenantId, budget);
  }

  /**
   * Get budget for a tenant
   */
  getBudget(tenantId: string): CostBudget | null {
    return this.budgets.get(tenantId) || null;
  }

  /**
   * Check if request is within budget constraints
   */
  async checkBudgetConstraints(
    tenantId: string,
    estimatedCost: number,
    requestDetails: {
      taskType: string;
      priority: string;
      modelId: string;
    }
  ): Promise<{ allowed: boolean; reason?: string; alternatives?: string[] }> {
    const budget = this.budgets.get(tenantId);
    if (!budget) {
      return { allowed: true }; // No budget restrictions
    }

    // Check per-request cost limit
    if (estimatedCost > budget.restrictions.maxCostPerRequest) {
      return {
        allowed: false,
        reason: `Request cost ($${estimatedCost.toFixed(4)}) exceeds per-request limit ($${budget.restrictions.maxCostPerRequest})`,
        alternatives: this.suggestCheaperAlternatives(requestDetails.modelId)
      };
    }

    // Check model restrictions
    if (!budget.restrictions.allowedModels.includes(requestDetails.modelId)) {
      return {
        allowed: false,
        reason: `Model ${requestDetails.modelId} not allowed for this tenant`,
        alternatives: budget.restrictions.allowedModels
      };
    }

    // Check priority-based limits
    const priorityLimit = budget.restrictions.priorityLimits[requestDetails.priority];
    if (priorityLimit && estimatedCost > priorityLimit) {
      return {
        allowed: false,
        reason: `Request cost exceeds limit for ${requestDetails.priority} priority ($${priorityLimit})`,
        alternatives: this.suggestCheaperAlternatives(requestDetails.modelId)
      };
    }

    // Check daily budget
    const today = new Date().toISOString().split('T')[0]!;
    const dailyMetrics = this.getDailyMetrics(tenantId, today);
    if (dailyMetrics.totalCost + estimatedCost > budget.dailyLimit) {
      return {
        allowed: false,
        reason: `Request would exceed daily budget limit ($${budget.dailyLimit})`,
        alternatives: []
      };
    }

    // Check monthly budget
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyMetrics = this.getMonthlyMetrics(tenantId, thisMonth);
    if (monthlyMetrics.totalCost + estimatedCost > budget.monthlyLimit) {
      return {
        allowed: false,
        reason: `Request would exceed monthly budget limit ($${budget.monthlyLimit})`,
        alternatives: []
      };
    }

    return { allowed: true };
  }

  /**
   * Record cost for a completed request
   */
  recordCost(
    tenantId: string,
    cost: number,
    details: {
      modelId: string;
      taskType: string;
      priority: string;
      processingTime: number;
      tokensUsed: { input: number; output: number };
    }
  ): void {
    const today = new Date().toISOString().split('T')[0]!;
    const thisMonth = today.slice(0, 7);

    // Update daily metrics
    this.updateDailyMetrics(tenantId, today, cost, details);
    
    // Update monthly metrics
    this.updateMonthlyMetrics(tenantId, thisMonth, cost, details);
    
    // Check for budget alerts
    this.checkBudgetAlerts(tenantId);
  }

  /**
   * Get cost metrics for a tenant
   */
  getCostMetrics(tenantId: string, period: 'daily' | 'monthly' = 'daily'): CostMetrics[] {
    const metrics: CostMetrics[] = [];
    const prefix = `${tenantId}:`;

    if (period === 'daily') {
      for (const [key, value] of this.dailyMetrics.entries()) {
        if (key.startsWith(prefix)) {
          metrics.push(value);
        }
      }
    } else {
      for (const [key, value] of this.monthlyMetrics.entries()) {
        if (key.startsWith(prefix)) {
          metrics.push(value);
        }
      }
    }

    return metrics.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get cost optimization recommendations
   */
  getOptimizationRecommendations(tenantId: string): any {
    const dailyMetrics = this.getCostMetrics(tenantId, 'daily').slice(0, 30); // Last 30 days
    const budget = this.budgets.get(tenantId);

    if (dailyMetrics.length === 0) {
      return { recommendations: [] };
    }

    const recommendations = [];
    const totalCost = dailyMetrics.reduce((sum, m) => sum + m.totalCost, 0);
    const avgDailyCost = totalCost / dailyMetrics.length;

    // Analyze model usage patterns
    const modelCosts: Record<string, number> = {};
    const modelRequests: Record<string, number> = {};
    
    dailyMetrics.forEach(day => {
      Object.entries(day.modelBreakdown).forEach(([model, data]) => {
        modelCosts[model] = (modelCosts[model] || 0) + data.cost;
        modelRequests[model] = (modelRequests[model] || 0) + data.requests;
      });
    });

    // Recommend cheaper model alternatives
    const expensiveModels = Object.entries(modelCosts)
      .filter(([_, cost]) => cost > avgDailyCost * 0.3)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 3);

    expensiveModels.forEach(([model, cost]) => {
      const alternatives = this.suggestCheaperAlternatives(model);
      if (alternatives.length > 0) {
        const potentialSavings = cost * 0.4; // Estimate 40% savings
        recommendations.push({
          type: 'model-optimization',
          title: `Consider cheaper alternatives to ${model}`,
          description: `You spent $${cost.toFixed(2)} on ${model}. Consider using ${alternatives[0]} for similar tasks.`,
          potentialSavings: potentialSavings,
          action: `Switch non-critical tasks from ${model} to ${alternatives[0]}`
        });
      }
    });

    // Analyze task complexity vs cost
    const taskCosts: Record<string, number> = {};
    dailyMetrics.forEach(day => {
      Object.entries(day.taskTypeBreakdown).forEach(([task, data]) => {
        taskCosts[task] = (taskCosts[task] || 0) + data.cost;
      });
    });

    const expensiveTasks = Object.entries(taskCosts)
      .filter(([_, cost]) => cost > avgDailyCost * 0.2)
      .sort(([_, a], [__, b]) => b - a);

    expensiveTasks.forEach(([task, cost]) => {
      recommendations.push({
        type: 'task-optimization',
        title: `Optimize ${task} operations`,
        description: `${task} accounts for $${cost.toFixed(2)} of your costs. Consider batching requests or using simpler models for routine tasks.`,
        potentialSavings: cost * 0.25,
        action: `Batch ${task} requests or use faster models for simple cases`
      });
    });

    // Budget utilization recommendations
    if (budget) {
      const utilizationRate = avgDailyCost / budget.dailyLimit;
      
      if (utilizationRate > 0.8) {
        recommendations.push({
          type: 'budget-warning',
          title: 'High budget utilization',
          description: `You're using ${(utilizationRate * 100).toFixed(1)}% of your daily budget on average.`,
          potentialSavings: 0,
          action: 'Consider increasing budget or optimizing usage patterns'
        });
      } else if (utilizationRate < 0.3) {
        recommendations.push({
          type: 'budget-optimization',
          title: 'Low budget utilization',
          description: `You're only using ${(utilizationRate * 100).toFixed(1)}% of your daily budget.`,
          potentialSavings: 0,
          action: 'Consider reducing budget or exploring additional AI capabilities'
        });
      }
    }

    return {
      recommendations,
      totalAnalyzedCost: totalCost,
      avgDailyCost,
      potentialTotalSavings: recommendations.reduce((sum, r) => sum + r.potentialSavings, 0)
    };
  }

  /**
   * Get recent cost alerts
   */
  getRecentAlerts(tenantId: string, limit: number = 10): CostAlert[] {
    return this.alerts
      .filter(alert => alert.tenantId === tenantId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Private helper methods
   */
  private setDefaultBudgets(): void {
    // Set default budget for demo tenant
    this.setBudget({
      tenantId: 'demo',
      dailyLimit: 10.0, // $10/day
      monthlyLimit: 250.0, // $250/month
      alertThresholds: {
        daily: 80, // Alert at 80% of daily budget
        monthly: 75 // Alert at 75% of monthly budget
      },
      restrictions: {
        maxCostPerRequest: 1.0, // $1 per request max
        allowedModels: ['gpt-4o', 'gpt-3.5-turbo', 'claude-3-sonnet', 'claude-3-haiku'],
        priorityLimits: {
          'low': 0.10,
          'medium': 0.25,
          'high': 0.50,
          'urgent': 1.00
        }
      }
    });
  }

  private getDailyMetrics(tenantId: string, date: string): CostMetrics {
    const key = `${tenantId}:${date}`;
    return this.dailyMetrics.get(key) || {
      tenantId,
      date,
      totalCost: 0,
      requestCount: 0,
      modelBreakdown: {},
      taskTypeBreakdown: {}
    };
  }

  private getMonthlyMetrics(tenantId: string, month: string): CostMetrics {
    const key = `${tenantId}:${month}`;
    return this.monthlyMetrics.get(key) || {
      tenantId,
      date: month,
      totalCost: 0,
      requestCount: 0,
      modelBreakdown: {},
      taskTypeBreakdown: {}
    };
  }

  private updateDailyMetrics(tenantId: string, date: string, cost: number, details: any): void {
    const key = `${tenantId}:${date}`;
    const metrics = this.getDailyMetrics(tenantId, date);
    
    metrics.totalCost += cost;
    metrics.requestCount += 1;
    
    // Update model breakdown
    if (!metrics.modelBreakdown[details.modelId]) {
      metrics.modelBreakdown[details.modelId] = { cost: 0, requests: 0 };
    }
    metrics.modelBreakdown[details.modelId].cost += cost;
    metrics.modelBreakdown[details.modelId].requests += 1;
    
    // Update task type breakdown
    if (!metrics.taskTypeBreakdown[details.taskType]) {
      metrics.taskTypeBreakdown[details.taskType] = { cost: 0, requests: 0 };
    }
    metrics.taskTypeBreakdown[details.taskType].cost += cost;
    metrics.taskTypeBreakdown[details.taskType].requests += 1;
    
    this.dailyMetrics.set(key, metrics);
  }

  private updateMonthlyMetrics(tenantId: string, month: string, cost: number, details: any): void {
    const key = `${tenantId}:${month}`;
    const metrics = this.getMonthlyMetrics(tenantId, month);
    
    metrics.totalCost += cost;
    metrics.requestCount += 1;
    
    // Update model breakdown
    if (!metrics.modelBreakdown[details.modelId]) {
      metrics.modelBreakdown[details.modelId] = { cost: 0, requests: 0 };
    }
    metrics.modelBreakdown[details.modelId].cost += cost;
    metrics.modelBreakdown[details.modelId].requests += 1;
    
    // Update task type breakdown
    if (!metrics.taskTypeBreakdown[details.taskType]) {
      metrics.taskTypeBreakdown[details.taskType] = { cost: 0, requests: 0 };
    }
    metrics.taskTypeBreakdown[details.taskType].cost += cost;
    metrics.taskTypeBreakdown[details.taskType].requests += 1;
    
    this.monthlyMetrics.set(key, metrics);
  }

  private checkBudgetAlerts(tenantId: string): void {
    const budget = this.budgets.get(tenantId);
    if (!budget) return;

    const today = new Date().toISOString().split('T')[0]!;
    const thisMonth = today.slice(0, 7);
    
    const dailyMetrics = this.getDailyMetrics(tenantId, today);
    const monthlyMetrics = this.getMonthlyMetrics(tenantId, thisMonth);

    // Check daily threshold
    const dailyUtilization = (dailyMetrics.totalCost / budget.dailyLimit) * 100;
    if (dailyUtilization >= budget.alertThresholds.daily) {
      this.alerts.push({
        tenantId,
        type: 'daily',
        threshold: budget.alertThresholds.daily,
        currentValue: dailyUtilization,
        timestamp: new Date(),
        message: `Daily budget utilization at ${dailyUtilization.toFixed(1)}% ($${dailyMetrics.totalCost.toFixed(2)} of $${budget.dailyLimit})`
      });
    }

    // Check monthly threshold
    const monthlyUtilization = (monthlyMetrics.totalCost / budget.monthlyLimit) * 100;
    if (monthlyUtilization >= budget.alertThresholds.monthly) {
      this.alerts.push({
        tenantId,
        type: 'monthly',
        threshold: budget.alertThresholds.monthly,
        currentValue: monthlyUtilization,
        timestamp: new Date(),
        message: `Monthly budget utilization at ${monthlyUtilization.toFixed(1)}% ($${monthlyMetrics.totalCost.toFixed(2)} of $${budget.monthlyLimit})`
      });
    }

    // Limit alert history
    this.alerts = this.alerts.slice(-100);
  }

  private suggestCheaperAlternatives(modelId: string): string[] {
    const modelHierarchy: Record<string, string[]> = {
      'gpt-4-turbo': ['gpt-4o', 'gpt-3.5-turbo'],
      'gpt-4o': ['gpt-3.5-turbo'],
      'claude-3-opus': ['claude-3-sonnet', 'claude-3-haiku'],
      'claude-3-sonnet': ['claude-3-haiku', 'gpt-3.5-turbo'],
      'claude-3-haiku': ['gpt-3.5-turbo']
    };

    return modelHierarchy[modelId] || [];
  }

  private performDailyCleanup(): void {
    // Remove metrics older than 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffString = cutoffDate.toISOString().split('T')[0]!;

    for (const [key, metrics] of this.dailyMetrics.entries()) {
      if (metrics.date < cutoffString) {
        this.dailyMetrics.delete(key);
      }
    }

    // Remove alerts older than 30 days
    const alertCutoff = new Date();
    alertCutoff.setDate(alertCutoff.getDate() - 30);
    this.alerts = this.alerts.filter(alert => alert.timestamp > alertCutoff);
  }
}

export const costOptimizationService = new CostOptimizationService();