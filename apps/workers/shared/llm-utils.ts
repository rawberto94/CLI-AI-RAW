/**
 * Shared LLM Utilities
 * Consolidates OpenAI integration, prompt templates, and LLM operations
 */

import { OpenAI } from 'openai';

// LLM Configuration
export interface LLMConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

// LLM Response with confidence scoring
export interface LLMResponse<T = any> {
  data: T;
  confidence: number;
  processingTime: number;
  model: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// Expert personas for different analysis types
export const EXPERT_PERSONAS = {
  FINANCIAL_CFO: `You are a Chief Financial Officer with 25+ years of experience in financial analysis, contract economics, and corporate finance across multiple industries including technology, healthcare, finance, and manufacturing.`,
  
  LEGAL_COUNSEL: `You are a Senior Legal Counsel with 20+ years of experience in contract law, risk assessment, and regulatory compliance across multiple jurisdictions and industries.`,
  
  RISK_ANALYST: `You are a Senior Risk Analyst with 15+ years of experience in enterprise risk management, operational risk assessment, and strategic risk mitigation across various industries.`,
  
  COMPLIANCE_OFFICER: `You are a Chief Compliance Officer with 20+ years of experience in regulatory compliance, policy development, and compliance risk management across multiple regulatory frameworks.`,
  
  CONTRACT_SPECIALIST: `You are a Senior Contract Specialist with 18+ years of experience in contract analysis, negotiation, and management across various contract types and industries.`,
  
  BUSINESS_STRATEGIST: `You are a Senior Business Strategist with 22+ years of experience in strategic planning, business optimization, and organizational development across Fortune 500 companies.`
};

// Common prompt templates
export const PROMPT_TEMPLATES = {
  ANALYSIS_SYSTEM: (persona: string, analysisType: string) => `
${persona}

You are conducting a comprehensive ${analysisType} analysis of a contract. Your analysis should be:
- Expert-level and thorough
- Actionable and practical
- Industry-aware and context-sensitive
- Risk-conscious and opportunity-focused
- Compliant with best practices and regulations

Provide structured, detailed analysis with confidence scoring and specific recommendations.
`,

  BEST_PRACTICES_SYSTEM: (persona: string, domain: string) => `
${persona}

Generate expert-level best practices and recommendations for ${domain}. Your recommendations should be:
- Actionable and implementable
- Industry-specific and context-aware
- Risk-mitigating and value-creating
- Measurable with clear success metrics
- Aligned with industry standards and regulations

Provide comprehensive guidance with implementation timelines and resource requirements.
`,

  CONFIDENCE_ASSESSMENT: `
Based on your analysis, provide a confidence score (0-100) that reflects:
- Quality and completeness of source data
- Clarity and specificity of contract language
- Availability of relevant context and background
- Complexity and ambiguity of terms
- Your expertise level in the specific domain

Include reasoning for your confidence assessment.
`
};

/**
 * Enhanced Shared LLM Client with comprehensive features
 */
export class SharedLLMClient {
  private client: OpenAI | null = null;
  private config: LLMConfig;
  private retryAttempts = 3;
  private retryDelay = 1000; // ms
  private tokenUsage: { prompt: number; completion: number; total: number } = { prompt: 0, completion: 0, total: 0 };
  private requestCount = 0;
  private errorCount = 0;
  private rateLimiter: { requests: number; resetTime: number } = { requests: 0, resetTime: Date.now() + 60000 };

  constructor(config: LLMConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      model: config.model || process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: config.temperature || 0.1,
      maxTokens: config.maxTokens || 4000,
      timeout: config.timeout || 60000
    };

    if (this.config.apiKey) {
      this.client = new OpenAI({ 
        apiKey: this.config.apiKey,
        timeout: this.config.timeout
      });
    }
  }

  /**
   * Check if LLM is available
   */
  isAvailable(): boolean {
    return this.client !== null && !!this.config.apiKey;
  }

  /**
   * Generate LLM response with enhanced features
   */
  async generateResponse<T = any>(
    systemPrompt: string,
    userPrompt: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'json' | 'text';
      parser?: (text: string) => T;
    } = {}
  ): Promise<LLMResponse<T>> {
    if (!this.isAvailable()) {
      throw new Error('LLM client not available - missing API key or client initialization failed');
    }

    // Check rate limiting
    await this.checkRateLimit();

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        this.requestCount++;
        
        const response = await this.client!.chat.completions.create({
          model: this.config.model!,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: options.temperature ?? this.config.temperature,
          max_tokens: options.maxTokens ?? this.config.maxTokens
        });

        const responseText = response.choices?.[0]?.message?.content || '';
        const processingTime = Date.now() - startTime;

        // Track token usage
        const tokens = {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        };
        this.updateTokenUsage(tokens);

        // Parse response based on format
        let parsedData: T;
        let confidence = 85; // Default confidence

        if (options.responseFormat === 'json') {
          const parseResult = this.parseJsonResponse(responseText);
          parsedData = parseResult.data as T;
          confidence = parseResult.confidence;
        } else if (options.parser) {
          parsedData = options.parser(responseText);
        } else {
          parsedData = responseText as unknown as T;
        }

        return {
          data: parsedData,
          confidence,
          processingTime,
          model: this.config.model!,
          tokens
        };

      } catch (error) {
        lastError = error as Error;
        this.errorCount++;
        console.warn(`LLM request attempt ${attempt} failed:`, error);

        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`LLM request failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Generate response with fallback mechanism
   */
  async generateWithFallback<T>(
    systemPrompt: string,
    userPrompt: string,
    fallback: () => Promise<T>,
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'json' | 'text';
      parser?: (text: string) => T;
    } = {}
  ): Promise<{ data: T; usedFallback: boolean; confidence: number; processingTime: number }> {
    const startTime = Date.now();
    
    try {
      const response = await this.generateResponse<T>(systemPrompt, userPrompt, options);
      return {
        data: response.data,
        usedFallback: false,
        confidence: response.confidence,
        processingTime: response.processingTime
      };
    } catch (error) {
      console.warn('LLM generation failed, using fallback:', error);
      
      try {
        const fallbackData = await fallback();
        return {
          data: fallbackData,
          usedFallback: true,
          confidence: 60, // Lower confidence for fallback
          processingTime: Date.now() - startTime
        };
      } catch (fallbackError) {
        throw new Error(`Both LLM and fallback failed: ${error}, ${fallbackError}`);
      }
    }
  }

  /**
   * Validate response format and content
   */
  async validateResponse(response: string, expectedFormat: 'json' | 'text'): Promise<{
    isValid: boolean;
    errors: string[];
    parsedData?: any;
  }> {
    const errors: string[] = [];
    let parsedData: any;

    if (!response || response.trim().length === 0) {
      errors.push('Response is empty');
      return { isValid: false, errors };
    }

    if (expectedFormat === 'json') {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          errors.push('No JSON object found in response');
        } else {
          parsedData = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        errors.push(`Invalid JSON format: ${parseError}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsedData
    };
  }

  /**
   * Get token usage metrics
   */
  getTokenUsageMetrics(): { prompt: number; completion: number; total: number; requests: number; errors: number } {
    return {
      ...this.tokenUsage,
      requests: this.requestCount,
      errors: this.errorCount
    };
  }

  /**
   * Get cost estimate based on token usage
   */
  getCostEstimate(): { estimatedCost: number; currency: string; model: string } {
    // Rough cost estimates (these would need to be updated based on actual pricing)
    const costPerToken = this.config.model?.includes('gpt-4') ? 0.00003 : 0.000002;
    const estimatedCost = this.tokenUsage.total * costPerToken;
    
    return {
      estimatedCost: Math.round(estimatedCost * 100) / 100,
      currency: 'USD',
      model: this.config.model!
    };
  }

  /**
   * Generate expert analysis with persona
   */
  async generateExpertAnalysis<T = any>(
    persona: keyof typeof EXPERT_PERSONAS,
    analysisType: string,
    content: string,
    options: {
      additionalContext?: string;
      responseFormat?: 'json' | 'text';
      parser?: (text: string) => T;
    } = {}
  ): Promise<LLMResponse<T>> {
    const systemPrompt = PROMPT_TEMPLATES.ANALYSIS_SYSTEM(
      EXPERT_PERSONAS[persona],
      analysisType
    );

    const userPrompt = `
${options.additionalContext ? `CONTEXT: ${options.additionalContext}\n\n` : ''}
CONTENT FOR ANALYSIS:
${content}

Please provide comprehensive ${analysisType} analysis with actionable insights and recommendations.
${options.responseFormat === 'json' ? 'Return your response as valid JSON.' : ''}
`;

    return this.generateResponse(systemPrompt, userPrompt, options);
  }

  /**
   * Generate best practices recommendations
   */
  async generateBestPractices<T = any>(
    persona: keyof typeof EXPERT_PERSONAS,
    domain: string,
    context: string,
    options: {
      responseFormat?: 'json' | 'text';
      parser?: (text: string) => T;
    } = {}
  ): Promise<LLMResponse<T>> {
    const systemPrompt = PROMPT_TEMPLATES.BEST_PRACTICES_SYSTEM(
      EXPERT_PERSONAS[persona],
      domain
    );

    const userPrompt = `
CONTEXT FOR BEST PRACTICES GENERATION:
${context}

Generate comprehensive best practices and recommendations for ${domain} with:
- Specific implementation strategies
- Timeline and resource requirements
- Success metrics and KPIs
- Risk mitigation approaches
- Industry-specific considerations

${options.responseFormat === 'json' ? 'Return your response as valid JSON.' : ''}
`;

    return this.generateResponse(systemPrompt, userPrompt, options);
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset rate limiter every minute
    if (now > this.rateLimiter.resetTime) {
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetTime = now + 60000;
    }
    
    // Simple rate limiting - max 50 requests per minute
    if (this.rateLimiter.requests >= 50) {
      const waitTime = this.rateLimiter.resetTime - now;
      console.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      this.rateLimiter.requests = 0;
      this.rateLimiter.resetTime = Date.now() + 60000;
    }
    
    this.rateLimiter.requests++;
  }

  /**
   * Parse JSON response with error handling
   */
  private parseJsonResponse(responseText: string): { data: any; confidence: number } {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        
        // Extract confidence if available
        let confidence = 85;
        if (typeof jsonData === 'object' && jsonData.confidence) {
          confidence = jsonData.confidence;
        } else if (typeof jsonData === 'object' && jsonData.overallConfidence) {
          confidence = jsonData.overallConfidence;
        }
        
        return { data: jsonData, confidence };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('Failed to parse JSON response, using text fallback');
      return { data: responseText, confidence: 60 };
    }
  }

  /**
   * Update token usage tracking
   */
  private updateTokenUsage(tokens: { prompt: number; completion: number; total: number }): void {
    this.tokenUsage.prompt += tokens.prompt;
    this.tokenUsage.completion += tokens.completion;
    this.tokenUsage.total += tokens.total;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton LLM client instance
 */
let sharedLLMClient: SharedLLMClient | null = null;

/**
 * Get shared LLM client instance
 */
export function getSharedLLMClient(config?: LLMConfig): SharedLLMClient {
  if (!sharedLLMClient) {
    sharedLLMClient = new SharedLLMClient(config);
  }
  return sharedLLMClient;
}

/**
 * Quick LLM availability check
 */
export function isLLMAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Extract confidence score from various response formats
 */
export function extractConfidence(data: any): number {
  if (typeof data === 'object' && data !== null) {
    // Try various confidence field names
    const confidenceFields = [
      'confidence', 'confidenceScore', 'overallConfidence', 
      'certainty', 'reliability', 'accuracy'
    ];
    
    for (const field of confidenceFields) {
      if (typeof data[field] === 'number') {
        return Math.max(0, Math.min(100, data[field]));
      }
    }
    
    // Check nested metadata
    if (data.metadata && typeof data.metadata === 'object') {
      for (const field of confidenceFields) {
        if (typeof data.metadata[field] === 'number') {
          return Math.max(0, Math.min(100, data.metadata[field]));
        }
      }
    }
  }
  
  return 75; // Default confidence
}

/**
 * Standardize LLM error handling
 */
export function handleLLMError(error: any, fallbackValue: any = null): any {
  console.warn('LLM operation failed:', error);
  
  // Return structured error response
  return {
    success: false,
    error: error.message || 'LLM operation failed',
    fallback: fallbackValue,
    confidence: 0,
    processingTime: 0
  };
}

/**
 * Create standardized provenance entry
 */
export function createProvenance(
  worker: string,
  llmResponse?: LLMResponse<any>,
  additionalData?: Record<string, any>
): any {
  return {
    worker,
    timestamp: new Date().toISOString(),
    durationMs: llmResponse?.processingTime || 0,
    model: llmResponse?.model || 'unknown',
    confidenceScore: llmResponse?.confidence || 0,
    tokens: llmResponse?.tokens || undefined,
    ...additionalData
  };
}