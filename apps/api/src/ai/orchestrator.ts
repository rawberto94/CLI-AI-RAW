/**
 * AI Orchestration Enhancement System
 * Multi-model LLM coordination with cost optimization and intelligent routing
 */

import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors';

// Model configuration and pricing
interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'azure';
  model: string;
  maxTokens: number;
  costPer1kTokens: number; // USD
  reliability: number; // 0-1 score
  speed: number; // requests/minute
  capabilities: string[];
  fallbackOrder: number;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-1106-preview',
    maxTokens: 128000,
    costPer1kTokens: 0.01,
    reliability: 0.95,
    speed: 60,
    capabilities: ['analysis', 'reasoning', 'complex-tasks'],
    fallbackOrder: 1
  },
  'gpt-4o': {
    provider: 'openai', 
    model: 'gpt-4o',
    maxTokens: 128000,
    costPer1kTokens: 0.005,
    reliability: 0.98,
    speed: 90,
    capabilities: ['analysis', 'reasoning', 'complex-tasks', 'vision'],
    fallbackOrder: 2
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 16000,
    costPer1kTokens: 0.001,
    reliability: 0.92,
    speed: 150,
    capabilities: ['simple-analysis', 'classification'],
    fallbackOrder: 3
  },
  'claude-3-opus': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    maxTokens: 200000,
    costPer1kTokens: 0.015,
    reliability: 0.96,
    speed: 40,
    capabilities: ['analysis', 'reasoning', 'long-documents'],
    fallbackOrder: 4
  },
  'claude-3-sonnet': {
    provider: 'anthropic', 
    model: 'claude-3-sonnet-20240229',
    maxTokens: 200000,
    costPer1kTokens: 0.003,
    reliability: 0.94,
    speed: 80,
    capabilities: ['analysis', 'reasoning', 'long-documents'],
    fallbackOrder: 5
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    maxTokens: 200000,
    costPer1kTokens: 0.00025,
    reliability: 0.90,
    speed: 120,
    capabilities: ['simple-analysis', 'classification', 'fast-response'],
    fallbackOrder: 6
  }
};

// Task complexity levels
type TaskComplexity = 'simple' | 'medium' | 'complex';

interface AnalysisRequest {
  content: string;
  taskType: 'risk-analysis' | 'compliance-check' | 'clause-extraction' | 'summary' | 'classification';
  complexity: TaskComplexity;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  maxCost?: number; // USD limit
  timeoutMs?: number;
  tenantId: string;
  requiresStructuredOutput?: boolean;
}

interface AnalysisResponse {
  result: any;
  modelUsed: string;
  cost: number;
  processingTime: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  confidence: number;
  cacheHit?: boolean;
}

interface ModelMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalCost: number;
  averageLatency: number;
  lastUpdated: Date;
}

export class AIOrchestrator {
  private openaiClient: OpenAI;
  private anthropicClient: Anthropic;
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private responseCache: Map<string, { response: AnalysisResponse; expiry: Date }> = new Map();
  private rateLimiters: Map<string, { requests: number; resetTime: Date }> = new Map();

  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
      timeout: 60000
    });

    this.anthropicClient = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
      timeout: 60000
    });

    // Initialize metrics for all models
    Object.keys(MODEL_CONFIGS).forEach(modelId => {
      this.modelMetrics.set(modelId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalCost: 0,
        averageLatency: 0,
        lastUpdated: new Date()
      });
    });

    // Start cleanup interval
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Main orchestration method - intelligently routes requests to optimal models
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiry > new Date()) {
      return { ...cached.response, cacheHit: true };
    }

    // Select optimal model based on request characteristics
    const selectedModels = this.selectOptimalModels(request);
    
    let lastError: Error | null = null;
    
    // Try models in order of preference
    for (const modelId of selectedModels) {
      try {
        // Check rate limits
        if (!this.checkRateLimit(modelId)) {
          continue;
        }

        const response = await this.executeAnalysis(request, modelId, startTime);
        
        // Cache successful response
        this.cacheResponse(cacheKey, response);
        
        // Update metrics
        this.updateMetrics(modelId, true, response.cost, response.processingTime);
        
        return response;

      } catch (error) {
        lastError = error as Error;
        this.updateMetrics(modelId, false, 0, Date.now() - startTime);
        
        console.warn(`Model ${modelId} failed:`, error);
        continue; // Try next model
      }
    }

    // All models failed
    throw new AppError(503, `All AI models failed. Last error: ${lastError?.message}`, false, {
      modelsAttempted: selectedModels,
      originalError: lastError?.message
    });
  }

  /**
   * Select optimal models based on request characteristics
   */
  private selectOptimalModels(request: AnalysisRequest): string[] {
    const availableModels = Object.entries(MODEL_CONFIGS)
      .filter(([_, config]) => this.isModelSuitable(config, request))
      .sort(([aId, aConfig], [bId, bConfig]) => {
        // Primary sort: cost efficiency for the task
        const aCostScore = this.calculateCostScore(aConfig, request);
        const bCostScore = this.calculateCostScore(bConfig, request);
        
        if (Math.abs(aCostScore - bCostScore) > 0.1) {
          return aCostScore - bCostScore; // Lower cost is better
        }
        
        // Secondary sort: reliability and current performance
        const aMetrics = this.modelMetrics.get(aId);
        const bMetrics = this.modelMetrics.get(bId);
        
        const aReliability = (aMetrics?.successfulRequests ?? 0) > 0 
          ? ((aMetrics?.successfulRequests ?? 0) / (aMetrics?.totalRequests ?? 1)) * aConfig.reliability
          : aConfig.reliability;
          
        const bReliability = (bMetrics?.successfulRequests ?? 0) > 0
          ? ((bMetrics?.successfulRequests ?? 0) / (bMetrics?.totalRequests ?? 1)) * bConfig.reliability  
          : bConfig.reliability;
          
        return bReliability - aReliability; // Higher reliability is better
      })
      .map(([modelId]) => modelId);

    return availableModels.slice(0, 3); // Try up to 3 models
  }

  /**
   * Check if model is suitable for the request
   */
  private isModelSuitable(config: ModelConfig, request: AnalysisRequest): boolean {
    // Check capabilities
    const requiredCapabilities = this.getRequiredCapabilities(request);
    const hasCapabilities = requiredCapabilities.every(cap => 
      config.capabilities.includes(cap)
    );
    
    if (!hasCapabilities) return false;

    // Check cost constraints
    if (request.maxCost) {
      const estimatedTokens = Math.min(request.content.length / 3, config.maxTokens);
      const estimatedCost = (estimatedTokens / 1000) * config.costPer1kTokens;
      if (estimatedCost > request.maxCost) return false;
    }

    // Check token limits
    const estimatedTokens = request.content.length / 3; // Rough estimate
    if (estimatedTokens > config.maxTokens * 0.8) return false; // Leave headroom

    return true;
  }

  /**
   * Calculate cost efficiency score for model selection
   */
  private calculateCostScore(config: ModelConfig, request: AnalysisRequest): number {
    const baseScore = config.costPer1kTokens;
    
    // Adjust based on priority
    const priorityMultiplier = {
      'low': 1.0,
      'medium': 0.8,
      'high': 0.6,
      'urgent': 0.4
    }[request.priority];
    
    // Adjust based on complexity
    const complexityMultiplier = {
      'simple': 1.2,
      'medium': 1.0,
      'complex': 0.8
    }[request.complexity];
    
    return baseScore * priorityMultiplier * complexityMultiplier;
  }

  /**
   * Get required capabilities based on request type
   */
  private getRequiredCapabilities(request: AnalysisRequest): string[] {
    const capabilityMap = {
      'risk-analysis': ['analysis', 'reasoning'],
      'compliance-check': ['analysis', 'reasoning'],
      'clause-extraction': ['analysis'],
      'summary': ['simple-analysis'],
      'classification': ['simple-analysis', 'classification']
    };

    let capabilities = capabilityMap[request.taskType] || ['analysis'];
    
    if (request.complexity === 'complex') {
      capabilities.push('complex-tasks');
    }
    
    if (request.content.length > 50000) {
      capabilities.push('long-documents');
    }

    return capabilities;
  }

  /**
   * Execute analysis with specific model
   */
  private async executeAnalysis(
    request: AnalysisRequest, 
    modelId: string, 
    startTime: number
  ): Promise<AnalysisResponse> {
    const config = MODEL_CONFIGS[modelId];
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    let result: any;
    let tokensUsed = { input: 0, output: 0 };

    switch (config.provider) {
      case 'openai':
        result = await this.executeOpenAI(config, systemPrompt, userPrompt, request);
        tokensUsed = {
          input: result.usage?.prompt_tokens || 0,
          output: result.usage?.completion_tokens || 0
        };
        result = result.choices[0].message.content;
        break;

      case 'anthropic':
        result = await this.executeAnthropic(config, systemPrompt, userPrompt, request);
        tokensUsed = {
          input: result.usage?.input_tokens || 0,
          output: result.usage?.output_tokens || 0
        };
        result = result.content[0].text;
        break;

      default:
        throw new AppError(400, `Unsupported provider: ${config.provider}`);
    }

    // Parse structured output if required
    if (request.requiresStructuredOutput) {
      try {
        result = JSON.parse(result);
      } catch (error) {
        // Try to extract JSON from response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new AppError(500, 'Failed to parse structured output from AI response');
        }
      }
    }

    const processingTime = Date.now() - startTime;
    const cost = ((tokensUsed.input + tokensUsed.output) / 1000) * config.costPer1kTokens;

    return {
      result,
      modelUsed: modelId,
      cost,
      processingTime,
      tokensUsed,
      confidence: this.calculateConfidence(config, processingTime, tokensUsed)
    };
  }

  /**
   * Execute OpenAI request
   */
  private async executeOpenAI(
    config: ModelConfig,
    systemPrompt: string,
    userPrompt: string,
    request: AnalysisRequest
  ) {
    const params: any = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: Math.min(4000, config.maxTokens * 0.2),
      temperature: 0.1,
      timeout: request.timeoutMs || 30000
    };

    if (request.requiresStructuredOutput) {
      params.response_format = { type: 'json_object' };
    }

    return await this.openaiClient.chat.completions.create(params);
  }

  /**
   * Execute Anthropic request
   */
  private async executeAnthropic(
    config: ModelConfig,
    systemPrompt: string,
    userPrompt: string,
    request: AnalysisRequest
  ) {
    return await this.anthropicClient.messages.create({
      model: config.model,
      max_tokens: Math.min(4000, config.maxTokens * 0.2),
      temperature: 0.1,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });
  }

  /**
   * Build system prompt based on request type
   */
  private buildSystemPrompt(request: AnalysisRequest): string {
    const basePrompt = `You are an expert legal AI assistant specializing in contract analysis. 
    Provide accurate, detailed analysis based on the document content provided.`;

    const taskSpecificPrompts = {
      'risk-analysis': `Focus on identifying potential risks, liabilities, and problematic clauses. 
      Rate overall risk on a scale of 1-10 and explain your reasoning.`,
      
      'compliance-check': `Analyze compliance with standard legal requirements and industry regulations. 
      Identify any compliance gaps or concerns.`,
      
      'clause-extraction': `Extract and categorize key contract clauses including terms, conditions, 
      obligations, and important dates.`,
      
      'summary': `Provide a concise but comprehensive summary of the contract's key points, 
      including parties, purpose, terms, and obligations.`,
      
      'classification': `Classify the document type and identify its primary legal category 
      and business purpose.`
    };

    let prompt = basePrompt + '\n\n' + taskSpecificPrompts[request.taskType];

    if (request.requiresStructuredOutput) {
      prompt += '\n\nProvide your response as valid JSON with appropriate fields for the analysis type.';
    }

    return prompt;
  }

  /**
   * Build user prompt with content
   */
  private buildUserPrompt(request: AnalysisRequest): string {
    return `Please analyze the following contract document:\n\n${request.content}`;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    config: ModelConfig, 
    processingTime: number, 
    tokensUsed: { input: number; output: number }
  ): number {
    let confidence = config.reliability;
    
    // Adjust based on processing time (too fast might indicate shallow analysis)
    if (processingTime < 1000) confidence *= 0.9;
    if (processingTime > 30000) confidence *= 0.95;
    
    // Adjust based on output length (very short outputs might be incomplete)
    if (tokensUsed.output < 50) confidence *= 0.8;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(modelId: string): boolean {
    const config = MODEL_CONFIGS[modelId];
    const limiter = this.rateLimiters.get(modelId);
    const now = new Date();
    
    if (!limiter || limiter.resetTime < now) {
      this.rateLimiters.set(modelId, {
        requests: 1,
        resetTime: new Date(now.getTime() + 60000) // Reset every minute
      });
      return true;
    }
    
    if (limiter.requests >= config.speed) {
      return false; // Rate limited
    }
    
    limiter.requests++;
    return true;
  }

  /**
   * Update model metrics
   */
  private updateMetrics(
    modelId: string, 
    success: boolean, 
    cost: number, 
    latency: number
  ): void {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return;

    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    metrics.totalCost += cost;
    
    // Update average latency
    metrics.averageLatency = (
      (metrics.averageLatency * (metrics.totalRequests - 1) + latency) / 
      metrics.totalRequests
    );
    
    metrics.lastUpdated = new Date();
  }

  /**
   * Cache management
   */
  private generateCacheKey(request: AnalysisRequest): string {
    const key = `${request.taskType}:${request.complexity}:${request.tenantId}`;
    const contentHash = this.simpleHash(request.content);
    return `${key}:${contentHash}`;
  }

  private cacheResponse(key: string, response: AnalysisResponse): void {
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour cache
    this.responseCache.set(key, { response, expiry });
  }

  private cleanupCache(): void {
    const now = new Date();
    for (const [key, cached] of this.responseCache.entries()) {
      if (cached.expiry < now) {
        this.responseCache.delete(key);
      }
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get orchestrator metrics and status
   */
  getMetrics(): any {
    const modelStats = Object.fromEntries(
      Array.from(this.modelMetrics.entries()).map(([modelId, metrics]) => [
        modelId,
        {
          ...metrics,
          successRate: metrics.totalRequests > 0 
            ? (metrics.successfulRequests / metrics.totalRequests) * 100 
            : 0
        }
      ])
    );

    return {
      models: modelStats,
      cache: {
        size: this.responseCache.size,
        hitRate: 0 // Would need to track this separately
      },
      totalCost: Array.from(this.modelMetrics.values())
        .reduce((sum, metrics) => sum + metrics.totalCost, 0),
      totalRequests: Array.from(this.modelMetrics.values())
        .reduce((sum, metrics) => sum + metrics.totalRequests, 0)
    };
  }

  /**
   * Health check for all models
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    const testPromises = Object.keys(MODEL_CONFIGS).map(async (modelId) => {
      try {
        const testRequest: AnalysisRequest = {
          content: 'Test document for health check.',
          taskType: 'classification',
          complexity: 'simple',
          priority: 'low',
          tenantId: 'health-check',
          timeoutMs: 5000
        };
        
        await this.executeAnalysis(testRequest, modelId, Date.now());
        results[modelId] = true;
      } catch (error) {
        results[modelId] = false;
      }
    });

    await Promise.allSettled(testPromises);
    return results;
  }
}

export const aiOrchestrator = new AIOrchestrator();