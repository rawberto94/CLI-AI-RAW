/**
 * AI-Powered Contract Comparison Service
 * 
 * Compare contracts intelligently:
 * - Side-by-side field comparison
 * - Semantic similarity scoring
 * - Clause-by-clause diff
 * - Risk differential analysis
 * - Version comparison for same contract
 * - Benchmark against templates
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';

// Types
export type ComparisonType = 'full' | 'fields' | 'clauses' | 'risks' | 'financial' | 'terms';

export interface ContractData {
  id: string;
  name: string;
  text: string;
  type?: string;
  extractedFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FieldComparison {
  fieldName: string;
  contract1Value: unknown;
  contract2Value: unknown;
  status: 'match' | 'different' | 'missing_in_1' | 'missing_in_2';
  significance: 'critical' | 'high' | 'medium' | 'low';
  analysis?: string;
}

export interface ClauseComparison {
  clauseType: string;
  contract1Summary: string;
  contract2Summary: string;
  similarity: number; // 0-1
  keyDifferences: string[];
  favorability: 'contract1' | 'contract2' | 'equal' | 'context_dependent';
  riskImpact?: string;
}

export interface RiskDifferential {
  riskType: string;
  contract1Level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  contract2Level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  recommendation: string;
}

export interface FinancialComparison {
  metric: string;
  contract1Value: string | number;
  contract2Value: string | number;
  difference: string;
  percentChange?: number;
  analysis: string;
}

export interface TermsComparison {
  term: string;
  contract1: string;
  contract2: string;
  advantage: 'contract1' | 'contract2' | 'equal';
  notes: string;
}

export interface ComparisonSummary {
  overallSimilarity: number; // 0-1
  recommendation: 'contract1' | 'contract2' | 'either' | 'neither';
  recommendationReason: string;
  keyDifferences: string[];
  keyAgreements: string[];
  riskSummary: string;
  financialSummary: string;
}

export interface ContractComparisonResult {
  comparisonId: string;
  contract1: { id: string; name: string };
  contract2: { id: string; name: string };
  comparisonType: ComparisonType;
  generatedAt: Date;
  summary: ComparisonSummary;
  fieldComparisons?: FieldComparison[];
  clauseComparisons?: ClauseComparison[];
  riskDifferentials?: RiskDifferential[];
  financialComparisons?: FinancialComparison[];
  termsComparisons?: TermsComparison[];
  metadata: {
    model: string;
    processingTimeMs: number;
    tokenUsage: { prompt: number; completion: number; total: number };
  };
}

export interface ComparisonConfig {
  comparisonType: ComparisonType;
  focusAreas?: string[];
  includeRecommendations?: boolean;
  perspective?: 'buyer' | 'seller' | 'neutral';
}

class AIContractComparisonService {
  private openai: OpenAI | null = null;
  private cache: Map<string, { result: ContractComparisonResult; expiresAt: Date }> = new Map();
  private readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

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

  /**
   * Compare two contracts
   */
  async compareContracts(
    contract1: ContractData,
    contract2: ContractData,
    config: ComparisonConfig = { comparisonType: 'full' }
  ): Promise<ContractComparisonResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(contract1.id, contract2.id, config.comparisonType);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }

    const openai = this.getOpenAI();
    let totalTokens = { prompt: 0, completion: 0, total: 0 };

    const result: ContractComparisonResult = {
      comparisonId: `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      contract1: { id: contract1.id, name: contract1.name },
      contract2: { id: contract2.id, name: contract2.name },
      comparisonType: config.comparisonType,
      generatedAt: new Date(),
      summary: {} as ComparisonSummary,
      metadata: {
        model: 'gpt-4o',
        processingTimeMs: 0,
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
      },
    };

    try {
      // Generate comparisons based on type
      if (config.comparisonType === 'full' || config.comparisonType === 'fields') {
        if (contract1.extractedFields && contract2.extractedFields) {
          result.fieldComparisons = await this.compareFields(
            contract1.extractedFields,
            contract2.extractedFields,
            openai
          );
        }
      }

      if (config.comparisonType === 'full' || config.comparisonType === 'clauses') {
        const clauseResult = await this.compareClauses(contract1, contract2, openai);
        result.clauseComparisons = clauseResult.comparisons;
        this.addTokens(totalTokens, clauseResult.tokens);
      }

      if (config.comparisonType === 'full' || config.comparisonType === 'risks') {
        const riskResult = await this.compareRisks(contract1, contract2, openai, config.perspective);
        result.riskDifferentials = riskResult.risks;
        this.addTokens(totalTokens, riskResult.tokens);
      }

      if (config.comparisonType === 'full' || config.comparisonType === 'financial') {
        const financialResult = await this.compareFinancials(contract1, contract2, openai);
        result.financialComparisons = financialResult.comparisons;
        this.addTokens(totalTokens, financialResult.tokens);
      }

      if (config.comparisonType === 'full' || config.comparisonType === 'terms') {
        const termsResult = await this.compareTerms(contract1, contract2, openai, config.perspective);
        result.termsComparisons = termsResult.comparisons;
        this.addTokens(totalTokens, termsResult.tokens);
      }

      // Generate summary
      const summaryResult = await this.generateSummary(contract1, contract2, result, openai, config);
      result.summary = summaryResult.summary;
      this.addTokens(totalTokens, summaryResult.tokens);

      // Update metadata
      result.metadata.processingTimeMs = Date.now() - startTime;
      result.metadata.tokenUsage = totalTokens;

      // Cache result
      this.cache.set(cacheKey, {
        result,
        expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Compare extracted fields
   */
  private async compareFields(
    fields1: Record<string, unknown>,
    fields2: Record<string, unknown>,
    openai: OpenAI
  ): Promise<FieldComparison[]> {
    const comparisons: FieldComparison[] = [];
    const allFields = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);

    for (const fieldName of allFields) {
      const value1 = fields1[fieldName];
      const value2 = fields2[fieldName];

      let status: FieldComparison['status'];
      if (value1 === undefined) {
        status = 'missing_in_1';
      } else if (value2 === undefined) {
        status = 'missing_in_2';
      } else if (this.valuesEqual(value1, value2)) {
        status = 'match';
      } else {
        status = 'different';
      }

      comparisons.push({
        fieldName,
        contract1Value: value1,
        contract2Value: value2,
        status,
        significance: this.getFieldSignificance(fieldName),
      });
    }

    // Use AI to analyze significant differences
    const significantDiffs = comparisons.filter(c => 
      c.status === 'different' && 
      (c.significance === 'critical' || c.significance === 'high')
    );

    if (significantDiffs.length > 0) {
      const prompt = `Analyze these field differences between two contracts:

${JSON.stringify(significantDiffs, null, 2)}

For each difference, provide a brief analysis of its business impact.
Return JSON with "analyses" array matching field order.`;

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        const content = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        
        if (parsed.analyses) {
          significantDiffs.forEach((diff, i) => {
            diff.analysis = parsed.analyses[i] || undefined;
          });
        }
      } catch {
        // Field analysis failed, continue with comparisons
      }
    }

    return comparisons;
  }

  /**
   * Compare contract clauses
   */
  private async compareClauses(
    contract1: ContractData,
    contract2: ContractData,
    openai: OpenAI
  ): Promise<{ comparisons: ClauseComparison[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are an expert contract analyst. Compare clauses between two contracts.`;

    const userPrompt = `Compare the key clauses between these two contracts:

CONTRACT 1 (${contract1.name}):
${contract1.text.substring(0, 10000)}

CONTRACT 2 (${contract2.name}):
${contract2.text.substring(0, 10000)}

Identify and compare clauses in these categories:
- Termination
- Payment Terms
- Liability/Indemnification
- Confidentiality
- Intellectual Property
- Warranties
- Force Majeure
- Dispute Resolution
- Renewal/Extension

For each clause type found, provide:
- clauseType: the category
- contract1Summary: brief summary from contract 1
- contract2Summary: brief summary from contract 2
- similarity: 0-1 score
- keyDifferences: array of specific differences
- favorability: which contract is more favorable (or equal/context_dependent)
- riskImpact: impact on risk exposure

Return as JSON with "comparisons" array.`;

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
      comparisons: parsed.comparisons || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Compare risk profiles
   */
  private async compareRisks(
    contract1: ContractData,
    contract2: ContractData,
    openai: OpenAI,
    perspective?: string
  ): Promise<{ risks: RiskDifferential[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are a contract risk analyst. Compare risk exposures between contracts.
${perspective ? `Analyze from the perspective of the ${perspective}.` : ''}`;

    const userPrompt = `Compare risk profiles of these two contracts:

CONTRACT 1 (${contract1.name}):
${contract1.text.substring(0, 8000)}

CONTRACT 2 (${contract2.name}):
${contract2.text.substring(0, 8000)}

For each risk type, assess the level in each contract:
- Liability Exposure
- Termination Risk
- Financial Risk
- Compliance Risk
- Operational Risk
- Reputation Risk
- IP Risk
- Data/Security Risk

For each, provide:
- riskType
- contract1Level: none, low, medium, high, or critical
- contract2Level: same options
- explanation: why the levels differ
- recommendation: action to take

Return as JSON with "risks" array.`;

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
   * Compare financial terms
   */
  private async compareFinancials(
    contract1: ContractData,
    contract2: ContractData,
    openai: OpenAI
  ): Promise<{ comparisons: FinancialComparison[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are a financial analyst specializing in contracts.`;

    const userPrompt = `Compare financial terms between these contracts:

CONTRACT 1 (${contract1.name}):
${contract1.text.substring(0, 8000)}

CONTRACT 2 (${contract2.name}):
${contract2.text.substring(0, 8000)}

Compare these financial aspects:
- Total Value/Price
- Payment Terms (net days)
- Penalties/Late Fees
- Discounts/Incentives
- Price Adjustments/Escalation
- Liability Caps
- Insurance Requirements

For each metric found, provide:
- metric: the financial aspect
- contract1Value: value from contract 1
- contract2Value: value from contract 2
- difference: description of the difference
- percentChange: if calculable
- analysis: business impact

Return as JSON with "comparisons" array.`;

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
      comparisons: parsed.comparisons || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Compare general terms
   */
  private async compareTerms(
    contract1: ContractData,
    contract2: ContractData,
    openai: OpenAI,
    perspective?: string
  ): Promise<{ comparisons: TermsComparison[]; tokens: { prompt: number; completion: number; total: number } }> {
    const systemPrompt = `You are a contract terms analyst.
${perspective ? `Analyze from the perspective of the ${perspective}.` : ''}`;

    const userPrompt = `Compare key terms between these contracts:

CONTRACT 1 (${contract1.name}):
${contract1.text.substring(0, 8000)}

CONTRACT 2 (${contract2.name}):
${contract2.text.substring(0, 8000)}

Compare terms like:
- Contract Duration
- Renewal Terms
- Notice Periods
- Service Levels (if applicable)
- Exclusivity
- Non-compete provisions
- Assignment Rights
- Amendment Process

For each term, provide:
- term: the term name
- contract1: description from contract 1
- contract2: description from contract 2
- advantage: which contract is more favorable
- notes: additional observations

Return as JSON with "comparisons" array.`;

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
      comparisons: parsed.comparisons || [],
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Generate comparison summary
   */
  private async generateSummary(
    contract1: ContractData,
    contract2: ContractData,
    partialResult: ContractComparisonResult,
    openai: OpenAI,
    config: ComparisonConfig
  ): Promise<{ summary: ComparisonSummary; tokens: { prompt: number; completion: number; total: number } }> {
    const context = {
      fieldComparisons: partialResult.fieldComparisons?.filter(f => f.status !== 'match'),
      clauseComparisons: partialResult.clauseComparisons,
      riskDifferentials: partialResult.riskDifferentials,
      financialComparisons: partialResult.financialComparisons,
    };

    const systemPrompt = `You are a senior contract analyst providing an executive summary.
${config.perspective ? `Analyze from the perspective of the ${config.perspective}.` : ''}`;

    const userPrompt = `Based on this contract comparison analysis, provide an executive summary:

CONTRACT 1: ${contract1.name}
CONTRACT 2: ${contract2.name}

COMPARISON DATA:
${JSON.stringify(context, null, 2)}

Provide:
- overallSimilarity: 0-1 score
- recommendation: contract1, contract2, either, or neither
- recommendationReason: why this recommendation
- keyDifferences: top 5 differences (array of strings)
- keyAgreements: main areas of agreement (array of strings)
- riskSummary: one paragraph on risk comparison
- financialSummary: one paragraph on financial comparison

Return as JSON object.`;

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
        overallSimilarity: parsed.overallSimilarity || 0.5,
        recommendation: parsed.recommendation || 'either',
        recommendationReason: parsed.recommendationReason || '',
        keyDifferences: parsed.keyDifferences || [],
        keyAgreements: parsed.keyAgreements || [],
        riskSummary: parsed.riskSummary || '',
        financialSummary: parsed.financialSummary || '',
      },
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Compare multiple contracts
   */
  async compareMultiple(
    contracts: ContractData[],
    config: ComparisonConfig = { comparisonType: 'fields' }
  ): Promise<{
    pairwiseComparisons: ContractComparisonResult[];
    ranking: { contractId: string; contractName: string; score: number; reason: string }[];
  }> {
    if (contracts.length < 2) {
      throw new Error('At least 2 contracts required for comparison');
    }

    const pairwiseComparisons: ContractComparisonResult[] = [];

    // Compare all pairs
    for (let i = 0; i < contracts.length; i++) {
      for (let j = i + 1; j < contracts.length; j++) {
        const comparison = await this.compareContracts(contracts[i], contracts[j], config);
        pairwiseComparisons.push(comparison);
      }
    }

    // Calculate scores
    const scores = new Map<string, { wins: number; total: number }>();
    contracts.forEach(c => scores.set(c.id, { wins: 0, total: 0 }));

    for (const comparison of pairwiseComparisons) {
      const c1 = scores.get(comparison.contract1.id)!;
      const c2 = scores.get(comparison.contract2.id)!;
      c1.total++;
      c2.total++;

      if (comparison.summary.recommendation === 'contract1') {
        c1.wins++;
      } else if (comparison.summary.recommendation === 'contract2') {
        c2.wins++;
      } else {
        c1.wins += 0.5;
        c2.wins += 0.5;
      }
    }

    // Build ranking
    const ranking = contracts
      .map(c => {
        const s = scores.get(c.id)!;
        return {
          contractId: c.id,
          contractName: c.name,
          score: s.total > 0 ? s.wins / s.total : 0.5,
          reason: `Won ${s.wins} of ${s.total} comparisons`,
        };
      })
      .sort((a, b) => b.score - a.score);

    return { pairwiseComparisons, ranking };
  }

  // Helper methods
  private getCacheKey(id1: string, id2: string, type: ComparisonType): string {
    const ids = [id1, id2].sort();
    return `${ids[0]}:${ids[1]}:${type}`;
  }

  private valuesEqual(v1: unknown, v2: unknown): boolean {
    if (v1 === v2) return true;
    if (typeof v1 !== typeof v2) return false;
    if (typeof v1 === 'string' && typeof v2 === 'string') {
      return v1.toLowerCase().trim() === v2.toLowerCase().trim();
    }
    if (v1 instanceof Date && v2 instanceof Date) {
      return v1.getTime() === v2.getTime();
    }
    return JSON.stringify(v1) === JSON.stringify(v2);
  }

  private getFieldSignificance(fieldName: string): FieldComparison['significance'] {
    const critical = ['totalValue', 'effectiveDate', 'expirationDate', 'liabilityLimit'];
    const high = ['paymentTerms', 'terminationClause', 'renewalTerms', 'noticePeriod'];
    const medium = ['clientName', 'vendorName', 'autoRenewal', 'discountPercentage'];

    const lower = fieldName.toLowerCase();
    if (critical.some(f => lower.includes(f.toLowerCase()))) return 'critical';
    if (high.some(f => lower.includes(f.toLowerCase()))) return 'high';
    if (medium.some(f => lower.includes(f.toLowerCase()))) return 'medium';
    return 'low';
  }

  private addTokens(
    total: { prompt: number; completion: number; total: number },
    add: { prompt: number; completion: number; total: number }
  ): void {
    total.prompt += add.prompt;
    total.completion += add.completion;
    total.total += add.total;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton
export const aiContractComparisonService = new AIContractComparisonService();
export { AIContractComparisonService };
