/**
 * AI Model Registry Service
 * 
 * Enterprise model governance and versioning:
 * - Model registration and versioning
 * - Performance tracking per model/version
 * - A/B testing integration
 * - Rollback capabilities
 * - Model deprecation workflow
 * - Compliance and audit tracking
 * 
 * @version 1.0.0
 */

import { randomUUID } from 'crypto';

// Types
export type ModelProvider = 'openai' | 'anthropic' | 'azure' | 'google' | 'custom';
export type ModelStatus = 'active' | 'testing' | 'deprecated' | 'disabled' | 'pending_review';
export type ModelCapability = 
  | 'extraction'
  | 'summarization'
  | 'classification'
  | 'comparison'
  | 'generation'
  | 'embedding'
  | 'chat'
  | 'analysis';

export interface ModelVersion {
  version: string;
  releaseDate: Date;
  changelog: string;
  performance: ModelPerformance;
  isDefault: boolean;
  status: ModelStatus;
}

export interface RegisteredModel {
  id: string;
  tenantId?: string; // null = global
  
  // Model identity
  name: string;
  provider: ModelProvider;
  modelId: string; // e.g., 'gpt-4o', 'claude-3-opus'
  
  // Capabilities
  capabilities: ModelCapability[];
  maxTokens: number;
  contextWindow: number;
  
  // Versioning
  currentVersion: string;
  versions: ModelVersion[];
  
  // Pricing
  inputCostPer1k: number;
  outputCostPer1k: number;
  currency: string;
  
  // Configuration
  defaultTemperature: number;
  defaultMaxTokens: number;
  systemPromptTemplate?: string;
  
  // Status
  status: ModelStatus;
  
  // Audit
  registeredBy: string;
  registeredAt: Date;
  lastUpdatedAt: Date;
  lastUsedAt?: Date;
}

export interface ModelPerformance {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokensInput: number;
  avgTokensOutput: number;
  avgConfidence: number;
  userAcceptanceRate: number;
  errorRate: number;
  costPerRequest: number;
  
  // By capability
  byCapability: Record<ModelCapability, {
    requests: number;
    avgConfidence: number;
    avgLatency: number;
  }>;
  
  // Time series
  dailyStats: {
    date: Date;
    requests: number;
    successRate: number;
    avgLatency: number;
  }[];
}

export interface ModelComparison {
  modelA: { id: string; name: string; version: string };
  modelB: { id: string; name: string; version: string };
  capability: ModelCapability;
  
  results: {
    modelA: ModelPerformance;
    modelB: ModelPerformance;
  };
  
  winner: 'A' | 'B' | 'tie';
  significance: number;
  recommendation: string;
}

export interface ModelUsageQuota {
  tenantId: string;
  modelId: string;
  
  // Quotas
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  dailyCostLimit: number;
  monthlyCostLimit: number;
  
  // Current usage
  dailyRequests: number;
  monthlyRequests: number;
  dailyCost: number;
  monthlyCost: number;
  
  // Reset times
  dailyResetAt: Date;
  monthlyResetAt: Date;
}

export interface RollbackRecord {
  id: string;
  modelId: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
  performedBy: string;
  performedAt: Date;
  affectedRequests: number;
}

export interface ModelRecommendation {
  capability: ModelCapability;
  contractType?: string;
  complexity: 'simple' | 'moderate' | 'complex';
  
  recommended: {
    modelId: string;
    modelName: string;
    version: string;
    reason: string;
    expectedPerformance: {
      confidence: number;
      latency: number;
      cost: number;
    };
  };
  
  alternatives: {
    modelId: string;
    modelName: string;
    tradeoff: string;
  }[];
}

// Default models configuration
const DEFAULT_MODELS: Omit<RegisteredModel, 'id' | 'registeredAt' | 'lastUpdatedAt'>[] = [
  {
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    capabilities: ['extraction', 'summarization', 'classification', 'comparison', 'generation', 'chat', 'analysis'],
    maxTokens: 16384,
    contextWindow: 128000,
    currentVersion: '2024-05-13',
    versions: [{
      version: '2024-05-13',
      releaseDate: new Date('2024-05-13'),
      changelog: 'Initial production release',
      performance: {
        totalRequests: 0,
        successRate: 0.98,
        avgLatencyMs: 2500,
        avgTokensInput: 1500,
        avgTokensOutput: 800,
        avgConfidence: 0.92,
        userAcceptanceRate: 0.89,
        errorRate: 0.02,
        costPerRequest: 0.03,
        byCapability: {} as any,
        dailyStats: [],
      },
      isDefault: true,
      status: 'active',
    }],
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    currency: 'USD',
    defaultTemperature: 0.1,
    defaultMaxTokens: 4096,
    status: 'active',
    registeredBy: 'system',
  },
  {
    name: 'GPT-4o Mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    capabilities: ['extraction', 'summarization', 'classification', 'chat'],
    maxTokens: 16384,
    contextWindow: 128000,
    currentVersion: '2024-07-18',
    versions: [{
      version: '2024-07-18',
      releaseDate: new Date('2024-07-18'),
      changelog: 'Cost-effective model for simpler tasks',
      performance: {
        totalRequests: 0,
        successRate: 0.97,
        avgLatencyMs: 1200,
        avgTokensInput: 1200,
        avgTokensOutput: 600,
        avgConfidence: 0.85,
        userAcceptanceRate: 0.82,
        errorRate: 0.03,
        costPerRequest: 0.002,
        byCapability: {} as any,
        dailyStats: [],
      },
      isDefault: true,
      status: 'active',
    }],
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    currency: 'USD',
    defaultTemperature: 0.1,
    defaultMaxTokens: 4096,
    status: 'active',
    registeredBy: 'system',
  },
  {
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    capabilities: ['classification', 'chat'],
    maxTokens: 4096,
    contextWindow: 16385,
    currentVersion: '0125',
    versions: [{
      version: '0125',
      releaseDate: new Date('2024-01-25'),
      changelog: 'Legacy model for basic tasks',
      performance: {
        totalRequests: 0,
        successRate: 0.95,
        avgLatencyMs: 800,
        avgTokensInput: 800,
        avgTokensOutput: 400,
        avgConfidence: 0.75,
        userAcceptanceRate: 0.72,
        errorRate: 0.05,
        costPerRequest: 0.001,
        byCapability: {} as any,
        dailyStats: [],
      },
      isDefault: true,
      status: 'active',
    }],
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
    currency: 'USD',
    defaultTemperature: 0.2,
    defaultMaxTokens: 2048,
    status: 'active',
    registeredBy: 'system',
  },
  {
    name: 'Text Embedding 3 Small',
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    capabilities: ['embedding'],
    maxTokens: 8191,
    contextWindow: 8191,
    currentVersion: '1.0',
    versions: [{
      version: '1.0',
      releaseDate: new Date('2024-01-25'),
      changelog: 'Cost-effective embedding model',
      performance: {
        totalRequests: 0,
        successRate: 0.999,
        avgLatencyMs: 100,
        avgTokensInput: 500,
        avgTokensOutput: 0,
        avgConfidence: 1,
        userAcceptanceRate: 1,
        errorRate: 0.001,
        costPerRequest: 0.0001,
        byCapability: {} as any,
        dailyStats: [],
      },
      isDefault: true,
      status: 'active',
    }],
    inputCostPer1k: 0.00002,
    outputCostPer1k: 0,
    currency: 'USD',
    defaultTemperature: 0,
    defaultMaxTokens: 8191,
    status: 'active',
    registeredBy: 'system',
  },
];

class AIModelRegistryService {
  private models: Map<string, RegisteredModel> = new Map();
  private quotas: Map<string, ModelUsageQuota> = new Map();
  private rollbacks: RollbackRecord[] = [];
  private usageRecords: Map<string, { date: Date; capability: ModelCapability; latency: number; success: boolean; confidence: number }[]> = new Map();

  constructor() {
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    const now = new Date();
    for (const model of DEFAULT_MODELS) {
      const id = randomUUID();
      this.models.set(id, {
        id,
        registeredAt: now,
        lastUpdatedAt: now,
        ...model,
      });
    }
  }

  /**
   * Register a new model
   */
  registerModel(
    model: Omit<RegisteredModel, 'id' | 'registeredAt' | 'lastUpdatedAt' | 'versions'>,
    initialVersion: Omit<ModelVersion, 'performance'>
  ): RegisteredModel {
    const id = randomUUID();
    const now = new Date();

    const version: ModelVersion = {
      ...initialVersion,
      performance: this.createEmptyPerformance(),
    };

    const registered: RegisteredModel = {
      id,
      registeredAt: now,
      lastUpdatedAt: now,
      versions: [version],
      ...model,
    };

    this.models.set(id, registered);
    return registered;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): RegisteredModel | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Get model by provider model ID
   */
  getModelByProviderId(providerId: string): RegisteredModel | null {
    for (const model of this.models.values()) {
      if (model.modelId === providerId) {
        return model;
      }
    }
    return null;
  }

  /**
   * List all models
   */
  listModels(filters?: {
    provider?: ModelProvider;
    capability?: ModelCapability;
    status?: ModelStatus;
    tenantId?: string;
  }): RegisteredModel[] {
    let models = Array.from(this.models.values());

    if (filters?.provider) {
      models = models.filter(m => m.provider === filters.provider);
    }

    if (filters?.capability) {
      models = models.filter(m => m.capabilities.includes(filters.capability!));
    }

    if (filters?.status) {
      models = models.filter(m => m.status === filters.status);
    }

    if (filters?.tenantId !== undefined) {
      models = models.filter(m => 
        m.tenantId === undefined || m.tenantId === filters.tenantId
      );
    }

    return models;
  }

  /**
   * Add new model version
   */
  addVersion(
    modelId: string,
    version: Omit<ModelVersion, 'performance'>
  ): RegisteredModel | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    const newVersion: ModelVersion = {
      ...version,
      performance: this.createEmptyPerformance(),
    };

    // If this is the new default, unset previous default
    if (version.isDefault) {
      model.versions.forEach(v => v.isDefault = false);
      model.currentVersion = version.version;
    }

    model.versions.push(newVersion);
    model.lastUpdatedAt = new Date();

    return model;
  }

  /**
   * Rollback to previous version
   */
  rollbackVersion(
    modelId: string,
    targetVersion: string,
    reason: string,
    performedBy: string
  ): RollbackRecord | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    const version = model.versions.find(v => v.version === targetVersion);
    if (!version) return null;

    const rollback: RollbackRecord = {
      id: randomUUID(),
      modelId,
      fromVersion: model.currentVersion,
      toVersion: targetVersion,
      reason,
      performedBy,
      performedAt: new Date(),
      affectedRequests: 0, // Would be calculated from usage
    };

    // Update model
    model.versions.forEach(v => v.isDefault = false);
    version.isDefault = true;
    model.currentVersion = targetVersion;
    model.lastUpdatedAt = new Date();

    this.rollbacks.push(rollback);
    return rollback;
  }

  /**
   * Record model usage
   */
  recordUsage(
    modelId: string,
    capability: ModelCapability,
    metrics: {
      success: boolean;
      latencyMs: number;
      tokensInput: number;
      tokensOutput: number;
      confidence: number;
      accepted?: boolean;
    }
  ): void {
    const model = this.models.get(modelId);
    if (!model) return;

    const version = model.versions.find(v => v.version === model.currentVersion);
    if (!version) return;

    const perf = version.performance;
    const n = perf.totalRequests;

    // Update running averages
    perf.totalRequests++;
    perf.successRate = (perf.successRate * n + (metrics.success ? 1 : 0)) / (n + 1);
    perf.avgLatencyMs = (perf.avgLatencyMs * n + metrics.latencyMs) / (n + 1);
    perf.avgTokensInput = (perf.avgTokensInput * n + metrics.tokensInput) / (n + 1);
    perf.avgTokensOutput = (perf.avgTokensOutput * n + metrics.tokensOutput) / (n + 1);
    perf.avgConfidence = (perf.avgConfidence * n + metrics.confidence) / (n + 1);
    perf.errorRate = 1 - perf.successRate;

    // Calculate cost
    const cost = 
      (metrics.tokensInput / 1000) * model.inputCostPer1k +
      (metrics.tokensOutput / 1000) * model.outputCostPer1k;
    perf.costPerRequest = (perf.costPerRequest * n + cost) / (n + 1);

    // Update acceptance rate if provided
    if (metrics.accepted !== undefined) {
      const acceptedCount = perf.userAcceptanceRate * n;
      perf.userAcceptanceRate = (acceptedCount + (metrics.accepted ? 1 : 0)) / (n + 1);
    }

    // Update by capability
    if (!perf.byCapability[capability]) {
      perf.byCapability[capability] = {
        requests: 0,
        avgConfidence: 0,
        avgLatency: 0,
      };
    }
    const capPerf = perf.byCapability[capability];
    const cn = capPerf.requests;
    capPerf.requests++;
    capPerf.avgConfidence = (capPerf.avgConfidence * cn + metrics.confidence) / (cn + 1);
    capPerf.avgLatency = (capPerf.avgLatency * cn + metrics.latencyMs) / (cn + 1);

    model.lastUsedAt = new Date();

    // Store for detailed analytics
    const records = this.usageRecords.get(modelId) || [];
    records.push({
      date: new Date(),
      capability,
      latency: metrics.latencyMs,
      success: metrics.success,
      confidence: metrics.confidence,
    });
    // Keep last 1000 records
    if (records.length > 1000) {
      records.shift();
    }
    this.usageRecords.set(modelId, records);
  }

  /**
   * Get model performance
   */
  getPerformance(modelId: string, version?: string): ModelPerformance | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    const v = model.versions.find(ver => 
      version ? ver.version === version : ver.version === model.currentVersion
    );

    return v?.performance || null;
  }

  /**
   * Compare two models
   */
  compareModels(
    modelAId: string,
    modelBId: string,
    capability: ModelCapability
  ): ModelComparison | null {
    const modelA = this.models.get(modelAId);
    const modelB = this.models.get(modelBId);

    if (!modelA || !modelB) return null;

    const perfA = modelA.versions.find(v => v.version === modelA.currentVersion)?.performance;
    const perfB = modelB.versions.find(v => v.version === modelB.currentVersion)?.performance;

    if (!perfA || !perfB) return null;

    // Determine winner based on capability performance
    const capA = perfA.byCapability[capability];
    const capB = perfB.byCapability[capability];

    let winner: 'A' | 'B' | 'tie' = 'tie';
    let significance = 0;

    if (capA && capB) {
      const scoreA = capA.avgConfidence * 0.6 + (1 - capA.avgLatency / 10000) * 0.4;
      const scoreB = capB.avgConfidence * 0.6 + (1 - capB.avgLatency / 10000) * 0.4;
      
      const diff = scoreA - scoreB;
      if (Math.abs(diff) > 0.05) {
        winner = diff > 0 ? 'A' : 'B';
        significance = Math.abs(diff) * 10;
      }
    }

    return {
      modelA: { id: modelAId, name: modelA.name, version: modelA.currentVersion },
      modelB: { id: modelBId, name: modelB.name, version: modelB.currentVersion },
      capability,
      results: { modelA: perfA, modelB: perfB },
      winner,
      significance: Math.min(significance, 1),
      recommendation: winner === 'tie' 
        ? 'Both models perform similarly; choose based on cost'
        : `Model ${winner === 'A' ? modelA.name : modelB.name} is recommended for ${capability}`,
    };
  }

  /**
   * Get model recommendation
   */
  recommendModel(
    capability: ModelCapability,
    options?: {
      contractType?: string;
      complexity?: 'simple' | 'moderate' | 'complex';
      prioritize?: 'accuracy' | 'speed' | 'cost';
      tenantId?: string;
    }
  ): ModelRecommendation {
    const complexity = options?.complexity || 'moderate';
    const prioritize = options?.prioritize || 'accuracy';

    // Get models with this capability
    const candidates = this.listModels({
      capability,
      status: 'active',
      tenantId: options?.tenantId,
    });

    if (candidates.length === 0) {
      throw new Error(`No models available for capability: ${capability}`);
    }

    // Score each model
    const scored = candidates.map(model => {
      const perf = model.versions.find(v => v.version === model.currentVersion)?.performance;
      if (!perf) return { model, score: 0 };

      let score = 0;

      // Base score from performance
      score += perf.avgConfidence * 0.3;
      score += perf.successRate * 0.2;
      score += perf.userAcceptanceRate * 0.2;

      // Adjust for priorities
      if (prioritize === 'speed') {
        score += (1 - perf.avgLatencyMs / 10000) * 0.3;
      } else if (prioritize === 'cost') {
        score += (1 - perf.costPerRequest / 0.1) * 0.3;
      } else {
        score += perf.avgConfidence * 0.3;
      }

      // Adjust for complexity
      if (complexity === 'complex' && model.modelId.includes('4o') && !model.modelId.includes('mini')) {
        score += 0.1;
      } else if (complexity === 'simple' && model.modelId.includes('mini')) {
        score += 0.1;
      }

      return { model, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const recommended = scored[0];
    const alternatives = scored.slice(1, 4);

    const perf = recommended.model.versions.find(
      v => v.version === recommended.model.currentVersion
    )?.performance!;

    return {
      capability,
      contractType: options?.contractType,
      complexity,
      recommended: {
        modelId: recommended.model.id,
        modelName: recommended.model.name,
        version: recommended.model.currentVersion,
        reason: this.generateRecommendationReason(recommended.model, prioritize),
        expectedPerformance: {
          confidence: perf.avgConfidence,
          latency: perf.avgLatencyMs,
          cost: perf.costPerRequest,
        },
      },
      alternatives: alternatives.map(alt => ({
        modelId: alt.model.id,
        modelName: alt.model.name,
        tradeoff: this.generateTradeoffDescription(alt.model, recommended.model),
      })),
    };
  }

  /**
   * Update model status
   */
  updateStatus(modelId: string, status: ModelStatus): RegisteredModel | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    model.status = status;
    model.lastUpdatedAt = new Date();

    return model;
  }

  /**
   * Deprecate a model
   */
  deprecateModel(
    modelId: string,
    replacementModelId?: string
  ): { deprecated: RegisteredModel; replacement?: RegisteredModel } | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    model.status = 'deprecated';
    model.lastUpdatedAt = new Date();

    let replacement: RegisteredModel | undefined;
    if (replacementModelId) {
      replacement = this.models.get(replacementModelId) || undefined;
    }

    return { deprecated: model, replacement };
  }

  /**
   * Get rollback history
   */
  getRollbackHistory(modelId?: string): RollbackRecord[] {
    if (modelId) {
      return this.rollbacks.filter(r => r.modelId === modelId);
    }
    return [...this.rollbacks];
  }

  // Private helpers

  private createEmptyPerformance(): ModelPerformance {
    return {
      totalRequests: 0,
      successRate: 0,
      avgLatencyMs: 0,
      avgTokensInput: 0,
      avgTokensOutput: 0,
      avgConfidence: 0,
      userAcceptanceRate: 0,
      errorRate: 0,
      costPerRequest: 0,
      byCapability: {} as Record<ModelCapability, any>,
      dailyStats: [],
    };
  }

  private generateRecommendationReason(model: RegisteredModel, priority: string): string {
    const perf = model.versions.find(v => v.version === model.currentVersion)?.performance;
    if (!perf) return 'Best available model';

    if (priority === 'accuracy') {
      return `Highest accuracy with ${(perf.avgConfidence * 100).toFixed(1)}% confidence`;
    } else if (priority === 'speed') {
      return `Fastest response time at ${perf.avgLatencyMs.toFixed(0)}ms average`;
    } else {
      return `Most cost-effective at $${perf.costPerRequest.toFixed(4)} per request`;
    }
  }

  private generateTradeoffDescription(alt: RegisteredModel, recommended: RegisteredModel): string {
    const altPerf = alt.versions.find(v => v.version === alt.currentVersion)?.performance;
    const recPerf = recommended.versions.find(v => v.version === recommended.currentVersion)?.performance;

    if (!altPerf || !recPerf) return 'Alternative option';

    if (altPerf.avgLatencyMs < recPerf.avgLatencyMs * 0.7) {
      return 'Faster but potentially lower accuracy';
    }
    if (altPerf.costPerRequest < recPerf.costPerRequest * 0.5) {
      return 'Lower cost but may have reduced capabilities';
    }
    if (altPerf.avgConfidence > recPerf.avgConfidence) {
      return 'Higher accuracy but slower or more expensive';
    }

    return 'Alternative option with different tradeoffs';
  }
}

// Export singleton
export const aiModelRegistryService = new AIModelRegistryService();
export { AIModelRegistryService };
