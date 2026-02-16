/**
 * AI Artifact Generator Service with Robust Fallback
 * 
 * Implements a three-tier generation strategy:
 * 1. Primary: OpenAI GPT-4 analysis
 * 2. Secondary: Hybrid AI + rule-based
 * 3. Fallback: Pure rule-based extraction
 * 
 * Features:
 * - Automatic fallback on AI failure
 * - Generation method tracking
 * - Confidence scoring integration
 * - Retry logic with exponential backoff
 */

import { createLogger } from '../utils/logger';
import { confidenceScoringService } from './confidence-scoring.service';
import { artifactVersioningService } from './artifact-versioning.service';
import { artifactPromptTemplatesService } from './artifact-prompt-templates.service';
import { artifactValidationService } from './artifact-validation.service';
import { createStructuredOutputFormat, ARTIFACT_SCHEMAS } from './structured-output-schemas.service';
import {
  ContractTypeClassifier,
  validateCrossArtifactConsistency,
  aiLearningService,
  selectOptimalModel,
  type ContractClassification,
  type ConsistencyResult,
} from './advanced-ai-intelligence.service';
import {
  IntelligentPromptRouter,
} from './intelligent-prompt-router.service';
import { cacheAdaptor } from '../dal/cache.adaptor';

const logger = createLogger('ai-artifact-generator-service');

// =========================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// =========================================================================

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = this.lastFailureTime
        ? Date.now() - this.lastFailureTime.getTime()
        : Infinity;
      
      if (timeSinceLastFailure > this.resetTimeout) {
        this.state = 'half-open';
        logger.info('Circuit breaker entering half-open state');
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    if (this.lastFailureTime) {
      logger.info('Circuit breaker closed - service healthy');
      this.lastFailureTime = null;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.error(
        { failures: this.failures },
        'Circuit breaker opened - too many failures'
      );
    }
  }

  getState() {
    return { 
      state: this.state, 
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export type GenerationMethod = 'ai' | 'hybrid' | 'rule-based';
export type ArtifactType = 
  | 'OVERVIEW' | 'FINANCIAL' | 'CLAUSES' | 'RATES' | 'COMPLIANCE' | 'RISK'
  | 'OBLIGATIONS' | 'RENEWAL' | 'NEGOTIATION_POINTS' | 'AMENDMENTS' | 'CONTACTS';

export interface GenerationOptions {
  preferredMethod?: GenerationMethod;
  enableFallback?: boolean;
  maxRetries?: number;
  timeout?: number;
  userId?: string;
  previousArtifacts?: Map<ArtifactType, any>;
  enrichedContext?: any;
}

export interface GenerationResult {
  success: boolean;
  data?: any;
  method: GenerationMethod;
  confidence?: number;
  aiCertainty?: number;
  processingTime: number;
  error?: string;
  retryCount?: number;
  flaggedForReview?: boolean;
  reviewReason?: string;
  validation?: any;
  completeness?: number;
}

export interface AIResponse {
  data: any;
  certainty: number; // 0-1
  model: string;
  tokensUsed?: number;
}

// =========================================================================
// ADVANCED GENERATION TYPES (consolidated from next-gen + parallel)
// =========================================================================

export interface GeneratorConfig {
  enableContractClassification: boolean;
  enableSemanticChunking: boolean;
  enableMultiModel: boolean;
  enableCrossArtifactValidation: boolean;
  enableLearningFeedback: boolean;
  priority: 'speed' | 'accuracy' | 'cost';
  chunkMaxTokens: number;
  qualityThreshold: number;
  maxConcurrent: number;
}

const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  enableContractClassification: true,
  enableSemanticChunking: true,
  enableMultiModel: true,
  enableCrossArtifactValidation: true,
  enableLearningFeedback: true,
  priority: 'accuracy',
  chunkMaxTokens: 8000,
  qualityThreshold: 0.7,
  maxConcurrent: 3,
};

export interface AdvancedGenerationResult {
  success: boolean;
  artifact: Record<string, any> | null;
  metadata: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    cost: number;
    contractClassification?: ContractClassification;
    chunksProcessed?: number;
    qualityScore: number;
    confidence: number;
  };
  validationIssues?: string[];
  suggestions?: string[];
}

export interface BatchGenerationResult {
  artifacts: Record<string, AdvancedGenerationResult>;
  consistencyResult: ConsistencyResult | null;
  totalLatencyMs: number;
  totalCost: number;
  successRate: number;
}

export interface ParallelProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percentage: number;
  currentArtifacts: ArtifactType[];
  completedArtifacts: ArtifactType[];
  failedArtifacts: Array<{ type: ArtifactType; error: string }>;
}

export interface ParallelOptions extends GenerationOptions {
  artifactTypes?: ArtifactType[];
  maxConcurrent?: number;
  onProgress?: (progress: ParallelProgress) => void;
}

export interface ParallelGenerationResult {
  success: boolean;
  results: Map<ArtifactType, GenerationResult>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalProcessingTime: number;
    averageProcessingTime: number;
    consistencyIssues?: number;
  };
  progress: ParallelProgress;
}

// Artifact dependency graph for ordered generation
const ARTIFACT_DEPENDENCY_ORDER: Record<string, number> = {
  OVERVIEW: 0,
  FINANCIAL: 1,
  CLAUSES: 1,
  RATES: 2,
  OBLIGATIONS: 2,
  RENEWAL: 3,
  RISK: 4,
  COMPLIANCE: 4,
  CONTACTS: 5,
  AMENDMENTS: 5,
};

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

// =========================================================================
// AI ARTIFACT GENERATOR SERVICE
// =========================================================================

export class AIArtifactGeneratorService {
  private static instance: AIArtifactGeneratorService;
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2 seconds
  private readonly circuitBreaker = new CircuitBreaker();
  private readonly contractClassifications = new Map<string, ContractClassification>();

  private constructor() {
    logger.info('AI Artifact Generator Service initialized with circuit breaker');
  }

  static getInstance(): AIArtifactGeneratorService {
    if (!AIArtifactGeneratorService.instance) {
      AIArtifactGeneratorService.instance = new AIArtifactGeneratorService();
    }
    return AIArtifactGeneratorService.instance;
  }

  // =========================================================================
  // MAIN GENERATION METHOD
  // =========================================================================

  /**
   * Generate artifact with automatic fallback
   */
  async generateArtifact(
    artifactType: ArtifactType,
    contractText: string,
    contractId: string,
    tenantId: string,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const preferredMethod = options.preferredMethod || 'ai';
    const enableFallback = options.enableFallback !== false;
    const maxRetries = options.maxRetries || this.maxRetries;

    logger.info(
      {
        artifactType,
        contractId,
        preferredMethod,
        enableFallback,
      },
      'Starting artifact generation'
    );

    let result: GenerationResult;
    let retryCount = 0;

    // Try preferred method with retries
    while (retryCount <= maxRetries) {
      try {
        if (preferredMethod === 'ai') {
          result = await this.generateWithAI(artifactType, contractText, options);
        } else if (preferredMethod === 'hybrid') {
          result = await this.generateWithHybrid(artifactType, contractText, options);
        } else {
          result = await this.generateWithRules(artifactType, contractText, options);
        }

        // If successful, break retry loop
        if (result.success) {
          break;
        }

        retryCount++;
        if (retryCount <= maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount - 1);
          logger.warn(
            { retryCount, delay, error: result.error },
            'Generation failed, retrying'
          );
          await this.sleep(delay);
        }
      } catch (error) {
        logger.error({ error, retryCount }, 'Generation attempt failed');
        retryCount++;
        
        if (retryCount <= maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount - 1);
          await this.sleep(delay);
        } else {
          result = {
            success: false,
            method: preferredMethod,
            processingTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount,
          };
        }
      }
    }

    // If all retries failed and fallback is enabled, try fallback methods
    if (!result!.success && enableFallback) {
      logger.warn(
        { preferredMethod, retryCount },
        'All retries failed, attempting fallback'
      );

      if (preferredMethod === 'ai') {
        // Try hybrid
        try {
          result = await this.generateWithHybrid(artifactType, contractText, options);
          if (!result.success) {
            // Try rule-based
            result = await this.generateWithRules(artifactType, contractText, options);
          }
        } catch (fallbackError) {
          // Final fallback to rules
          result = await this.generateWithRules(artifactType, contractText, options);
        }
      } else if (preferredMethod === 'hybrid') {
        // Fallback to rule-based
        result = await this.generateWithRules(artifactType, contractText, options);
      }
    }

    // Calculate confidence score
    if (result!.success && result!.data) {
      const confidenceScore = confidenceScoringService.calculateConfidence(
        artifactType,
        result!.data,
        result!.aiCertainty,
        result!.method
      );

      result!.confidence = confidenceScore.overall;
      result!.flaggedForReview = confidenceScore.requiresReview;
      result!.reviewReason = confidenceScore.reviewReason;

      logger.info(
        {
          artifactType,
          method: result!.method,
          confidence: confidenceScore.overall,
          requiresReview: confidenceScore.requiresReview,
        },
        'Confidence score calculated'
      );
    }

    result!.processingTime = Date.now() - startTime;
    result!.retryCount = retryCount;

    logger.info(
      {
        artifactType,
        success: result!.success,
        method: result!.method,
        processingTime: result!.processingTime,
        confidence: result!.confidence,
      },
      'Artifact generation completed'
    );

    return result!;
  }

  // =========================================================================
  // GENERATION METHODS
  // =========================================================================

  /**
   * Generate using OpenAI API with circuit breaker
   */
  private async generateWithAI(
    artifactType: ArtifactType,
    contractText: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    try {
      // Check if OpenAI is available
      if (!process.env.OPENAI_API_KEY) {
        return {
          success: false,
          method: 'ai',
          processingTime: 0,
          error: 'OpenAI API key not configured',
        };
      }

      let OpenAI: any;
      try {
        // @ts-ignore - OpenAI is an optional dependency
        const openaiModule = await import('openai');
        OpenAI = openaiModule.OpenAI || openaiModule.default;
      } catch (importError) {
        return {
          success: false,
          method: 'ai',
          processingTime: 0,
          error: 'OpenAI module not installed',
        };
      }

      // Execute with circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: options.timeout || this.defaultTimeout,
        });

        // Use enhanced prompt templates with context
        const template = artifactPromptTemplatesService.getPromptTemplate(
          artifactType,
          options.enrichedContext
        );
        const { systemPrompt, userPrompt } = artifactPromptTemplatesService.buildPrompt(
          template,
          contractText
        );

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
          // Use structured output schema if available for this type,
          // otherwise fall back to basic json_object mode
          response_format: createStructuredOutputFormat(artifactType) || { type: 'json_object' as const },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }

        return JSON.parse(content);
      });

      // Extract certainty from response if available
      const aiCertainty = this.extractCertainty(result) || 0.85;

      // Validate the result
      const validation = await artifactValidationService.validateArtifact(artifactType, result);
      
      // Auto-fix if needed
      let finalData = result;
      if (!validation.valid && validation.canAutoFix) {
        const fixResult = await artifactValidationService.autoFix(result, validation.issues);
        if (fixResult.fixed) {
          finalData = fixResult.artifact;
          logger.info(
            { artifactType, changes: fixResult.changes.length },
            'Auto-fixed artifact issues'
          );
        }
      }

      return {
        success: true,
        data: finalData,
        method: 'ai',
        aiCertainty,
        processingTime: 0, // Will be set by caller
        validation,
        completeness: (validation as { completeness?: number }).completeness
      };
    } catch (error) {
      const circuitState = this.circuitBreaker.getState();
      logger.error(
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          artifactType,
          circuitBreakerState: circuitState,
        },
        'AI generation failed'
      );
      
      return {
        success: false,
        method: 'ai',
        processingTime: 0,
        error: error instanceof Error ? error.message : 'AI generation failed',
      };
    }
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    circuitBreakerState: any;
    openaiAvailable: boolean;
  }> {
    try {
      const openaiAvailable = !!process.env.OPENAI_API_KEY;
      const circuitBreakerState = this.circuitBreaker.getState();
      const healthy = openaiAvailable && circuitBreakerState.state !== 'open';

      return {
        healthy,
        circuitBreakerState,
        openaiAvailable,
      };
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return {
        healthy: false,
        circuitBreakerState: this.circuitBreaker.getState(),
        openaiAvailable: false,
      };
    }
  }

  // =========================================================================
  // ADVANCED GENERATION (consolidated from next-gen + parallel)
  // =========================================================================

  /**
   * Classify a contract's type with multi-tier caching (memory → Redis)
   */
  async classifyContract(
    contractId: string,
    contractText: string
  ): Promise<ContractClassification> {
    const cached = this.contractClassifications.get(contractId);
    if (cached) return cached;

    const redisKey = `contract-classification:${contractId}`;
    try {
      const redisCached = await cacheAdaptor.get<ContractClassification>(redisKey);
      if (redisCached) {
        this.contractClassifications.set(contractId, redisCached);
        return redisCached;
      }
    } catch { /* cache miss */ }

    const classification = ContractTypeClassifier.classify(contractText);
    this.contractClassifications.set(contractId, classification);
    try { await cacheAdaptor.set(redisKey, classification, 3600); } catch { /* ignore */ }

    return classification;
  }

  /**
   * Advanced single-artifact generation with:
   * - Contract type classification
   * - Multi-model selection (speed/accuracy/cost priority)
   * - Intelligent prompt routing
   * - Semantic chunking for long documents
   * - Quality assessment + cost tracking
   * - Falls back to basic generateArtifact() on failure
   */
  async generateAdvanced(
    contractId: string,
    contractText: string,
    artifactType: string,
    tenantId: string,
    existingArtifacts?: Record<string, any>,
    config?: Partial<GeneratorConfig>
  ): Promise<AdvancedGenerationResult> {
    const cfg = { ...DEFAULT_GENERATOR_CONFIG, ...config };
    const startTime = Date.now();

    try {
      // 1. Contract classification (cached)
      const classification = cfg.enableContractClassification
        ? await this.classifyContract(contractId, contractText)
        : undefined;

      // 2. Intelligent prompt routing
      const routedPrompt = await IntelligentPromptRouter.routePrompt(
        contractText,
        artifactType,
        tenantId,
        {
          priority: cfg.priority,
          includeChunking: cfg.enableSemanticChunking,
          maxTokens: cfg.chunkMaxTokens,
        }
      );

      // 3. Model selection based on priority
      const model = cfg.enableMultiModel
        ? selectOptimalModel(artifactType, contractText.length, cfg.priority).id
        : 'gpt-4o-mini';

      // 4. Generate — chunked for long docs, single for short
      let result: AdvancedGenerationResult;
      if (routedPrompt.chunks && routedPrompt.chunks.chunks.length > 1) {
        result = await this.generateChunked(artifactType, routedPrompt, model, existingArtifacts);
      } else {
        result = await this.generateSingleAdvanced(artifactType, routedPrompt, model, existingArtifacts);
      }

      result.metadata.contractClassification = classification;
      result.metadata.latencyMs = Date.now() - startTime;

      logger.info({
        contractId, artifactType, model,
        latencyMs: result.metadata.latencyMs,
        tokens: result.metadata.totalTokens,
        qualityScore: result.metadata.qualityScore,
        success: result.success,
      }, 'Advanced artifact generation complete');

      return result;
    } catch (error) {
      logger.warn({ error, contractId, artifactType }, 'Advanced generation failed, falling back to basic');

      // Graceful fallback to the battle-tested basic generator
      const fallback = await this.generateArtifact(
        artifactType as ArtifactType,
        contractText,
        contractId,
        tenantId
      );

      return {
        success: fallback.success,
        artifact: fallback.data || null,
        metadata: {
          model: 'gpt-4o-mini',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime,
          cost: 0,
          qualityScore: fallback.success ? 0.6 : 0,
          confidence: fallback.confidence || 0,
        },
        validationIssues: fallback.error ? [fallback.error] : undefined,
      };
    }
  }

  /**
   * Batch generation with dependency ordering and cross-artifact validation.
   * Generates artifacts sequentially in dependency order, passing context forward.
   */
  async generateBatch(
    contractId: string,
    contractText: string,
    artifactTypes: string[],
    tenantId: string,
    config?: Partial<GeneratorConfig>
  ): Promise<BatchGenerationResult> {
    const cfg = { ...DEFAULT_GENERATOR_CONFIG, ...config };
    const startTime = Date.now();
    const artifacts: Record<string, AdvancedGenerationResult> = {};
    let totalCost = 0;

    // Sort by dependency order
    const ordered = [...artifactTypes].sort(
      (a, b) => (ARTIFACT_DEPENDENCY_ORDER[a] ?? 99) - (ARTIFACT_DEPENDENCY_ORDER[b] ?? 99)
    );

    for (const type of ordered) {
      // Build context from previously completed artifacts
      const existingArtifacts: Record<string, any> = {};
      for (const [t, r] of Object.entries(artifacts)) {
        if (r.success && r.artifact) existingArtifacts[t] = r.artifact;
      }

      const result = await this.generateAdvanced(
        contractId, contractText, type, tenantId, existingArtifacts, cfg
      );

      artifacts[type] = result;
      totalCost += result.metadata.cost;
    }

    // Cross-artifact consistency validation
    let consistencyResult: ConsistencyResult | null = null;
    if (cfg.enableCrossArtifactValidation) {
      const successful: Record<string, any> = {};
      for (const [type, r] of Object.entries(artifacts)) {
        if (r.success && r.artifact) successful[type] = r.artifact;
      }
      if (Object.keys(successful).length >= 2) {
        consistencyResult = validateCrossArtifactConsistency(successful);
        if (!consistencyResult.isConsistent) {
          logger.warn({
            contractId,
            issues: consistencyResult.issues.length,
            score: consistencyResult.score,
          }, 'Cross-artifact consistency issues detected');
        }
      }
    }

    const successCount = Object.values(artifacts).filter(a => a.success).length;

    return {
      artifacts,
      consistencyResult,
      totalLatencyMs: Date.now() - startTime,
      totalCost,
      successRate: artifactTypes.length > 0 ? successCount / artifactTypes.length : 0,
    };
  }

  /**
   * Parallel generation with concurrency control, dependency ordering,
   * and progress tracking. Runs artifacts at the same dependency level
   * concurrently (up to maxConcurrent), then proceeds to the next level.
   */
  async generateParallel(
    contractId: string,
    contractText: string,
    tenantId: string,
    options: ParallelOptions = {}
  ): Promise<ParallelGenerationResult> {
    const types = options.artifactTypes || (
      ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK',
       'OBLIGATIONS', 'RENEWAL', 'NEGOTIATION_POINTS', 'AMENDMENTS', 'CONTACTS'] as ArtifactType[]
    );
    const maxConcurrent = options.maxConcurrent || DEFAULT_GENERATOR_CONFIG.maxConcurrent;
    const startTime = Date.now();

    const results = new Map<ArtifactType, GenerationResult>();
    const completedArtifacts: ArtifactType[] = [];
    const failedArtifacts: Array<{ type: ArtifactType; error: string }> = [];

    // Group by dependency level
    const levels = new Map<number, ArtifactType[]>();
    for (const type of types) {
      const level = ARTIFACT_DEPENDENCY_ORDER[type] ?? 99;
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level)!.push(type);
    }

    const sortedLevels = [...levels.entries()].sort(([a], [b]) => a - b);

    for (const [, levelTypes] of sortedLevels) {
      // Process each level with concurrency control
      const chunks: ArtifactType[][] = [];
      for (let i = 0; i < levelTypes.length; i += maxConcurrent) {
        chunks.push(levelTypes.slice(i, i + maxConcurrent));
      }

      for (const chunk of chunks) {
        // Report progress
        if (options.onProgress) {
          options.onProgress({
            total: types.length,
            completed: completedArtifacts.length,
            failed: failedArtifacts.length,
            inProgress: chunk.length,
            percentage: types.length > 0 ? Math.round((completedArtifacts.length / types.length) * 100) : 0,
            currentArtifacts: chunk,
            completedArtifacts: [...completedArtifacts],
            failedArtifacts: [...failedArtifacts],
          });
        }

        // Build context from completed artifacts at prior levels
        const enrichedContext = new Map<ArtifactType, any>();
        for (const [type, result] of results) {
          if (result.success && result.data) enrichedContext.set(type, result.data);
        }

        const settled = await Promise.allSettled(
          chunk.map(type =>
            this.generateArtifact(type, contractText, contractId, tenantId, {
              ...options,
              previousArtifacts: enrichedContext.size > 0 ? enrichedContext : undefined,
            })
          )
        );

        settled.forEach((outcome, i) => {
          const type = chunk[i];
          if (outcome.status === 'fulfilled') {
            results.set(type, outcome.value);
            if (outcome.value.success) {
              completedArtifacts.push(type);
            } else {
              failedArtifacts.push({ type, error: outcome.value.error || 'Generation failed' });
            }
          } else {
            const errorMsg = outcome.reason instanceof Error ? outcome.reason.message : 'Unknown error';
            results.set(type, {
              success: false,
              method: 'ai',
              processingTime: 0,
              error: errorMsg,
            });
            failedArtifacts.push({ type, error: errorMsg });
          }
        });
      }
    }

    const totalTime = Date.now() - startTime;
    const times = [...results.values()].map(r => r.processingTime);

    // Final progress
    if (options.onProgress) {
      options.onProgress({
        total: types.length,
        completed: completedArtifacts.length,
        failed: failedArtifacts.length,
        inProgress: 0,
        percentage: 100,
        currentArtifacts: [],
        completedArtifacts,
        failedArtifacts,
      });
    }

    return {
      success: failedArtifacts.length === 0,
      results,
      summary: {
        total: types.length,
        successful: completedArtifacts.length,
        failed: failedArtifacts.length,
        totalProcessingTime: totalTime,
        averageProcessingTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      },
      progress: {
        total: types.length,
        completed: completedArtifacts.length,
        failed: failedArtifacts.length,
        inProgress: 0,
        percentage: 100,
        currentArtifacts: [],
        completedArtifacts,
        failedArtifacts,
      },
    };
  }

  /**
   * Record user corrections for AI learning feedback loop
   */
  async recordCorrection(
    contractId: string,
    tenantId: string,
    artifactType: string,
    originalData: Record<string, any>,
    correctedData: Record<string, any>,
    userId: string
  ): Promise<void> {
    try {
      const correctedFields = this.identifyCorrectedFields(originalData, correctedData);
      await aiLearningService.recordCorrection({
        contractId,
        tenantId,
        artifactType,
        originalData,
        correctedData,
        correctionFields: correctedFields,
        userId,
        feedbackType: 'correction',
      });
      logger.info({ contractId, artifactType, fields: correctedFields.length }, 'Correction recorded for AI learning');
    } catch (error) {
      logger.warn({ error, contractId, artifactType }, 'Failed to record correction');
    }
  }

  // =========================================================================
  // ADVANCED GENERATION INTERNALS
  // =========================================================================

  private async generateSingleAdvanced(
    artifactType: string,
    routedPrompt: any,
    model: string,
    existingArtifacts?: Record<string, any>
  ): Promise<AdvancedGenerationResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    let OpenAIClient: any;
    try {
      const mod = await import('openai');
      OpenAIClient = mod.OpenAI || mod.default;
    } catch {
      throw new Error('OpenAI module not installed');
    }

    const openai = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
    const userPrompt = this.buildContextualPrompt(routedPrompt.userPrompt, existingArtifacts);

    const messages = [
      { role: 'system' as const, content: routedPrompt.systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    // Try structured output first, fallback to json_object
    const responseFormat = (ARTIFACT_SCHEMAS[artifactType])
      ? createStructuredOutputFormat(artifactType) || { type: 'json_object' as const }
      : { type: 'json_object' as const };

    const response = await openai.chat.completions.create({
      model,
      messages,
      response_format: responseFormat,
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    const artifact = JSON.parse(content);
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const cost = this.calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    return {
      success: true,
      artifact,
      metadata: {
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        latencyMs: 0, // set by caller
        cost,
        qualityScore: this.assessQuality(artifact, artifactType),
        confidence: this.extractConfidenceFromArtifact(artifact),
      },
    };
  }

  private async generateChunked(
    artifactType: string,
    routedPrompt: any,
    model: string,
    existingArtifacts?: Record<string, any>
  ): Promise<AdvancedGenerationResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    let OpenAIClient: any;
    try {
      const mod = await import('openai');
      OpenAIClient = mod.OpenAI || mod.default;
    } catch {
      throw new Error('OpenAI module not installed');
    }

    const openai = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
    const chunks = routedPrompt.chunks!;
    const chunkResults: Array<{ chunkId: string; result: Record<string, any> }> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let previousContext: Record<string, any> | undefined;

    // Process critical chunks first, fallback to all chunks
    const chunksToProcess = chunks.criticalChunks?.length >= 3
      ? chunks.criticalChunks.slice(0, 5)
      : chunks.chunks.slice(0, 7);

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      const chunkPrompt = IntelligentPromptRouter.getChunkPrompt(
        { content: chunk.content, section: chunk.section, importance: chunk.importance },
        artifactType,
        i,
        chunksToProcess.length,
        previousContext
      );

      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system' as const, content: chunkPrompt.systemPrompt },
            { role: 'user' as const, content: chunkPrompt.userPrompt },
          ],
          response_format: { type: 'json_object' as const },
          temperature: 0.1,
          max_tokens: 2048,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          chunkResults.push({ chunkId: chunk.id, result: parsed });
          previousContext = parsed;
        }

        const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
        totalPromptTokens += usage.prompt_tokens;
        totalCompletionTokens += usage.completion_tokens;
      } catch (error) {
        logger.warn({ error, chunkId: chunk.id }, 'Chunk processing failed, continuing');
      }
    }

    const mergedArtifact = IntelligentPromptRouter.mergeChunkResults(artifactType, chunkResults);
    const cost = this.calculateCost(model, totalPromptTokens, totalCompletionTokens);

    return {
      success: Object.keys(mergedArtifact).length > 0,
      artifact: mergedArtifact,
      metadata: {
        model,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        latencyMs: 0,
        cost,
        chunksProcessed: chunkResults.length,
        qualityScore: this.assessQuality(mergedArtifact, artifactType),
        confidence: this.extractConfidenceFromArtifact(mergedArtifact),
      },
    };
  }

  private buildContextualPrompt(
    basePrompt: string,
    existingArtifacts?: Record<string, any>
  ): string {
    if (!existingArtifacts || Object.keys(existingArtifacts).length === 0) {
      return basePrompt;
    }

    const contextSummary = Object.entries(existingArtifacts)
      .map(([type, artifact]) => {
        const summary: string[] = [];
        if (artifact.parties) {
          summary.push(`Parties: ${artifact.parties.map((p: any) => p.name).join(', ')}`);
        }
        if (artifact.totalValue?.value) {
          summary.push(`Total Value: $${artifact.totalValue.value.toLocaleString()}`);
        }
        if (artifact.effectiveDate?.value) {
          summary.push(`Effective: ${artifact.effectiveDate.value}`);
        }
        return `${type}: ${summary.join('; ')}`;
      })
      .join('\n');

    return `${basePrompt}\n\nCONTEXT FROM PREVIOUSLY EXTRACTED ARTIFACTS:\n${contextSummary}\n\nEnsure consistency with the above extracted information.`;
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini'];
    return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
  }

  private assessQuality(artifact: Record<string, any>, artifactType: string): number {
    if (!artifact || Object.keys(artifact).length === 0) return 0;

    let score = 0;
    let maxScore = 0;

    const requiredFields: Record<string, string[]> = {
      OVERVIEW: ['contractName', 'parties', 'effectiveDate'],
      FINANCIAL: ['totalValue', 'paymentTerms'],
      RISK: ['overallRiskScore', 'risks'],
      CLAUSES: ['clauses'],
      OBLIGATIONS: ['obligations'],
      RATES: ['rateSchedule'],
      RENEWAL: ['renewalType'],
      COMPLIANCE: ['complianceRequirements'],
      NEGOTIATION_POINTS: ['leveragePoints'],
      AMENDMENTS: ['amendments'],
      CONTACTS: ['primaryContacts'],
    };

    const fields = requiredFields[artifactType] || [];
    maxScore += fields.length * 0.3;

    for (const field of fields) {
      if (artifact[field] !== undefined && artifact[field] !== null) {
        const value = artifact[field];
        if (Array.isArray(value) && value.length > 0) score += 0.3;
        else if (typeof value === 'object' && Object.keys(value).length > 0) score += 0.3;
        else if (value) score += 0.3;
      }
    }

    // Bonus for confidence scores
    const confidenceFields = this.extractConfidenceScores(artifact);
    if (confidenceFields.length > 0) {
      score += (confidenceFields.reduce((a, b) => a + b, 0) / confidenceFields.length) * 0.2;
      maxScore += 0.2;
    }

    // Bonus for source citations
    if (JSON.stringify(artifact).includes('source')) {
      score += 0.1;
    }
    maxScore += 0.1;

    return maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  }

  private extractConfidenceFromArtifact(artifact: Record<string, any>): number {
    const scores = this.extractConfidenceScores(artifact);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
  }

  private extractConfidenceScores(obj: any, scores: number[] = []): number[] {
    if (!obj) return scores;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      if ('confidence' in obj && typeof obj.confidence === 'number') scores.push(obj.confidence);
      for (const value of Object.values(obj)) this.extractConfidenceScores(value, scores);
    } else if (Array.isArray(obj)) {
      for (const item of obj) this.extractConfidenceScores(item, scores);
    }
    return scores;
  }

  private identifyCorrectedFields(
    original: Record<string, any>,
    corrected: Record<string, any>
  ): string[] {
    const fields: string[] = [];
    const compare = (orig: any, corr: any, path: string) => {
      if (typeof orig !== typeof corr) { fields.push(path); return; }
      if (Array.isArray(orig)) {
        if (!Array.isArray(corr) || orig.length !== corr.length) fields.push(path);
        return;
      }
      if (typeof orig === 'object' && orig !== null) {
        for (const key of new Set([...Object.keys(orig || {}), ...Object.keys(corr || {})])) {
          compare(orig?.[key], corr?.[key], `${path}.${key}`);
        }
        return;
      }
      if (orig !== corr) fields.push(path);
    };
    compare(original, corrected, '');
    return fields.filter(f => f !== '');
  }

  /**
   * Generate using hybrid AI + rules approach
   */
  private async generateWithHybrid(
    artifactType: ArtifactType,
    contractText: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    try {
      // First, try AI with shorter timeout
      const aiResult = await this.generateWithAI(artifactType, contractText, {
        ...options,
        timeout: 15000, // 15 seconds
      });

      // If AI succeeds, enhance with rules
      if (aiResult.success && aiResult.data) {
        const enhancedData = this.enhanceWithRules(
          artifactType,
          aiResult.data,
          contractText
        );

        return {
          success: true,
          data: enhancedData,
          method: 'hybrid',
          aiCertainty: aiResult.aiCertainty ? aiResult.aiCertainty * 0.9 : 0.75,
          processingTime: 0,
        };
      }

      // If AI fails, use rules and try to enhance with any partial AI data
      const ruleData = this.generateWithRulesSync(artifactType, contractText);
      
      return {
        success: true,
        data: ruleData,
        method: 'hybrid',
        aiCertainty: 0.65,
        processingTime: 0,
      };
    } catch (error) {
      logger.error({ error, artifactType }, 'Hybrid generation failed');
      return {
        success: false,
        method: 'hybrid',
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Hybrid generation failed',
      };
    }
  }

  /**
   * Generate using pure rule-based extraction
   */
  private async generateWithRules(
    artifactType: ArtifactType,
    contractText: string,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    try {
      const data = this.generateWithRulesSync(artifactType, contractText);

      return {
        success: true,
        data,
        method: 'rule-based',
        aiCertainty: 0.60,
        processingTime: 0,
      };
    } catch (error) {
      logger.error({ error, artifactType }, 'Rule-based generation failed');
      return {
        success: false,
        method: 'rule-based',
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Rule-based generation failed',
      };
    }
  }

  // =========================================================================
  // RULE-BASED EXTRACTION
  // =========================================================================

  /**
   * Synchronous rule-based generation
   */
  private generateWithRulesSync(artifactType: ArtifactType, contractText: string): any {
    switch (artifactType) {
      case 'OVERVIEW':
        return this.extractOverview(contractText);
      case 'FINANCIAL':
        return this.extractFinancial(contractText);
      case 'CLAUSES':
        return this.extractClauses(contractText);
      case 'RATES':
        return this.extractRates(contractText);
      case 'COMPLIANCE':
        return this.extractCompliance(contractText);
      case 'RISK':
        return this.extractRisk(contractText);
      default:
        throw new Error(`Unknown artifact type: ${artifactType}`);
    }
  }

  /**
   * Extract overview using rules
   */
  private extractOverview(text: string): any {
    const parties = this.extractParties(text);
    const dates = this.extractDates(text);
    const contractType = this.detectContractType(text);

    return {
      summary: this.generateSummary(text),
      parties,
      contractType,
      effectiveDate: dates.effective,
      expirationDate: dates.expiration,
      jurisdiction: this.extractJurisdiction(text),
      keyTerms: this.extractKeyTerms(text),
    };
  }

  /**
   * Extract financial data using rules
   */
  private extractFinancial(text: string): any {
    const amounts = this.extractAmounts(text);
    const currency = this.detectCurrency(text);

    return {
      totalValue: amounts.total,
      currency,
      paymentTerms: this.extractPaymentTerms(text),
      costBreakdown: amounts.breakdown,
      discounts: this.extractDiscounts(text),
    };
  }

  /**
   * Extract clauses using rules
   */
  private extractClauses(text: string): any {
    const sections = this.splitIntoSections(text);
    
    return {
      clauses: sections.map((section, index) => ({
        id: `clause-${index + 1}`,
        type: this.classifyClause(section),
        title: this.extractClauseTitle(section),
        content: section,
        riskLevel: this.assessClauseRisk(section),
        importance: 'medium',
      })),
    };
  }

  /**
   * Extract rates using rules
   */
  private extractRates(text: string): any {
    const rates = this.extractRatePatterns(text);
    
    return {
      rateCards: rates,
      roles: this.extractRoles(text),
      locations: this.extractLocations(text),
    };
  }

  /**
   * Extract compliance info using rules
   */
  private extractCompliance(text: string): any {
    return {
      regulations: this.detectRegulations(text),
      complianceRequirements: this.extractComplianceRequirements(text),
      certifications: this.extractCertifications(text),
    };
  }

  /**
   * Extract risk info using rules
   */
  private extractRisk(text: string): any {
    const riskKeywords = ['liability', 'indemnif', 'penalty', 'termination', 'breach'];
    const riskScore = this.calculateRiskScore(text, riskKeywords);

    return {
      overallScore: riskScore,
      riskFactors: this.identifyRiskFactors(text),
      recommendations: this.generateRiskRecommendations(riskScore),
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private extractParties(text: string): Array<{ name: string; role: string }> {
    const parties: Array<{ name: string; role: string }> = [];
    const addParty = (name: string, role: string) => {
      const n = name.trim().replace(/[,;.]+$/, '').trim();
      if (n && n.length > 1 && !parties.some(p => p.name === n)) {
        parties.push({ name: n, role });
      }
    };
    
    // 1. "between X and Y" pattern — most common in contracts
    const betweenMatch = text.match(
      /(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(|,|\n)/i
    );
    if (betweenMatch) {
      addParty(betweenMatch[1], 'Party A');
      addParty(betweenMatch[2], 'Party B');
    }
    
    // 2. Labeled patterns: "Client: X", "Vendor: X"
    const labelPatterns: Array<{ re: RegExp; role: string }> = [
      { re: /(?:Client|Buyer|Customer|Auftraggeber|Mandant)[\s:]+([A-Z][A-Za-z\s&,.]+?)(?:\(|,|;|\n)/gi, role: 'Client' },
      { re: /(?:Supplier|Vendor|Seller|Provider|Contractor|Auftragnehmer|Lieferant)[\s:]+([A-Z][A-Za-z\s&,.]+?)(?:\(|,|;|\n)/gi, role: 'Service Provider' },
      { re: /(?:Party\s*A|First Party|Licensor|Landlord)[\s:]+([A-Z][A-Za-z\s&,.]+?)(?:\(|,|;|\n)/gi, role: 'Party A' },
      { re: /(?:Party\s*B|Second Party|Licensee|Tenant)[\s:]+([A-Z][A-Za-z\s&,.]+?)(?:\(|,|;|\n)/gi, role: 'Party B' },
    ];
    for (const { re, role } of labelPatterns) {
      const m = re.exec(text);
      if (m) addParty(m[1], role);
    }
    
    // 3. "hereinafter referred to as" pattern
    const hereinafterPattern = /([A-Z][A-Za-z0-9\s&,.]+?)\s*(?:\(|,)\s*hereinafter\s+(?:referred\s+to\s+as\s+)?["\'\u201C]?([A-Za-z\s]+?)["\'\u201D]?\s*(?:\)|,)/gi;
    let hMatch;
    while ((hMatch = hereinafterPattern.exec(text)) !== null) {
      addParty(hMatch[1], hMatch[2].trim() || 'Party');
    }

    return parties;
  }

  private extractDates(text: string): { effective?: string; expiration?: string } {
    const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g;
    const dates = text.match(datePattern) || [];

    return {
      effective: dates[0],
      expiration: dates[1],
    };
  }

  private detectContractType(text: string): string {
    const types = [
      { pattern: /service\s+agreement/i, type: 'Service Agreement' },
      { pattern: /consulting\s+agreement/i, type: 'Consulting Agreement' },
      { pattern: /employment\s+contract/i, type: 'Employment Contract' },
      { pattern: /purchase\s+order/i, type: 'Purchase Order' },
      { pattern: /master\s+service/i, type: 'Master Service Agreement' },
    ];

    for (const { pattern, type } of types) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'General Contract';
  }

  private extractJurisdiction(text: string): string | undefined {
    const jurisdictionPattern = /(?:jurisdiction|governing law)[\s:]+([A-Za-z\s,]+?)(?:\.|;|\n)/i;
    const match = jurisdictionPattern.exec(text);
    return match ? match[1].trim() : undefined;
  }

  private extractKeyTerms(text: string): string[] {
    const terms: string[] = [];
    
    // Extract numbered or bulleted items
    const listPattern = /(?:^|\n)\s*(?:\d+\.|[-•])\s*([^\n]+)/g;
    let match;
    
    while ((match = listPattern.exec(text)) !== null && terms.length < 10) {
      terms.push(match[1].trim());
    }

    return terms;
  }

  private extractAmounts(text: string): { total?: number; breakdown: any[] } {
    const amountPattern = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
    const amounts: number[] = [];
    let match;

    while ((match = amountPattern.exec(text)) !== null) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      amounts.push(amount);
    }

    return {
      total: amounts.length > 0 ? Math.max(...amounts) : undefined,
      breakdown: amounts.map((amount, index) => ({
        category: `Item ${index + 1}`,
        amount,
        description: 'Extracted from contract',
      })),
    };
  }

  private detectCurrency(text: string): string {
    if (/\$|USD|dollar/i.test(text)) return 'USD';
    if (/€|EUR|euro/i.test(text)) return 'EUR';
    if (/£|GBP|pound/i.test(text)) return 'GBP';
    if (/CHF|franc/i.test(text)) return 'CHF';
    return 'USD';
  }

  private extractPaymentTerms(text: string): string[] {
    const terms: string[] = [];
    
    if (/net\s+(\d+)/i.test(text)) {
      const match = /net\s+(\d+)/i.exec(text);
      terms.push(`Net ${match![1]} days`);
    }

    if (/monthly|quarterly|annually/i.test(text)) {
      terms.push('Recurring payments');
    }

    return terms;
  }

  private extractDiscounts(text: string): any[] {
    const discounts: any[] = [];
    const discountPattern = /(\d+)%\s+discount/gi;
    let match;

    while ((match = discountPattern.exec(text)) !== null) {
      discounts.push({
        type: 'percentage',
        value: parseInt(match[1]),
        description: match[0],
      });
    }

    return discounts;
  }

  private splitIntoSections(text: string): string[] {
    // Split by numbered sections or major headings
    const sections = text.split(/\n\s*\d+\.\s+[A-Z]/);
    return sections.filter(s => s.trim().length > 50);
  }

  private classifyClause(text: string): string {
    const classifications = [
      { pattern: /payment|invoice|fee/i, type: 'Payment' },
      { pattern: /termination|cancel/i, type: 'Termination' },
      { pattern: /liability|indemnif/i, type: 'Liability' },
      { pattern: /confidential|proprietary/i, type: 'Confidentiality' },
      { pattern: /intellectual property|ip|copyright/i, type: 'Intellectual Property' },
    ];

    for (const { pattern, type } of classifications) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'General';
  }

  private extractClauseTitle(text: string): string {
    const lines = text.split('\n');
    const firstLine = lines[0].trim();
    return firstLine.length > 0 && firstLine.length < 100 ? firstLine : 'Untitled Clause';
  }

  private assessClauseRisk(text: string): 'low' | 'medium' | 'high' {
    const highRiskKeywords = ['unlimited', 'sole discretion', 'without notice', 'penalty'];
    const mediumRiskKeywords = ['may', 'reasonable', 'subject to'];

    const lowerText = text.toLowerCase();
    
    if (highRiskKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    }
    
    if (mediumRiskKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  private extractRatePatterns(text: string): any[] {
    const rates: any[] = [];
    const ratePattern = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per|\/)\s*(hour|day|month|year)/gi;
    let match;

    while ((match = ratePattern.exec(text)) !== null) {
      rates.push({
        amount: parseFloat(match[1].replace(/,/g, '')),
        period: match[2],
        currency: 'USD',
      });
    }

    return rates;
  }

  private extractRoles(text: string): string[] {
    const roles = ['developer', 'consultant', 'engineer', 'analyst', 'manager', 'architect'];
    const found: string[] = [];

    for (const role of roles) {
      if (new RegExp(role, 'i').test(text)) {
        found.push(role);
      }
    }

    return found;
  }

  private extractLocations(text: string): string[] {
    const locationPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g;
    const locations: string[] = [];
    let match;

    while ((match = locationPattern.exec(text)) !== null && locations.length < 5) {
      locations.push(`${match[1]}, ${match[2]}`);
    }

    return locations;
  }

  private detectRegulations(text: string): string[] {
    const regulations = ['GDPR', 'HIPAA', 'SOX', 'PCI-DSS', 'ISO 27001'];
    return regulations.filter(reg => new RegExp(reg, 'i').test(text));
  }

  private extractComplianceRequirements(text: string): string[] {
    const requirements: string[] = [];
    const compliancePattern = /(?:must|shall|required to)\s+([^.;]+)/gi;
    let match;

    while ((match = compliancePattern.exec(text)) !== null && requirements.length < 5) {
      requirements.push(match[1].trim());
    }

    return requirements;
  }

  private extractCertifications(text: string): string[] {
    const certifications = ['ISO', 'SOC 2', 'PCI', 'CMMI'];
    return certifications.filter(cert => new RegExp(cert, 'i').test(text));
  }

  private calculateRiskScore(text: string, keywords: string[]): number {
    let score = 50; // Base score
    
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * 5;
      }
    }

    return Math.min(100, score);
  }

  private identifyRiskFactors(text: string): any[] {
    const factors: any[] = [];
    
    if (/unlimited\s+liability/i.test(text)) {
      factors.push({
        category: 'Financial',
        severity: 'high',
        description: 'Unlimited liability exposure',
      });
    }

    if (/without\s+notice/i.test(text)) {
      factors.push({
        category: 'Operational',
        severity: 'medium',
        description: 'Actions may be taken without notice',
      });
    }

    return factors;
  }

  private generateRiskRecommendations(riskScore: number): string[] {
    const recommendations: string[] = [];

    if (riskScore > 70) {
      recommendations.push('Consider legal review before signing');
      recommendations.push('Negotiate liability limitations');
    }

    if (riskScore > 50) {
      recommendations.push('Review termination clauses carefully');
    }

    recommendations.push('Ensure all terms are clearly understood');

    return recommendations;
  }

  private generateSummary(text: string): string {
    const firstParagraph = text.split('\n\n')[0];
    return firstParagraph.substring(0, 500) + (firstParagraph.length > 500 ? '...' : '');
  }

  private enhanceWithRules(artifactType: ArtifactType, aiData: any, contractText: string): any {
    // Enhance AI data with rule-based extraction
    const ruleData = this.generateWithRulesSync(artifactType, contractText);

    // Merge data, preferring AI data but filling gaps with rule-based data
    return this.mergeData(aiData, ruleData);
  }

  private mergeData(primary: any, fallback: any): any {
    if (!primary) return fallback;
    if (!fallback) return primary;

    const merged = { ...fallback };

    for (const key in primary) {
      if (primary[key] !== undefined && primary[key] !== null) {
        if (Array.isArray(primary[key]) && primary[key].length > 0) {
          merged[key] = primary[key];
        } else if (typeof primary[key] === 'object' && Object.keys(primary[key]).length > 0) {
          merged[key] = this.mergeData(primary[key], fallback[key]);
        } else if (primary[key]) {
          merged[key] = primary[key];
        }
      }
    }

    return merged;
  }

  private extractCertainty(data: any): number | undefined {
    // Look for certainty/confidence fields in AI response
    if (data.certainty) return data.certainty;
    if (data.confidence) return data.confidence;
    if (data.metadata?.certainty) return data.metadata.certainty;
    return undefined;
  }

  private buildPrompt(artifactType: ArtifactType, contractText: string): string {
    const prompts: Record<ArtifactType, string> = {
      OVERVIEW: `Extract overview information from this contract and return as JSON with fields: summary, parties (array of {name, role}), contractType, effectiveDate, expirationDate, jurisdiction, keyTerms (array).`,
      FINANCIAL: `Extract financial information from this contract and return as JSON with fields: totalValue, currency, paymentTerms (array), costBreakdown (array of {category, amount, description}), discounts (array).`,
      CLAUSES: `Extract and analyze clauses from this contract and return as JSON with field: clauses (array of {id, type, title, content, riskLevel, importance}).`,
      RATES: `Extract rate card information from this contract and return as JSON with fields: rateCards (array), roles (array), locations (array).`,
      COMPLIANCE: `Extract compliance information from this contract and return as JSON with fields: regulations (array), complianceRequirements (array), certifications (array).`,
      RISK: `Analyze risks in this contract and return as JSON with fields: overallScore (0-100), riskFactors (array of {category, severity, description}), recommendations (array).`,
    };

    return `${prompts[artifactType]}\n\nContract text:\n${contractText.substring(0, 10000)}`;
  }

  private getSystemPrompt(artifactType: ArtifactType): string {
    return `You are an expert contract analyst specializing in ${artifactType.toLowerCase()} analysis. Provide accurate, detailed analysis in valid JSON format. Include a certainty score (0-1) in your response to indicate confidence in the extraction.`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aiArtifactGeneratorService = AIArtifactGeneratorService.getInstance();
