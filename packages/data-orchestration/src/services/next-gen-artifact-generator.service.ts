/**
 * Next-Generation AI Artifact Generator
 * 
 * Integrates all advanced AI capabilities:
 * - Contract type classification and routing
 * - Semantic chunking for long documents
 * - Structured output with JSON schemas
 * - Multi-model orchestration
 * - AI learning from corrections
 * - Cross-artifact consistency validation
 * 
 * @version 2.0.0
 */

import OpenAI from 'openai';
import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';
import { 
  ContractTypeClassifier,
  SemanticChunker,
  validateCrossArtifactConsistency,
  aiLearningService,
  selectOptimalModel,
  type ContractClassification,
  type ChunkingResult,
  type ConsistencyResult,
} from './advanced-ai-intelligence.service';
import { 
  IntelligentPromptRouter,
  type RoutedPrompt,
} from './intelligent-prompt-router.service';
import {
  createStructuredOutputFormat,
  ARTIFACT_SCHEMAS,
} from './structured-output-schemas.service';

const logger = createLogger('next-gen-artifact-generator');

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface NextGenConfig {
  enableContractClassification: boolean;
  enableSemanticChunking: boolean;
  enableStructuredOutput: boolean;
  enableMultiModelOrchestration: boolean;
  enableLearningFeedback: boolean;
  enableCrossArtifactValidation: boolean;
  priority: 'speed' | 'accuracy' | 'cost';
  maxRetries: number;
  chunkMaxTokens: number;
  qualityThreshold: number;
  logDetailedMetrics: boolean;
}

const DEFAULT_CONFIG: NextGenConfig = {
  enableContractClassification: true,
  enableSemanticChunking: true,
  enableStructuredOutput: true,
  enableMultiModelOrchestration: true,
  enableLearningFeedback: true,
  enableCrossArtifactValidation: true,
  priority: 'accuracy',
  maxRetries: 3,
  chunkMaxTokens: 8000,
  qualityThreshold: 0.7,
  logDetailedMetrics: true,
};

// =============================================================================
// GENERATION RESULT
// =============================================================================

export interface GenerationResult<T = Record<string, any>> {
  success: boolean;
  artifact: T | null;
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
  artifacts: Record<string, GenerationResult>;
  consistencyResult: ConsistencyResult | null;
  totalLatencyMs: number;
  totalCost: number;
  successRate: number;
}

// =============================================================================
// NEXT-GEN ARTIFACT GENERATOR
// =============================================================================

export class NextGenArtifactGenerator {
  private openai: OpenAI;
  private config: NextGenConfig;
  private contractCache: Map<string, ContractClassification> = new Map();

  constructor(config: Partial<NextGenConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not set, AI generation will be disabled');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Generate a single artifact with all AI enhancements
   */
  async generateArtifact(
    contractId: string,
    contractText: string,
    artifactType: string,
    tenantId: string,
    existingArtifacts?: Record<string, any>
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      // 1. Contract classification (cached per contract)
      const classification = await this.getOrClassifyContract(contractId, contractText);
      
      // 2. Get routed prompt with all enhancements
      const routedPrompt = await IntelligentPromptRouter.routePrompt(
        contractText,
        artifactType,
        tenantId,
        {
          priority: this.config.priority,
          includeChunking: this.config.enableSemanticChunking,
          maxTokens: this.config.chunkMaxTokens,
        }
      );

      // 3. Determine model to use
      const model = this.config.enableMultiModelOrchestration
        ? selectOptimalModel(
            artifactType,
            contractText.length,
            this.config.priority
          ).id
        : routedPrompt.recommendedModel;

      // 4. Generate with structured output or chunked processing
      let result: GenerationResult;
      
      if (routedPrompt.chunks && routedPrompt.chunks.chunks.length > 1) {
        result = await this.generateWithChunks(
          artifactType,
          routedPrompt,
          model,
          existingArtifacts
        );
      } else {
        result = await this.generateSingle(
          artifactType,
          routedPrompt,
          model,
          existingArtifacts
        );
      }

      // 5. Add contract classification to metadata
      result.metadata.contractClassification = classification;
      result.metadata.latencyMs = Date.now() - startTime;

      // 6. Log metrics
      if (this.config.logDetailedMetrics) {
        logger.info({
          contractId,
          artifactType,
          model,
          latencyMs: result.metadata.latencyMs,
          tokens: result.metadata.totalTokens,
          qualityScore: result.metadata.qualityScore,
          success: result.success,
        }, 'Artifact generation complete');
      }

      return result;
    } catch (error) {
      logger.error({ error, contractId, artifactType }, 'Artifact generation failed');
      
      return {
        success: false,
        artifact: null,
        metadata: {
          model: 'none',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime,
          cost: 0,
          qualityScore: 0,
          confidence: 0,
        },
        validationIssues: [(error as Error).message],
      };
    }
  }

  /**
   * Generate multiple artifacts with cross-artifact validation
   */
  async generateBatch(
    contractId: string,
    contractText: string,
    artifactTypes: string[],
    tenantId: string
  ): Promise<BatchGenerationResult> {
    const startTime = Date.now();
    const artifacts: Record<string, GenerationResult> = {};
    let totalCost = 0;

    // Generate artifacts in dependency order
    const orderedTypes = this.orderByDependencies(artifactTypes);
    
    for (const artifactType of orderedTypes) {
      // Pass previously generated artifacts for context
      const existingArtifacts: Record<string, any> = {};
      for (const [type, result] of Object.entries(artifacts)) {
        if (result.success && result.artifact) {
          existingArtifacts[type] = result.artifact;
        }
      }

      const result = await this.generateArtifact(
        contractId,
        contractText,
        artifactType,
        tenantId,
        existingArtifacts
      );

      artifacts[artifactType] = result;
      totalCost += result.metadata.cost;
    }

    // Cross-artifact consistency validation
    let consistencyResult: ConsistencyResult | null = null;
    
    if (this.config.enableCrossArtifactValidation) {
      const successfulArtifacts: Record<string, any> = {};
      for (const [type, result] of Object.entries(artifacts)) {
        if (result.success && result.artifact) {
          successfulArtifacts[type] = result.artifact;
        }
      }
      
      if (Object.keys(successfulArtifacts).length >= 2) {
        consistencyResult = validateCrossArtifactConsistency(successfulArtifacts);
        
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
      successRate: successCount / artifactTypes.length,
    };
  }

  /**
   * Record user correction for AI learning
   */
  async recordCorrection(
    contractId: string,
    tenantId: string,
    artifactType: string,
    originalData: Record<string, any>,
    correctedData: Record<string, any>,
    userId: string
  ): Promise<void> {
    if (!this.config.enableLearningFeedback) return;

    await aiLearningService.recordCorrection({
      contractId,
      tenantId,
      artifactType,
      originalData,
      correctedData,
      correctionFields: this.identifyCorrectedFields(originalData, correctedData),
      userId,
      feedbackType: 'correction',
    });
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private async getOrClassifyContract(
    contractId: string,
    contractText: string
  ): Promise<ContractClassification> {
    if (!this.config.enableContractClassification) {
      return {
        category: 'UNKNOWN',
        subType: 'Unknown',
        confidence: 0,
        indicators: [],
        recommendedArtifacts: ['OVERVIEW', 'CLAUSES', 'RISK', 'FINANCIAL'],
        specializedPromptKey: 'UNKNOWN_PROMPT',
      };
    }

    // Check cache
    const cached = this.contractCache.get(contractId);
    if (cached) return cached;

    // Check Redis cache
    const redisKey = `contract-classification:${contractId}`;
    const redisCached = await cacheAdaptor.get<ContractClassification>(redisKey);
    if (redisCached) {
      this.contractCache.set(contractId, redisCached);
      return redisCached;
    }

    // Classify
    const classification = ContractTypeClassifier.classify(contractText);
    
    // Cache results
    this.contractCache.set(contractId, classification);
    await cacheAdaptor.set(redisKey, classification, 3600); // 1 hour

    return classification;
  }

  private async generateSingle(
    artifactType: string,
    routedPrompt: RoutedPrompt,
    model: string,
    existingArtifacts?: Record<string, any>
  ): Promise<GenerationResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: routedPrompt.systemPrompt },
      { role: 'user', content: this.buildContextualPrompt(routedPrompt.userPrompt, existingArtifacts) },
    ];

    // Try structured output first
    if (this.config.enableStructuredOutput && ARTIFACT_SCHEMAS[artifactType]) {
      try {
        return await this.generateWithStructuredOutput(artifactType, messages, model);
      } catch (error) {
        logger.warn({ error, artifactType }, 'Structured output failed, falling back to JSON mode');
      }
    }

    // Fallback to JSON mode
    return await this.generateWithJsonMode(artifactType, messages, model);
  }

  private async generateWithStructuredOutput(
    artifactType: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    model: string
  ): Promise<GenerationResult> {
    const responseFormat = createStructuredOutputFormat(artifactType);
    
    const response = await this.openai.chat.completions.create({
      model,
      messages,
      response_format: responseFormat,
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

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
        latencyMs: 0, // Set by caller
        cost,
        qualityScore: this.assessQuality(artifact, artifactType),
        confidence: this.calculateConfidence(artifact),
      },
    };
  }

  private async generateWithJsonMode(
    artifactType: string,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    model: string
  ): Promise<GenerationResult> {
    // Add JSON instruction to prompt
    const jsonMessages = [...messages];
    jsonMessages[0] = {
      role: 'system',
      content: `${(messages[0] as any).content}\n\nRespond with valid JSON only. No markdown formatting, no code blocks.`,
    };

    const response = await this.openai.chat.completions.create({
      model,
      messages: jsonMessages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

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
        latencyMs: 0,
        cost,
        qualityScore: this.assessQuality(artifact, artifactType),
        confidence: this.calculateConfidence(artifact),
      },
    };
  }

  private async generateWithChunks(
    artifactType: string,
    routedPrompt: RoutedPrompt,
    model: string,
    existingArtifacts?: Record<string, any>
  ): Promise<GenerationResult> {
    const chunks = routedPrompt.chunks!;
    const chunkResults: Array<{ chunkId: string; result: Record<string, any> }> = [];
    
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let previousContext: Record<string, any> | undefined;

    // Process critical chunks first, then others if needed
    const chunksToProcess = chunks.criticalChunks.length >= 3
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

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: chunkPrompt.systemPrompt },
        { role: 'user', content: chunkPrompt.userPrompt },
      ];

      try {
        const response = await this.openai.chat.completions.create({
          model,
          messages,
          response_format: { type: 'json_object' },
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

    // Merge results
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
        confidence: this.calculateConfidence(mergedArtifact),
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
        // Extract key info for context
        const summary: string[] = [];
        if (artifact.parties) {
          const partyNames = artifact.parties.map((p: any) => p.name).join(', ');
          summary.push(`Parties: ${partyNames}`);
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

    return `${basePrompt}

CONTEXT FROM PREVIOUSLY EXTRACTED ARTIFACTS:
${contextSummary}

Ensure consistency with the above extracted information.`;
  }

  private orderByDependencies(artifactTypes: string[]): string[] {
    const order: Record<string, number> = {
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

    return [...artifactTypes].sort((a, b) => (order[a] || 99) - (order[b] || 99));
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
    return (promptTokens / 1000) * modelPricing.input + (completionTokens / 1000) * modelPricing.output;
  }

  private assessQuality(artifact: Record<string, any>, artifactType: string): number {
    if (!artifact || Object.keys(artifact).length === 0) return 0;

    let score = 0;
    let maxScore = 0;

    // Check for required fields based on artifact type
    const requiredFields: Record<string, string[]> = {
      OVERVIEW: ['contractName', 'parties', 'effectiveDate'],
      FINANCIAL: ['totalValue', 'paymentTerms'],
      RISK: ['overallRiskScore', 'risks'],
      CLAUSES: ['clauses'],
      OBLIGATIONS: ['obligations'],
      RATES: ['rateSchedule'],
      RENEWAL: ['renewalType'],
      COMPLIANCE: ['complianceRequirements'],
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
      const avgConfidence = confidenceFields.reduce((a, b) => a + b, 0) / confidenceFields.length;
      score += avgConfidence * 0.2;
      maxScore += 0.2;
    }

    // Bonus for source citations
    const hasSources = JSON.stringify(artifact).includes('source');
    if (hasSources) {
      score += 0.1;
    }
    maxScore += 0.1;

    return maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  }

  private calculateConfidence(artifact: Record<string, any>): number {
    const scores = this.extractConfidenceScores(artifact);
    if (scores.length === 0) return 0.5;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private extractConfidenceScores(obj: any, scores: number[] = []): number[] {
    if (!obj) return scores;
    
    if (typeof obj === 'object') {
      if ('confidence' in obj && typeof obj.confidence === 'number') {
        scores.push(obj.confidence);
      }
      for (const value of Object.values(obj)) {
        this.extractConfidenceScores(value, scores);
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractConfidenceScores(item, scores);
      }
    }
    
    return scores;
  }

  private identifyCorrectedFields(
    original: Record<string, any>,
    corrected: Record<string, any>
  ): string[] {
    const fields: string[] = [];
    
    const compare = (orig: any, corr: any, path: string) => {
      if (typeof orig !== typeof corr) {
        fields.push(path);
        return;
      }
      
      if (Array.isArray(orig)) {
        if (!Array.isArray(corr) || orig.length !== corr.length) {
          fields.push(path);
        }
        return;
      }
      
      if (typeof orig === 'object' && orig !== null) {
        const allKeys = new Set([...Object.keys(orig || {}), ...Object.keys(corr || {})]);
        for (const key of allKeys) {
          compare(orig?.[key], corr?.[key], `${path}.${key}`);
        }
        return;
      }
      
      if (orig !== corr) {
        fields.push(path);
      }
    };

    compare(original, corrected, '');
    return fields.filter(f => f !== '');
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: NextGenArtifactGenerator | null = null;

export function getNextGenArtifactGenerator(config?: Partial<NextGenConfig>): NextGenArtifactGenerator {
  if (!instance || config) {
    instance = new NextGenArtifactGenerator(config);
  }
  return instance;
}

export const nextGenArtifactGenerator = getNextGenArtifactGenerator();
