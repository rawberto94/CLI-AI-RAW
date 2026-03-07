/**
 * AI Model A/B Testing Framework
 * 
 * Enables experimentation with different:
 * - AI models (GPT-4o vs Claude vs GPT-4o-mini)
 * - Prompt variations
 * - Temperature settings
 * - Extraction strategies
 * 
 * Tracks performance metrics to identify optimal configurations.
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';
import { dbAdaptor } from '../dal/database.adaptor';

const logger = createLogger('ab-testing-framework');

// =============================================================================
// TYPES
// =============================================================================

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  
  // Variants
  controlVariant: ExperimentVariant;
  treatmentVariants: ExperimentVariant[];
  
  // Targeting
  targetPercentage: number; // 0-100, percentage of traffic
  targetTenants?: string[]; // Specific tenants to include
  excludeTenants?: string[]; // Tenants to exclude
  targetArtifactTypes?: string[]; // Specific artifact types
  
  // Metrics
  primaryMetric: MetricType;
  secondaryMetrics: MetricType[];
  
  // Results
  results?: ExperimentResults;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0-100, relative weight for traffic allocation
  config: VariantConfig;
}

export interface VariantConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplate?: string;
  useStructuredOutput?: boolean;
  enableChunking?: boolean;
  chunkSize?: number;
  customSystemPrompt?: string;
}

export type MetricType = 
  | 'quality_score'
  | 'confidence'
  | 'latency_ms'
  | 'cost'
  | 'tokens_used'
  | 'user_corrections'
  | 'field_accuracy'
  | 'extraction_completeness';

export interface ExperimentResults {
  sampleSize: number;
  startDate: Date;
  endDate?: Date;
  variantResults: Record<string, VariantResult>;
  winner?: string;
  statisticalSignificance?: number;
  recommendation: string;
}

export interface VariantResult {
  variantId: string;
  sampleSize: number;
  metrics: Record<MetricType, MetricResult>;
}

export interface MetricResult {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p95: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface ExperimentEvent {
  experimentId: string;
  variantId: string;
  contractId: string;
  artifactType: string;
  tenantId: string;
  timestamp: Date;
  metrics: Record<string, number>;
  metadata?: Record<string, any>;
}

// =============================================================================
// A/B TESTING SERVICE
// =============================================================================

export class ABTestingService {
  private static instance: ABTestingService;
  private experiments: Map<string, Experiment> = new Map();
  private events: ExperimentEvent[] = [];

  private constructor() {
    this.loadExperiments();
  }

  static getInstance(): ABTestingService {
    if (!ABTestingService.instance) {
      ABTestingService.instance = new ABTestingService();
    }
    return ABTestingService.instance;
  }

  // ===========================================================================
  // EXPERIMENT MANAGEMENT
  // ===========================================================================

  async createExperiment(experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Experiment> {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const newExperiment: Experiment = {
      ...experiment,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.experiments.set(id, newExperiment);
    await this.persistExperiment(newExperiment);

    logger.info({ experimentId: id, name: experiment.name }, 'Experiment created');
    return newExperiment;
  }

  async startExperiment(experimentId: string): Promise<boolean> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    experiment.status = 'running';
    experiment.startDate = new Date();
    experiment.updatedAt = new Date();

    await this.persistExperiment(experiment);
    logger.info({ experimentId }, 'Experiment started');
    return true;
  }

  async pauseExperiment(experimentId: string): Promise<boolean> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    experiment.status = 'paused';
    experiment.updatedAt = new Date();

    await this.persistExperiment(experiment);
    logger.info({ experimentId }, 'Experiment paused');
    return true;
  }

  async completeExperiment(experimentId: string): Promise<ExperimentResults | null> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    const results = await this.analyzeExperiment(experimentId);
    
    experiment.status = 'completed';
    experiment.endDate = new Date();
    experiment.results = results;
    experiment.updatedAt = new Date();

    await this.persistExperiment(experiment);
    logger.info({ experimentId, winner: results.winner }, 'Experiment completed');
    return results;
  }

  // ===========================================================================
  // VARIANT ASSIGNMENT
  // ===========================================================================

  /**
   * Get the variant to use for a specific request
   * Uses consistent hashing for stable assignment
   */
  async getVariant(
    contractId: string,
    artifactType: string,
    tenantId: string
  ): Promise<{ experiment: Experiment | null; variant: ExperimentVariant | null }> {
    // Find active experiments
    const activeExperiments = Array.from(this.experiments.values())
      .filter(e => e.status === 'running')
      .filter(e => !e.targetTenants?.length || e.targetTenants.includes(tenantId))
      .filter(e => !e.excludeTenants?.includes(tenantId))
      .filter(e => !e.targetArtifactTypes?.length || e.targetArtifactTypes.includes(artifactType));

    if (activeExperiments.length === 0) {
      return { experiment: null, variant: null };
    }

    // Use consistent hashing for stable assignment
    const hash = this.hashString(`${contractId}:${artifactType}`);
    const normalizedHash = (hash % 100) + 1; // 1-100

    for (const experiment of activeExperiments) {
      // Check if this request should be included in experiment
      if (normalizedHash > experiment.targetPercentage) {
        continue; // Skip this experiment for this request
      }

      // Assign to variant based on weights
      const variant = this.selectVariant(experiment, contractId);
      return { experiment, variant };
    }

    return { experiment: null, variant: null };
  }

  private selectVariant(experiment: Experiment, contractId: string): ExperimentVariant {
    const allVariants = [experiment.controlVariant, ...experiment.treatmentVariants];
    const totalWeight = allVariants.reduce((sum, v) => sum + v.weight, 0);
    
    // Use contract ID for consistent assignment
    const hash = this.hashString(contractId);
    const normalizedHash = hash % totalWeight;
    
    let cumulative = 0;
    for (const variant of allVariants) {
      cumulative += variant.weight;
      if (normalizedHash < cumulative) {
        return variant;
      }
    }
    
    return experiment.controlVariant;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ===========================================================================
  // EVENT TRACKING
  // ===========================================================================

  async recordEvent(event: Omit<ExperimentEvent, 'timestamp'>): Promise<void> {
    const fullEvent: ExperimentEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Persist event
    await cacheAdaptor.set(
      `ab-event:${event.experimentId}:${Date.now()}`,
      fullEvent,
      86400 * 30 // 30 days
    );

    logger.debug({
      experimentId: event.experimentId,
      variantId: event.variantId,
      artifactType: event.artifactType,
    }, 'Experiment event recorded');
  }

  // ===========================================================================
  // ANALYSIS
  // ===========================================================================

  async analyzeExperiment(experimentId: string): Promise<ExperimentResults> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const experimentEvents = this.events.filter(e => e.experimentId === experimentId);
    
    if (experimentEvents.length === 0) {
      return {
        sampleSize: 0,
        startDate: experiment.startDate || new Date(),
        variantResults: {},
        recommendation: 'Not enough data to make a recommendation',
      };
    }

    // Group events by variant
    const byVariant = new Map<string, ExperimentEvent[]>();
    for (const event of experimentEvents) {
      const existing = byVariant.get(event.variantId) || [];
      existing.push(event);
      byVariant.set(event.variantId, existing);
    }

    // Calculate metrics per variant
    const variantResults: Record<string, VariantResult> = {};
    const allVariants = [experiment.controlVariant, ...experiment.treatmentVariants];

    for (const variant of allVariants) {
      const events = byVariant.get(variant.id) || [];
      variantResults[variant.id] = this.calculateVariantMetrics(variant.id, events, experiment);
    }

    // Determine winner
    const { winner, significance } = this.determineWinner(
      experiment,
      variantResults
    );

    const recommendation = this.generateRecommendation(experiment, variantResults, winner);

    return {
      sampleSize: experimentEvents.length,
      startDate: experiment.startDate || new Date(),
      endDate: experiment.status === 'completed' ? experiment.endDate : undefined,
      variantResults,
      winner,
      statisticalSignificance: significance,
      recommendation,
    };
  }

  private calculateVariantMetrics(
    variantId: string,
    events: ExperimentEvent[],
    experiment: Experiment
  ): VariantResult {
    const allMetrics: MetricType[] = [experiment.primaryMetric, ...experiment.secondaryMetrics];
    const metrics: Record<MetricType, MetricResult> = {} as any;

    for (const metricType of allMetrics) {
      const values = events
        .map(e => e.metrics[metricType])
        .filter(v => v !== undefined && v !== null);

      if (values.length === 0) {
        metrics[metricType] = {
          mean: 0,
          median: 0,
          stdDev: 0,
          min: 0,
          max: 0,
          p95: 0,
          trend: 'stable',
        };
        continue;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Calculate trend over time using linear regression on recent values
      const trend = this.calculateTrend(events, metricType);

      metrics[metricType] = {
        mean,
        median,
        stdDev,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
        trend,
      };
    }

    return {
      variantId,
      sampleSize: events.length,
      metrics,
    };
  }

  /**
   * Calculate trend over time using simple linear regression
   * Compares first half vs second half averages
   */
  private calculateTrend(
    events: ExperimentEvent[],
    metricType: MetricType
  ): 'improving' | 'stable' | 'declining' {
    if (events.length < 4) {
      return 'stable'; // Not enough data points
    }

    // Sort events by timestamp
    const sortedEvents = [...events]
      .filter(e => e.metrics[metricType] !== undefined && e.metrics[metricType] !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (sortedEvents.length < 4) {
      return 'stable';
    }

    // Split into first half and second half
    const midpoint = Math.floor(sortedEvents.length / 2);
    const firstHalf = sortedEvents.slice(0, midpoint);
    const secondHalf = sortedEvents.slice(midpoint);

    // Calculate averages for each half
    const firstAvg = firstHalf.reduce((sum, e) => sum + (e.metrics[metricType] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, e) => sum + (e.metrics[metricType] || 0), 0) / secondHalf.length;

    // Determine if higher is better for this metric
    const isHigherBetter = !['latency_ms', 'cost', 'user_corrections'].includes(metricType);

    // Calculate percentage change
    const percentChange = firstAvg !== 0 ? ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100 : 0;

    // Use 5% threshold to determine significance
    const threshold = 5;

    if (Math.abs(percentChange) < threshold) {
      return 'stable';
    }

    // If higher is better: positive change = improving
    // If lower is better: negative change = improving
    if (isHigherBetter) {
      return percentChange > 0 ? 'improving' : 'declining';
    } else {
      return percentChange < 0 ? 'improving' : 'declining';
    }
  }

  private determineWinner(
    experiment: Experiment,
    variantResults: Record<string, VariantResult>
  ): { winner?: string; significance?: number } {
    const primaryMetric = experiment.primaryMetric;
    const results = Object.entries(variantResults);

    if (results.length < 2) {
      return {};
    }

    // Find best performer for primary metric
    let best: { variantId: string; value: number } | null = null;
    const isHigherBetter = !['latency_ms', 'cost', 'user_corrections'].includes(primaryMetric);

    for (const [variantId, result] of results) {
      const value = result.metrics[primaryMetric]?.mean || 0;
      
      if (!best || (isHigherBetter ? value > best.value : value < best.value)) {
        best = { variantId, value };
      }
    }

    // Simple significance estimation based on sample size
    const minSampleSize = Math.min(...results.map(([_, r]) => r.sampleSize));
    const significance = minSampleSize >= 100 ? 0.95 : minSampleSize >= 50 ? 0.8 : 0.5;

    return {
      winner: best?.variantId,
      significance,
    };
  }

  private generateRecommendation(
    experiment: Experiment,
    variantResults: Record<string, VariantResult>,
    winner?: string
  ): string {
    if (!winner) {
      return 'Collect more data before making a decision';
    }

    const allVariants = [experiment.controlVariant, ...experiment.treatmentVariants];
    const winnerVariant = allVariants.find(v => v.id === winner);
    const controlResult = variantResults[experiment.controlVariant.id];
    const winnerResult = variantResults[winner];

    if (winner === experiment.controlVariant.id) {
      return `Control variant "${experiment.controlVariant.name}" is performing best. No changes recommended.`;
    }

    const primaryMetric = experiment.primaryMetric;
    const controlValue = controlResult?.metrics[primaryMetric]?.mean || 0;
    const winnerValue = winnerResult?.metrics[primaryMetric]?.mean || 0;
    
    const improvement = controlValue !== 0 
      ? ((winnerValue - controlValue) / controlValue * 100).toFixed(1)
      : 'N/A';

    return `Treatment "${winnerVariant?.name}" outperforms control by ${improvement}% on ${primaryMetric}. ` +
      `Consider promoting to production: model=${winnerVariant?.config.model}, ` +
      `temperature=${winnerVariant?.config.temperature || 0.1}`;
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  private async loadExperiments(): Promise<void> {
    try {
      const cached = await cacheAdaptor.get<Experiment[]>('ab-experiments');
      if (cached) {
        for (const exp of cached) {
          this.experiments.set(exp.id, exp);
        }
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to load experiments from cache');
    }
  }

  private async persistExperiment(experiment: Experiment): Promise<void> {
    try {
      const all = Array.from(this.experiments.values());
      await cacheAdaptor.set('ab-experiments', all, 86400 * 365); // 1 year
    } catch (error) {
      logger.error({ error }, 'Failed to persist experiment');
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  listExperiments(status?: Experiment['status']): Experiment[] {
    const all = Array.from(this.experiments.values());
    if (status) {
      return all.filter(e => e.status === status);
    }
    return all;
  }
}

// =============================================================================
// PRESET EXPERIMENTS
// =============================================================================

export const PRESET_EXPERIMENTS = {
  MODEL_COMPARISON: {
    name: 'GPT-4o vs GPT-4o-mini',
    description: 'Compare extraction quality between GPT-4o and GPT-4o-mini',
    controlVariant: {
      id: 'control',
      name: 'GPT-4o-mini (current)',
      weight: 50,
      config: {
        model: 'gpt-4o-mini',
        temperature: 0.1,
        useStructuredOutput: true,
      },
    },
    treatmentVariants: [{
      id: 'treatment-1',
      name: 'GPT-4o',
      weight: 50,
      config: {
        model: 'gpt-4o',
        temperature: 0.1,
        useStructuredOutput: true,
      },
    }],
    primaryMetric: 'quality_score' as MetricType,
    secondaryMetrics: ['latency_ms', 'cost', 'confidence'] as MetricType[],
  },

  TEMPERATURE_EXPERIMENT: {
    name: 'Temperature Optimization',
    description: 'Find optimal temperature setting for extractions',
    controlVariant: {
      id: 'control',
      name: 'Temperature 0.1 (current)',
      weight: 34,
      config: {
        model: 'gpt-4o-mini',
        temperature: 0.1,
      },
    },
    treatmentVariants: [
      {
        id: 'treatment-1',
        name: 'Temperature 0.0',
        weight: 33,
        config: {
          model: 'gpt-4o-mini',
          temperature: 0.0,
        },
      },
      {
        id: 'treatment-2',
        name: 'Temperature 0.2',
        weight: 33,
        config: {
          model: 'gpt-4o-mini',
          temperature: 0.2,
        },
      },
    ],
    primaryMetric: 'field_accuracy' as MetricType,
    secondaryMetrics: ['quality_score', 'user_corrections'] as MetricType[],
  },

  CHUNKING_EXPERIMENT: {
    name: 'Semantic Chunking Impact',
    description: 'Measure impact of semantic chunking on long documents',
    controlVariant: {
      id: 'control',
      name: 'No chunking',
      weight: 50,
      config: {
        model: 'gpt-4o-mini',
        enableChunking: false,
      },
    },
    treatmentVariants: [{
      id: 'treatment-1',
      name: 'Semantic chunking',
      weight: 50,
      config: {
        model: 'gpt-4o-mini',
        enableChunking: true,
        chunkSize: 8000,
      },
    }],
    primaryMetric: 'extraction_completeness' as MetricType,
    secondaryMetrics: ['quality_score', 'latency_ms'] as MetricType[],
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export const abTestingService = ABTestingService.getInstance();
