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
 * Shared LLM Client with enhanced error handling and retry logic
 */
export class SharedLLMClient {
  private client: OpenAI | null = null;
  private config: LLMConfig;
  private retryAttempts = 3;
  private retryDelay = 1000; // ms

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
   * Generate LLM response with retry logic and confidence scoring
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

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
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

        // Parse response based on format
        let parsedData: T;
        let confidence = 85; // Default confidence

        if (options.responseFormat === 'json') {
          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonData = JSON.parse(jsonMatch[0]);
              parsedData = jsonData as T;
              
              // Extract confidence if available
              if (typeof jsonData === 'object' && jsonData.confidence) {
                confidence = jsonData.confidence;
              } else if (typeof jsonData === 'object' && jsonData.overallConfidence) {
                confidence = jsonData.overallConfidence;
              }
            } else {
              throw new Error('No JSON found in response');
            }
          } catch (parseError) {
            console.warn('Failed to parse JSON response, using text fallback');
            parsedData = responseText as unknown as T;
            confidence = 60; // Lower confidence for unparsed response
          }
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
          tokens: {
            prompt: response.usage?.prompt_tokens || 0,
            completion: response.usage?.completion_tokens || 0,
            total: response.usage?.total_tokens || 0
          }
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`LLM request attempt ${attempt} failed:`, error);

        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(`LLM request failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
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