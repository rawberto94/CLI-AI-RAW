import pino from 'pino';
import clientsDb from 'clients-db';

// Optional AI SDK imports - these may not be installed in all environments
let generateText: any;
let openai: any;

try {
  generateText = require('ai').generateText;
} catch {
  // ai SDK not available
}

try {
  openai = require('@ai-sdk/openai').openai;
} catch {
  // @ai-sdk/openai not available
}

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

const logger = pino({ name: 'ab-testing-engine' });

/**
 * Test variant configuration
 */
export interface TestVariant {
  id: string;
  name: string;
  modelName: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  cost: number; // Cost per 1K tokens
}

export interface TestResult {
  variantId: string;
  artifactType: string;
  artifactData: Record<string, any>;
  qualityScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  confidence: number;
  generationTime: number;
  tokenCount: number;
  cost: number;
  userAccepted: boolean | null; // null = not yet rated
  timestamp: Date;
}

export interface VariantPerformance {
  variantId: string;
  variantName: string;
  totalTests: number;
  avgQualityScore: number;
  avgCompleteness: number;
  avgAccuracy: number;
  avgCost: number;
  avgTime: number;
  acceptanceRate: number;
  winRate: number; // Fraction where this variant won head-to-head
  confidence: number; // Statistical confidence (0-1)
}

export interface ABTestConfig {
  testName: string;
  artifactType: string;
  variants: TestVariant[];
  enabled: boolean;
  minSampleSize: number;
  significanceLevel: number; // e.g., 0.05 for 95% confidence
}

/**
 * A/B Testing Engine for Prompt and Model Optimization
 */
export class ABTestingEngine {
  private tests: Map<string, ABTestConfig> = new Map();

  constructor() {
    this.initializeTests();
  }

  /**
   * Initialize test configurations
   */
  private initializeTests(): void {
    // Example: Test different models for OVERVIEW artifact
    this.tests.set('overview-model-test', {
      testName: 'overview-model-test',
      artifactType: 'OVERVIEW',
      variants: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          modelName: 'gpt-4o',
          cost: 0.005,
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          modelName: 'gpt-4o-mini',
          cost: 0.001,
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          modelName: 'gpt-3.5-turbo',
          cost: 0.0005,
        },
      ],
      enabled: true,
      minSampleSize: 20,
      significanceLevel: 0.05,
    });

    // Example: Test different prompts for RISK artifact
    this.tests.set('risk-prompt-test', {
      testName: 'risk-prompt-test',
      artifactType: 'RISK',
      variants: [
        {
          id: 'detailed',
          name: 'Detailed Analysis',
          modelName: 'gpt-4o-mini',
          systemPrompt: 'You are a risk analysis expert. Provide detailed risk assessments with quantified probabilities.',
          cost: 0.001,
        },
        {
          id: 'concise',
          name: 'Concise Analysis',
          modelName: 'gpt-4o-mini',
          systemPrompt: 'You are a risk analyst. Provide concise, actionable risk assessments.',
          cost: 0.001,
        },
        {
          id: 'structured',
          name: 'Structured Analysis',
          modelName: 'gpt-4o-mini',
          systemPrompt: 'You are a risk expert. Use a structured framework (PESTLE/SWOT) for risk analysis.',
          cost: 0.001,
        },
      ],
      enabled: true,
      minSampleSize: 15,
      significanceLevel: 0.05,
    });
  }

  /**
   * Select variant for this generation
   * Uses epsilon-greedy strategy: 20% random, 80% best performer
   */
  async selectVariant(artifactType: string): Promise<TestVariant | null> {
    const testConfig = this.getTestForArtifact(artifactType);
    if (!testConfig || !testConfig.enabled) {
      return null;
    }

    // Get performance stats
    const performances = await this.getVariantPerformances(testConfig.testName);

    // Epsilon-greedy: 20% explore, 80% exploit
    const epsilon = 0.2;
    const shouldExplore = Math.random() < epsilon;

    if (shouldExplore || performances.length === 0) {
      // Random selection
      const randomIndex = Math.floor(Math.random() * testConfig.variants.length);
      return testConfig.variants[randomIndex] ?? null;
    } else {
      // Select best performer
      const bestPerformer = performances.reduce((best, current) => {
        const currentScore = current.avgQualityScore * (1 - current.avgCost / 0.01); // Balance quality vs cost
        const bestScore = best.avgQualityScore * (1 - best.avgCost / 0.01);
        return currentScore > bestScore ? current : best;
      });

      const variant = testConfig.variants.find(v => v.id === bestPerformer.variantId);
      return variant ?? testConfig.variants[0] ?? null;
    }
  }

  /**
   * Record test result
   */
  async recordResult(
    testName: string,
    result: TestResult,
    tenantId: string
  ): Promise<void> {
    logger.info({
      testName,
      variantId: result.variantId,
      qualityScore: result.qualityScore.toFixed(2),
      cost: result.cost.toFixed(4),
    }, '📊 Recording A/B test result');

    await this.storeTestResult(testName, result, tenantId);

    // Check if we have enough data to determine a winner
    const performances = await this.getVariantPerformances(testName);
    if (performances.length > 0 && performances.every(p => p.totalTests >= 20)) {
      await this.analyzeTestResults(testName, performances);
    }
  }

  /**
   * Analyze test results and determine winner
   */
  private async analyzeTestResults(
    testName: string,
    performances: VariantPerformance[]
  ): Promise<void> {
    if (performances.length < 2) return;

    // Sort by quality score
    const sorted = [...performances].sort((a, b) => b.avgQualityScore - a.avgQualityScore);
    const winner = sorted[0];
    const runnerUp = sorted[1];

    // Ensure we have valid winner and runnerUp
    if (!winner || !runnerUp) return;

    // Calculate statistical significance using t-test approximation
    const tStatistic = this.calculateTStatistic(winner, runnerUp);
    const isSignificant = Math.abs(tStatistic) > 1.96; // 95% confidence

    if (isSignificant) {
      logger.info({
        testName,
        winner: winner.variantName,
        winnerScore: winner.avgQualityScore.toFixed(2),
        runnerUp: runnerUp.variantName,
        runnerUpScore: runnerUp.avgQualityScore.toFixed(2),
        tStatistic: tStatistic.toFixed(2),
      }, '🏆 A/B test winner determined with statistical significance');

      // Store winner
      await this.storeTestWinner(testName, winner.variantId, tStatistic);
    } else {
      logger.info({
        testName,
        leader: winner.variantName,
        leaderScore: winner.avgQualityScore.toFixed(2),
        tStatistic: tStatistic.toFixed(2),
      }, '⚠️ A/B test leader, but not statistically significant yet');
    }
  }

  /**
   * Calculate t-statistic for comparing two variants
   */
  private calculateTStatistic(
    variant1: VariantPerformance,
    variant2: VariantPerformance
  ): number {
    const mean1 = variant1.avgQualityScore;
    const mean2 = variant2.avgQualityScore;
    const n1 = variant1.totalTests;
    const n2 = variant2.totalTests;

    // Estimate standard deviations (assuming ~15% variance)
    const std1 = mean1 * 0.15;
    const std2 = mean2 * 0.15;

    // Pooled standard error
    const se = Math.sqrt((std1 ** 2 / n1) + (std2 ** 2 / n2));

    if (se === 0) return 0;

    return (mean1 - mean2) / se;
  }

  /**
   * Get test configuration for artifact type
   */
  private getTestForArtifact(artifactType: string): ABTestConfig | null {
    for (const test of this.tests.values()) {
      if (test.artifactType === artifactType && test.enabled) {
        return test;
      }
    }
    return null;
  }

  /**
   * Get variant performances
   */
  private async getVariantPerformances(testName: string): Promise<VariantPerformance[]> {
    try {
      const results = await prisma.$queryRaw<any[]>`
        SELECT
          variant_id,
          variant_name,
          COUNT(*) as total_tests,
          AVG(quality_score) as avg_quality_score,
          AVG(completeness) as avg_completeness,
          AVG(accuracy) as avg_accuracy,
          AVG(cost) as avg_cost,
          AVG(generation_time) as avg_time,
          SUM(CASE WHEN user_accepted = true THEN 1 ELSE 0 END)::float / 
            NULLIF(SUM(CASE WHEN user_accepted IS NOT NULL THEN 1 ELSE 0 END), 0) as acceptance_rate
        FROM ab_test_results
        WHERE test_name = ${testName}
          AND timestamp > NOW() - INTERVAL '30 days'
        GROUP BY variant_id, variant_name
      `;

      // Calculate win rates from head-to-head comparisons
      const winRates = await this.calculateWinRates(testName, results.map((r: Record<string, unknown>) => String(r.variant_id)));

      return results.map((r: Record<string, unknown>) => ({
        variantId: String(r.variant_id),
        variantName: String(r.variant_name),
        totalTests: Number(r.total_tests),
        avgQualityScore: Number(r.avg_quality_score),
        avgCompleteness: Number(r.avg_completeness),
        avgAccuracy: Number(r.avg_accuracy),
        avgCost: Number(r.avg_cost),
        avgTime: Number(r.avg_time),
        acceptanceRate: Number(r.acceptance_rate) || 0,
        winRate: winRates.get(String(r.variant_id)) || 0,
        confidence: this.calculateConfidence(Number(r.total_tests)),
      }));
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get variant performances');
      return [];
    }
  }

  /**
   * Calculate win rates from head-to-head quality score comparisons
   * A variant "wins" if it has a higher quality score on the same artifact type
   */
  private async calculateWinRates(testName: string, variantIds: string[]): Promise<Map<string, number>> {
    const winRates = new Map<string, number>();

    if (variantIds.length < 2) {
      return winRates;
    }

    try {
      // Get aggregated quality scores per variant for head-to-head comparison
      const variantScores = await prisma.$queryRaw<any[]>`
        SELECT
          variant_id,
          AVG(quality_score) as avg_score,
          COUNT(*) as sample_count
        FROM ab_test_results
        WHERE test_name = ${testName}
          AND timestamp > NOW() - INTERVAL '30 days'
        GROUP BY variant_id
        HAVING COUNT(*) >= 5
      `;

      if (variantScores.length < 2) {
        // Not enough data for head-to-head comparisons
        variantIds.forEach(id => winRates.set(id, 0));
        return winRates;
      }

      // Compare each variant against all others
      const totalComparisons = variantScores.length - 1;
      
      for (const variant of variantScores) {
        const variantId = String(variant.variant_id);
        const variantScore = Number(variant.avg_score);
        
        let wins = 0;
        for (const other of variantScores) {
          if (String(other.variant_id) !== variantId) {
            if (variantScore > Number(other.avg_score)) {
              wins++;
            }
          }
        }

        // Win rate = wins / total possible comparisons
        winRates.set(variantId, totalComparisons > 0 ? wins / totalComparisons : 0);
      }

      // Set 0 for any variant IDs that weren't in the query results
      for (const id of variantIds) {
        if (!winRates.has(id)) {
          winRates.set(id, 0);
        }
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to calculate win rates');
      variantIds.forEach(id => winRates.set(id, 0));
    }

    return winRates;
  }

  /**
   * Calculate confidence based on sample size
   */
  private calculateConfidence(sampleSize: number): number {
    // Simple confidence calculation based on sample size
    // More samples = higher confidence
    if (sampleSize >= 50) return 0.95;
    if (sampleSize >= 30) return 0.85;
    if (sampleSize >= 20) return 0.75;
    if (sampleSize >= 10) return 0.60;
    return 0.40;
  }

  /**
   * Store test result
   */
  private async storeTestResult(
    testName: string,
    result: TestResult,
    tenantId: string
  ): Promise<void> {
    try {
      const variant = this.getVariantById(testName, result.variantId);
      if (!variant) return;

      await prisma.$executeRaw`
        INSERT INTO ab_test_results (
          test_name,
          tenant_id,
          variant_id,
          variant_name,
          artifact_type,
          artifact_data,
          quality_score,
          completeness,
          accuracy,
          consistency,
          confidence,
          generation_time,
          token_count,
          cost,
          user_accepted,
          timestamp
        ) VALUES (
          ${testName},
          ${tenantId},
          ${result.variantId},
          ${variant.name},
          ${result.artifactType},
          ${JSON.stringify(result.artifactData)}::jsonb,
          ${result.qualityScore},
          ${result.completeness},
          ${result.accuracy},
          ${result.consistency},
          ${result.confidence},
          ${result.generationTime},
          ${result.tokenCount},
          ${result.cost},
          ${result.userAccepted},
          ${result.timestamp}
        )
      `;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to store test result');
    }
  }

  /**
   * Store test winner
   */
  private async storeTestWinner(
    testName: string,
    winnerVariantId: string,
    tStatistic: number
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO ab_test_winners (
          test_name,
          winner_variant_id,
          t_statistic,
          determined_at
        ) VALUES (
          ${testName},
          ${winnerVariantId},
          ${tStatistic},
          ${new Date()}
        )
        ON CONFLICT (test_name)
        DO UPDATE SET
          winner_variant_id = ${winnerVariantId},
          t_statistic = ${tStatistic},
          determined_at = ${new Date()}
      `;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to store test winner');
    }
  }

  /**
   * Get variant by ID
   */
  private getVariantById(testName: string, variantId: string): TestVariant | null {
    const test = this.tests.get(testName);
    if (!test) return null;

    return test.variants.find(v => v.id === variantId) || null;
  }

  /**
   * Get current winner for a test
   */
  async getCurrentWinner(testName: string): Promise<TestVariant | null> {
    try {
      const result = await prisma.$queryRaw<any[]>`
        SELECT winner_variant_id
        FROM ab_test_winners
        WHERE test_name = ${testName}
        ORDER BY determined_at DESC
        LIMIT 1
      `;

      if (result.length > 0) {
        return this.getVariantById(testName, result[0].winner_variant_id);
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get current winner');
    }

    return null;
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTestConfig[] {
    return Array.from(this.tests.values()).filter(t => t.enabled);
  }
}

/**
 * Get singleton testing engine instance
 */
let engineInstance: ABTestingEngine | null = null;

export function getABTestingEngine(): ABTestingEngine {
  if (!engineInstance) {
    engineInstance = new ABTestingEngine();
  }
  return engineInstance;
}
