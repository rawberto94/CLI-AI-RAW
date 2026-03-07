/**
 * AI Contract Summarization Service
 * 
 * Generates intelligent summaries of contracts at multiple levels:
 * - Executive summary (one paragraph)
 * - Key points summary
 * - Section-by-section breakdown
 * - Risk highlights
 * - Financial summary
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';

// Types
export type SummaryLevel = 'executive' | 'detailed' | 'sections' | 'risks' | 'financial' | 'complete';

export interface SummaryRequest {
  contractId: string;
  contractText: string;
  contractType?: string;
  level: SummaryLevel;
  maxLength?: number; // Max words
  focusAreas?: string[]; // Specific areas to emphasize
  includeRecommendations?: boolean;
}

export interface ExecutiveSummary {
  summary: string;
  keyTakeaways: string[];
  overallAssessment: 'favorable' | 'neutral' | 'unfavorable' | 'requires_review';
  confidenceScore: number;
}

export interface KeyPoint {
  category: string;
  point: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  pageReference?: string;
}

export interface SectionSummary {
  sectionTitle: string;
  summary: string;
  keyTerms: string[];
  flags: string[];
}

export interface RiskHighlight {
  riskType: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigationSuggestion?: string;
  clauseReference?: string;
}

export interface FinancialSummary {
  totalValue?: string;
  paymentTerms?: string;
  penalties?: string[];
  incentives?: string[];
  costBreakdown?: Record<string, string>;
  financialRisks?: string[];
}

export interface ContractSummary {
  contractId: string;
  generatedAt: Date;
  level: SummaryLevel;
  executiveSummary?: ExecutiveSummary;
  keyPoints?: KeyPoint[];
  sections?: SectionSummary[];
  risks?: RiskHighlight[];
  financial?: FinancialSummary;
  recommendations?: string[];
  metadata: {
    model: string;
    processingTimeMs: number;
    wordCount: number;
    tokenUsage: { prompt: number; completion: number; total: number };
  };
}

export interface SummaryTemplate {
  id: string;
  name: string;
  level: SummaryLevel;
  focusAreas: string[];
  maxLength: number;
  includeRecommendations: boolean;
  systemPrompt?: string;
}

class AIContractSummarizationService {
  private openai: OpenAI | null = null;
  private cache: Map<string, { summary: ContractSummary; expiresAt: Date }> = new Map();
  private templates: Map<string, SummaryTemplate> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.initializeTemplates();
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  private initializeTemplates(): void {
    const defaultTemplates: SummaryTemplate[] = [
      {
        id: 'executive-quick',
        name: 'Quick Executive Summary',
        level: 'executive',
        focusAreas: ['obligations', 'risks', 'value'],
        maxLength: 200,
        includeRecommendations: false,
      },
      {
        id: 'executive-detailed',
        name: 'Detailed Executive Summary',
        level: 'executive',
        focusAreas: ['obligations', 'risks', 'value', 'timeline', 'parties'],
        maxLength: 500,
        includeRecommendations: true,
      },
      {
        id: 'risk-focused',
        name: 'Risk Assessment Summary',
        level: 'risks',
        focusAreas: ['liability', 'termination', 'penalties', 'compliance'],
        maxLength: 1000,
        includeRecommendations: true,
      },
      {
        id: 'financial-review',
        name: 'Financial Review Summary',
        level: 'financial',
        focusAreas: ['pricing', 'payments', 'penalties', 'adjustments'],
        maxLength: 800,
        includeRecommendations: true,
      },
      {
        id: 'complete-analysis',
        name: 'Complete Contract Analysis',
        level: 'complete',
        focusAreas: [],
        maxLength: 3000,
        includeRecommendations: true,
      },
    ];

    defaultTemplates.forEach(t => this.templates.set(t.id, t));
  }

  /**
   * Generate a contract summary
   */
  async summarize(request: SummaryRequest): Promise<ContractSummary> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(request);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.summary;
    }

    const openai = this.getOpenAI();

    // Build appropriate prompts based on level
    const result: ContractSummary = {
      contractId: request.contractId,
      generatedAt: new Date(),
      level: request.level,
      metadata: {
        model: 'gpt-4o',
        processingTimeMs: 0,
        wordCount: 0,
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
      },
    };

    let totalTokens = { prompt: 0, completion: 0, total: 0 };

    try {
      // Generate based on level
      if (request.level === 'executive' || request.level === 'complete') {
        const execResult = await this.generateExecutiveSummary(openai, request);
        result.executiveSummary = execResult.summary;
        this.addTokens(totalTokens, execResult.tokens);
      }

      if (request.level === 'detailed' || request.level === 'complete') {
        const keyPointsResult = await this.generateKeyPoints(openai, request);
        result.keyPoints = keyPointsResult.points;
        this.addTokens(totalTokens, keyPointsResult.tokens);
      }

      if (request.level === 'sections' || request.level === 'complete') {
        const sectionsResult = await this.generateSectionSummaries(openai, request);
        result.sections = sectionsResult.sections;
        this.addTokens(totalTokens, sectionsResult.tokens);
      }

      if (request.level === 'risks' || request.level === 'complete') {
        const risksResult = await this.generateRiskHighlights(openai, request);
        result.risks = risksResult.risks;
        this.addTokens(totalTokens, risksResult.tokens);
      }

      if (request.level === 'financial' || request.level === 'complete') {
        const financialResult = await this.generateFinancialSummary(openai, request);
        result.financial = financialResult.financial;
        this.addTokens(totalTokens, financialResult.tokens);
      }

      // Generate recommendations if requested
      if (request.includeRecommendations) {
        const recsResult = await this.generateRecommendations(openai, request, result);
        result.recommendations = recsResult.recommendations;
        this.addTokens(totalTokens, recsResult.tokens);
      }

      // Update metadata
      result.metadata.processingTimeMs = Date.now() - startTime;
      result.metadata.tokenUsage = totalTokens;
      result.metadata.wordCount = this.countWords(result);

      // Cache result
      this.cache.set(cacheKey, {
        summary: result,
        expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
      });

      return result;
    } catch (error: unknown) {
      throw error;
    }
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(
    openai: OpenAI,
    request: SummaryRequest
  ): Promise<{ summary: ExecutiveSummary; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are an expert contract analyst. Generate a concise executive summary of the contract.
Focus on: key obligations, important dates, financial terms, and any notable risks or opportunities.
Be objective and factual. Highlight anything that requires attention.`;

    const userPrompt = `Analyze this ${request.contractType || 'contract'} and provide:
1. A clear summary paragraph (max ${request.maxLength || 300} words)
2. 3-5 key takeaways as bullet points
3. Overall assessment: favorable, neutral, unfavorable, or requires_review
4. Your confidence score (0-1) in this assessment

Focus areas: ${request.focusAreas?.join(', ') || 'all aspects'}

CONTRACT TEXT:
${request.contractText.substring(0, 15000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      summary: {
        summary: parsed.summary || '',
        keyTakeaways: parsed.keyTakeaways || [],
        overallAssessment: parsed.overallAssessment || 'neutral',
        confidenceScore: parsed.confidenceScore || 0.7,
      },
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate key points
   */
  private async generateKeyPoints(
    openai: OpenAI,
    request: SummaryRequest
  ): Promise<{ points: KeyPoint[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are an expert contract analyst. Extract the most important points from the contract.
Categorize each point and rate its importance level.`;

    const userPrompt = `Extract key points from this ${request.contractType || 'contract'}.
For each point, provide:
- category (e.g., "Obligations", "Rights", "Terms", "Conditions", "Limitations")
- point (the key information)
- importance (critical, high, medium, or low)
- pageReference (if identifiable)

Return as JSON array of key points.

CONTRACT TEXT:
${request.contractText.substring(0, 15000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      points: parsed.keyPoints || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate section summaries
   */
  private async generateSectionSummaries(
    openai: OpenAI,
    request: SummaryRequest
  ): Promise<{ sections: SectionSummary[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are an expert contract analyst. Break down the contract into sections and summarize each.`;

    const userPrompt = `Analyze this ${request.contractType || 'contract'} section by section.
For each section, provide:
- sectionTitle
- summary (2-3 sentences)
- keyTerms (important terms or definitions)
- flags (any concerns or notable items)

Return as JSON with "sections" array.

CONTRACT TEXT:
${request.contractText.substring(0, 15000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      sections: parsed.sections || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate risk highlights
   */
  private async generateRiskHighlights(
    openai: OpenAI,
    request: SummaryRequest
  ): Promise<{ risks: RiskHighlight[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are an expert contract risk analyst. Identify and assess risks in the contract.
Consider: liability exposure, termination risks, compliance requirements, financial risks, operational risks.`;

    const userPrompt = `Analyze risks in this ${request.contractType || 'contract'}.
For each risk, provide:
- riskType (e.g., "Liability", "Termination", "Financial", "Compliance", "Operational")
- description (what the risk is)
- severity (critical, high, medium, or low)
- mitigationSuggestion (how to address it)
- clauseReference (which clause, if identifiable)

Return as JSON with "risks" array.

CONTRACT TEXT:
${request.contractText.substring(0, 15000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      risks: parsed.risks || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate financial summary
   */
  private async generateFinancialSummary(
    openai: OpenAI,
    request: SummaryRequest
  ): Promise<{ financial: FinancialSummary; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are an expert contract financial analyst. Extract and summarize all financial terms.`;

    const userPrompt = `Extract financial information from this ${request.contractType || 'contract'}:
- totalValue (contract value if stated)
- paymentTerms (payment schedule/conditions)
- penalties (any penalty clauses)
- incentives (bonuses, discounts, etc.)
- costBreakdown (breakdown of costs if available)
- financialRisks (any financial risks identified)

Return as JSON object.

CONTRACT TEXT:
${request.contractText.substring(0, 15000)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      financial: {
        totalValue: parsed.totalValue,
        paymentTerms: parsed.paymentTerms,
        penalties: parsed.penalties || [],
        incentives: parsed.incentives || [],
        costBreakdown: parsed.costBreakdown || {},
        financialRisks: parsed.financialRisks || [],
      },
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    openai: OpenAI,
    request: SummaryRequest,
    summary: ContractSummary
  ): Promise<{ recommendations: string[]; tokens: { prompt: number; completion: number; total: number } }> {
    const context = JSON.stringify({
      executiveSummary: summary.executiveSummary,
      risks: summary.risks,
      financial: summary.financial,
    });

    const systemPrompt = `You are an expert contract advisor. Based on the analysis, provide actionable recommendations.`;

    const userPrompt = `Based on this contract analysis, provide 3-7 specific, actionable recommendations:

ANALYSIS SUMMARY:
${context}

Provide recommendations as a JSON array of strings. Each should be a specific action the reader should take.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      recommendations: parsed.recommendations || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Use a predefined template
   */
  async summarizeWithTemplate(
    contractId: string,
    contractText: string,
    templateId: string
  ): Promise<ContractSummary> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.summarize({
      contractId,
      contractText,
      level: template.level,
      maxLength: template.maxLength,
      focusAreas: template.focusAreas,
      includeRecommendations: template.includeRecommendations,
    });
  }

  /**
   * Get available templates
   */
  getTemplates(): SummaryTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add a custom template
   */
  addTemplate(template: SummaryTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Compare two contract summaries
   */
  async compareSummaries(
    summary1: ContractSummary,
    summary2: ContractSummary
  ): Promise<{
    similarities: string[];
    differences: string[];
    riskComparison: string;
    financialComparison: string;
    recommendation: string;
  }> {
    const openai = this.getOpenAI();

    const prompt = `Compare these two contract summaries and identify key similarities and differences:

CONTRACT 1:
${JSON.stringify(summary1, null, 2)}

CONTRACT 2:
${JSON.stringify(summary2, null, 2)}

Provide:
- similarities (array of key similarities)
- differences (array of key differences)
- riskComparison (which contract has more/higher risks)
- financialComparison (comparison of financial terms)
- recommendation (which contract is more favorable and why)

Return as JSON object.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  // Helper methods
  private getCacheKey(request: SummaryRequest): string {
    const hash = this.simpleHash(request.contractText);
    return `${request.contractId}:${request.level}:${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 1000); i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private addTokens(
    total: { prompt: number; completion: number; total: number },
    add: { prompt: number; completion: number; total: number }
  ): void {
    total.prompt += add.prompt;
    total.completion += add.completion;
    total.total += add.total;
  }

  private countWords(summary: ContractSummary): number {
    let count = 0;
    if (summary.executiveSummary?.summary) {
      count += summary.executiveSummary.summary.split(/\s+/).length;
    }
    if (summary.keyPoints) {
      summary.keyPoints.forEach(p => {
        count += p.point.split(/\s+/).length;
      });
    }
    if (summary.sections) {
      summary.sections.forEach(s => {
        count += s.summary.split(/\s+/).length;
      });
    }
    return count;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton
export const aiContractSummarizationService = new AIContractSummarizationService();
export { AIContractSummarizationService };
