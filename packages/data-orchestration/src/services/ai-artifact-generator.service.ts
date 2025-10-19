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

import pino from 'pino';
import { confidenceScoringService } from './confidence-scoring.service';
import { artifactVersioningService } from './artifact-versioning.service';

const logger = pino({ name: 'ai-artifact-generator-service' });

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
export type ArtifactType = 'OVERVIEW' | 'FINANCIAL' | 'CLAUSES' | 'RATES' | 'COMPLIANCE' | 'RISK';

export interface GenerationOptions {
  preferredMethod?: GenerationMethod;
  enableFallback?: boolean;
  maxRetries?: number;
  timeout?: number;
  userId?: string;
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
}

export interface AIResponse {
  data: any;
  certainty: number; // 0-1
  model: string;
  tokensUsed?: number;
}

// =========================================================================
// AI ARTIFACT GENERATOR SERVICE
// =========================================================================

export class AIArtifactGeneratorService {
  private static instance: AIArtifactGeneratorService;
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2 seconds
  private readonly circuitBreaker = new CircuitBreaker();

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

        const prompt = this.buildPrompt(artifactType, contractText);
        const systemPrompt = this.getSystemPrompt(artifactType);

        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }

        return JSON.parse(content);
      });

      // Extract certainty from response if available
      const aiCertainty = this.extractCertainty(result) || 0.85;

      return {
        success: true,
        data: result,
        method: 'ai',
        aiCertainty,
        processingTime: 0, // Will be set by caller
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
    
    // Look for common party patterns
    const clientPattern = /(?:client|buyer|customer)[\s:]+([A-Z][A-Za-z\s&,\.]+?)(?:\(|,|;|\n)/gi;
    const supplierPattern = /(?:supplier|vendor|seller|provider)[\s:]+([A-Z][A-Za-z\s&,\.]+?)(?:\(|,|;|\n)/gi;

    const clientMatch = clientPattern.exec(text);
    if (clientMatch) {
      parties.push({ name: clientMatch[1].trim(), role: 'client' });
    }

    const supplierMatch = supplierPattern.exec(text);
    if (supplierMatch) {
      parties.push({ name: supplierMatch[1].trim(), role: 'supplier' });
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
