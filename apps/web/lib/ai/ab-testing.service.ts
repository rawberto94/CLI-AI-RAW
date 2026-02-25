/**
 * AI Model A/B Testing Service
 * 
 * Provides infrastructure for comparing AI model performance:
 * - Concurrent model invocation
 * - Response quality metrics
 * - Latency tracking
 * - User preference collection
 * - Statistical analysis
 */

import OpenAI from 'openai';
import { prisma as _prisma } from '@/lib/prisma';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ABTestConfig {
  id: string;
  name: string;
  description?: string;
  modelA: ModelConfig;
  modelB: ModelConfig;
  trafficSplit: number; // 0-100 percentage for model A
  metrics: MetricType[];
  status: 'active' | 'paused' | 'completed';
  startDate: Date;
  endDate?: Date;
}

export interface ModelConfig {
  provider: 'openai' | 'mistral' | 'anthropic';
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export type MetricType = 
  | 'latency'
  | 'token_usage'
  | 'response_length'
  | 'user_rating'
  | 'error_rate'
  | 'relevance_score';

export interface ABTestResult {
  testId: string;
  requestId: string;
  selectedModel: 'A' | 'B';
  modelConfig: ModelConfig;
  prompt: string;
  response: string;
  metrics: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    responseLength: number;
  };
  timestamp: Date;
}

export interface ABTestAnalysis {
  testId: string;
  totalRequests: number;
  modelAStats: ModelStats;
  modelBStats: ModelStats;
  winner?: 'A' | 'B' | 'tie';
  confidence: number;
  recommendation: string;
}

export interface ModelStats {
  requestCount: number;
  avgLatencyMs: number;
  avgTokenUsage: number;
  avgResponseLength: number;
  avgUserRating: number | null;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

// ============================================================================
// In-Memory Storage (would be DB in production)
// ============================================================================

const activeTests = new Map<string, ABTestConfig>();
const testResults = new Map<string, ABTestResult[]>();
const userRatings = new Map<string, { requestId: string; rating: number; model: 'A' | 'B' }[]>();

// ============================================================================
// OpenAI Client
// ============================================================================

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = (process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, { get: (_, prop) => (getOpenAI() as any)[prop] });

// ============================================================================
// A/B Testing Service
// ============================================================================

export class AIModelABTestingService {
  /**
   * Create a new A/B test
   */
  createTest(config: Omit<ABTestConfig, 'id' | 'status' | 'startDate'>): ABTestConfig {
    const test: ABTestConfig = {
      ...config,
      id: crypto.randomUUID(),
      status: 'active',
      startDate: new Date(),
    };
    
    activeTests.set(test.id, test);
    testResults.set(test.id, []);
    userRatings.set(test.id, []);
    
    return test;
  }

  /**
   * Get active tests
   */
  getActiveTests(): ABTestConfig[] {
    return Array.from(activeTests.values()).filter(t => t.status === 'active');
  }

  /**
   * Get test by ID
   */
  getTest(testId: string): ABTestConfig | undefined {
    return activeTests.get(testId);
  }

  /**
   * Update test status
   */
  updateTestStatus(testId: string, status: ABTestConfig['status']): void {
    const test = activeTests.get(testId);
    if (test) {
      test.status = status;
      if (status === 'completed') {
        test.endDate = new Date();
      }
    }
  }

  /**
   * Execute A/B test request
   */
  async executeTest(
    testId: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<ABTestResult> {
    const test = activeTests.get(testId);
    if (!test || test.status !== 'active') {
      throw new Error('Test not found or not active');
    }

    // Determine which model to use based on traffic split
    const random = Math.random() * 100;
    const selectedModel: 'A' | 'B' = random < test.trafficSplit ? 'A' : 'B';
    const modelConfig = selectedModel === 'A' ? test.modelA : test.modelB;

    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Execute the model call
      const response = await this.callModel(modelConfig, prompt, systemPrompt);
      const latencyMs = Date.now() - startTime;

      const result: ABTestResult = {
        testId,
        requestId,
        selectedModel,
        modelConfig,
        prompt,
        response: response.content,
        metrics: {
          latencyMs,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          responseLength: response.content.length,
        },
        timestamp: new Date(),
      };

      // Store result
      const results = testResults.get(testId) || [];
      results.push(result);
      testResults.set(testId, results);

      return result;
    } catch (error) {
      // Record error as a result with error flag
      const result: ABTestResult = {
        testId,
        requestId,
        selectedModel,
        modelConfig,
        prompt,
        response: '',
        metrics: {
          latencyMs: Date.now() - startTime,
          promptTokens: 0,
          completionTokens: 0,
          responseLength: 0,
        },
        timestamp: new Date(),
      };
      
      const results = testResults.get(testId) || [];
      results.push(result);
      testResults.set(testId, results);
      
      throw error;
    }
  }

  /**
   * Execute both models and compare
   */
  async executeComparison(
    testId: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ modelA: ABTestResult; modelB: ABTestResult }> {
    const test = activeTests.get(testId);
    if (!test || test.status !== 'active') {
      throw new Error('Test not found or not active');
    }

    const requestIdBase = crypto.randomUUID();

    // Execute both models in parallel
    const [responseA, responseB] = await Promise.all([
      this.executeModelWithTracking(test.modelA, prompt, systemPrompt, testId, `${requestIdBase}-A`, 'A'),
      this.executeModelWithTracking(test.modelB, prompt, systemPrompt, testId, `${requestIdBase}-B`, 'B'),
    ]);

    return { modelA: responseA, modelB: responseB };
  }

  private async executeModelWithTracking(
    modelConfig: ModelConfig,
    prompt: string,
    systemPrompt: string | undefined,
    testId: string,
    requestId: string,
    model: 'A' | 'B'
  ): Promise<ABTestResult> {
    const startTime = Date.now();

    try {
      const response = await this.callModel(modelConfig, prompt, systemPrompt);
      const latencyMs = Date.now() - startTime;

      const result: ABTestResult = {
        testId,
        requestId,
        selectedModel: model,
        modelConfig,
        prompt,
        response: response.content,
        metrics: {
          latencyMs,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          responseLength: response.content.length,
        },
        timestamp: new Date(),
      };

      // Store result
      const results = testResults.get(testId) || [];
      results.push(result);
      testResults.set(testId, results);

      return result;
    } catch (error) {
      const result: ABTestResult = {
        testId,
        requestId,
        selectedModel: model,
        modelConfig,
        prompt,
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metrics: {
          latencyMs: Date.now() - startTime,
          promptTokens: 0,
          completionTokens: 0,
          responseLength: 0,
        },
        timestamp: new Date(),
      };

      const results = testResults.get(testId) || [];
      results.push(result);
      testResults.set(testId, results);

      return result;
    }
  }

  private async callModel(
    config: ModelConfig,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    if (config.provider === 'openai') {
      const messages: OpenAI.ChatCompletionMessageParam[] = [];
      
      if (systemPrompt || config.systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt || config.systemPrompt || '',
        });
      }
      
      messages.push({ role: 'user', content: prompt });

      const completion = await openai.chat.completions.create({
        model: config.modelId,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
      });

      return {
        content: completion.choices[0]?.message?.content || '',
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
      };
    }

    // Add Mistral support
    if (config.provider === 'mistral') {
      const { Mistral } = await import('@mistralai/mistralai');
      const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || '' });

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemPrompt || config.systemPrompt) {
        messages.push({ role: 'system' as const, content: systemPrompt || config.systemPrompt || '' });
      }
      messages.push({ role: 'user' as const, content: prompt });

      const response = await mistral.chat.complete({
        model: config.modelId,
        messages,
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 1000,
      });

      const choice = response.choices?.[0];
      return {
        content: typeof choice?.message?.content === 'string' ? choice.message.content : '',
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
      };
    }

    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  /**
   * Record user rating for a response
   */
  recordRating(testId: string, requestId: string, rating: number, model: 'A' | 'B'): void {
    const ratings = userRatings.get(testId) || [];
    ratings.push({ requestId, rating, model });
    userRatings.set(testId, ratings);
  }

  /**
   * Analyze test results
   */
  analyzeTest(testId: string): ABTestAnalysis {
    const test = activeTests.get(testId);
    if (!test) {
      throw new Error('Test not found');
    }

    const results = testResults.get(testId) || [];
    const ratings = userRatings.get(testId) || [];

    const modelAResults = results.filter(r => r.selectedModel === 'A');
    const modelBResults = results.filter(r => r.selectedModel === 'B');

    const modelAStats = this.calculateStats(modelAResults, ratings.filter(r => r.model === 'A'));
    const modelBStats = this.calculateStats(modelBResults, ratings.filter(r => r.model === 'B'));

    // Determine winner based on multiple factors
    const { winner, confidence, recommendation } = this.determineWinner(modelAStats, modelBStats, test);

    return {
      testId,
      totalRequests: results.length,
      modelAStats,
      modelBStats,
      winner,
      confidence,
      recommendation,
    };
  }

  private calculateStats(
    results: ABTestResult[],
    ratings: { rating: number }[]
  ): ModelStats {
    if (results.length === 0) {
      return {
        requestCount: 0,
        avgLatencyMs: 0,
        avgTokenUsage: 0,
        avgResponseLength: 0,
        avgUserRating: null,
        errorRate: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
      };
    }

    const latencies = results.map(r => r.metrics.latencyMs).sort((a, b) => a - b);
    const errors = results.filter(r => r.response === '' || r.response.startsWith('Error:'));

    return {
      requestCount: results.length,
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      avgTokenUsage: results.reduce((a, r) => a + r.metrics.promptTokens + r.metrics.completionTokens, 0) / results.length,
      avgResponseLength: results.reduce((a, r) => a + r.metrics.responseLength, 0) / results.length,
      avgUserRating: ratings.length > 0 
        ? ratings.reduce((a, r) => a + r.rating, 0) / ratings.length 
        : null,
      errorRate: errors.length / results.length,
      p50LatencyMs: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99LatencyMs: latencies[Math.floor(latencies.length * 0.99)] || 0,
    };
  }

  private determineWinner(
    statsA: ModelStats,
    statsB: ModelStats,
    _test: ABTestConfig
  ): { winner: 'A' | 'B' | 'tie'; confidence: number; recommendation: string } {
    let scoreA = 0;
    let scoreB = 0;

    // Latency comparison (lower is better)
    if (statsA.avgLatencyMs < statsB.avgLatencyMs * 0.9) scoreA++;
    else if (statsB.avgLatencyMs < statsA.avgLatencyMs * 0.9) scoreB++;

    // Error rate comparison (lower is better)
    if (statsA.errorRate < statsB.errorRate) scoreA++;
    else if (statsB.errorRate < statsA.errorRate) scoreB++;

    // User rating comparison (higher is better)
    if (statsA.avgUserRating !== null && statsB.avgUserRating !== null) {
      if (statsA.avgUserRating > statsB.avgUserRating + 0.2) scoreA++;
      else if (statsB.avgUserRating > statsA.avgUserRating + 0.2) scoreB++;
    }

    // Token efficiency (lower is better for same quality)
    if (statsA.avgTokenUsage < statsB.avgTokenUsage * 0.85) scoreA++;
    else if (statsB.avgTokenUsage < statsA.avgTokenUsage * 0.85) scoreB++;

    const totalSamples = statsA.requestCount + statsB.requestCount;
    const confidence = Math.min(totalSamples / 100, 1) * (Math.abs(scoreA - scoreB) / 4);

    let winner: 'A' | 'B' | 'tie' = 'tie';
    let recommendation = 'Continue testing to gather more data.';

    if (scoreA > scoreB + 1) {
      winner = 'A';
      recommendation = `Model A shows better performance. Consider increasing traffic allocation.`;
    } else if (scoreB > scoreA + 1) {
      winner = 'B';
      recommendation = `Model B shows better performance. Consider increasing traffic allocation.`;
    } else if (totalSamples >= 100) {
      recommendation = 'Models perform similarly. Consider other factors like cost.';
    }

    return { winner, confidence, recommendation };
  }

  /**
   * Get test results
   */
  getResults(testId: string): ABTestResult[] {
    return testResults.get(testId) || [];
  }

  /**
   * Delete test
   */
  deleteTest(testId: string): void {
    activeTests.delete(testId);
    testResults.delete(testId);
    userRatings.delete(testId);
  }
}

// Singleton instance
export const abTestingService = new AIModelABTestingService();

// Default export
export default abTestingService;
