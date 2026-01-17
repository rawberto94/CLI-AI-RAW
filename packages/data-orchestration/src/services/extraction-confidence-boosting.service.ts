/**
 * Extraction Confidence Boosting Service
 * 
 * Enhance extraction confidence through multiple strategies:
 * - Multi-model consensus
 * - Evidence chain building
 * - Confidence score calibration
 * - Human-in-the-loop integration
 * - Historical accuracy weighting
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';

// Types
export type BoostingStrategy = 
  | 'multi_model' 
  | 'evidence_chain' 
  | 'historical_calibration' 
  | 'cross_validation' 
  | 'ensemble';

export interface ExtractionResult {
  fieldName: string;
  value: unknown;
  confidence: number;
  source?: string; // Where in the document
  model?: string;
}

export interface EvidenceItem {
  text: string;
  location: string; // Section, page, etc.
  relevance: number; // 0-1
  supports: boolean; // Does it support or contradict
}

export interface BoostedExtraction {
  fieldName: string;
  value: unknown;
  originalConfidence: number;
  boostedConfidence: number;
  boostMethod: BoostingStrategy;
  evidence: EvidenceItem[];
  alternativeValues?: { value: unknown; confidence: number }[];
  requiresReview: boolean;
  reviewReason?: string;
}

export interface ModelVote {
  model: string;
  value: unknown;
  confidence: number;
  reasoning?: string;
}

export interface ConsensusResult {
  fieldName: string;
  consensusValue: unknown;
  consensusConfidence: number;
  votes: ModelVote[];
  agreement: number; // 0-1
  dissent?: { model: string; value: unknown; reason: string }[];
}

export interface HistoricalAccuracy {
  fieldName: string;
  accuracy: number; // Historical accuracy rate
  sampleSize: number;
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface BoostingConfig {
  strategies: BoostingStrategy[];
  minConfidenceThreshold: number; // Below this, always boost
  maxConfidenceThreshold: number; // Above this, skip boosting
  useHistoricalData: boolean;
  multiModelCount: number; // Number of models for consensus
  evidenceMinCount: number; // Minimum evidence items required
  humanReviewThreshold: number; // Flag for review below this
}

export interface BoostingResult {
  contractId: string;
  originalExtractions: ExtractionResult[];
  boostedExtractions: BoostedExtraction[];
  overallConfidenceIncrease: number;
  fieldsImproved: number;
  fieldsFlaggedForReview: number;
  processingTimeMs: number;
  strategies: BoostingStrategy[];
}

class ExtractionConfidenceBoostingService {
  private openai: OpenAI | null = null;
  private historicalAccuracy: Map<string, HistoricalAccuracy> = new Map();
  private calibrationFactors: Map<string, number> = new Map();

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
   * Boost confidence for extractions
   */
  async boostConfidence(
    contractId: string,
    contractText: string,
    extractions: ExtractionResult[],
    config: Partial<BoostingConfig> = {}
  ): Promise<BoostingResult> {
    const startTime = Date.now();

    const fullConfig: BoostingConfig = {
      strategies: ['evidence_chain', 'historical_calibration'],
      minConfidenceThreshold: 0.6,
      maxConfidenceThreshold: 0.95,
      useHistoricalData: true,
      multiModelCount: 2,
      evidenceMinCount: 2,
      humanReviewThreshold: 0.7,
      ...config,
    };

    const boostedExtractions: BoostedExtraction[] = [];
    let totalOriginalConfidence = 0;
    let totalBoostedConfidence = 0;

    for (const extraction of extractions) {
      totalOriginalConfidence += extraction.confidence;

      // Skip if confidence is already high enough
      if (extraction.confidence >= fullConfig.maxConfidenceThreshold) {
        boostedExtractions.push({
          fieldName: extraction.fieldName,
          value: extraction.value,
          originalConfidence: extraction.confidence,
          boostedConfidence: extraction.confidence,
          boostMethod: 'evidence_chain',
          evidence: [],
          requiresReview: false,
        });
        totalBoostedConfidence += extraction.confidence;
        continue;
      }

      // Apply boosting strategies
      let boosted = await this.applyBoostingStrategies(
        extraction,
        contractText,
        fullConfig
      );

      // Check if needs review
      if (boosted.boostedConfidence < fullConfig.humanReviewThreshold) {
        boosted.requiresReview = true;
        boosted.reviewReason = `Confidence ${(boosted.boostedConfidence * 100).toFixed(1)}% below threshold`;
      }

      boostedExtractions.push(boosted);
      totalBoostedConfidence += boosted.boostedConfidence;
    }

    const fieldsImproved = boostedExtractions.filter(
      b => b.boostedConfidence > b.originalConfidence
    ).length;

    const fieldsFlaggedForReview = boostedExtractions.filter(
      b => b.requiresReview
    ).length;

    return {
      contractId,
      originalExtractions: extractions,
      boostedExtractions,
      overallConfidenceIncrease: 
        extractions.length > 0 
          ? (totalBoostedConfidence - totalOriginalConfidence) / extractions.length 
          : 0,
      fieldsImproved,
      fieldsFlaggedForReview,
      processingTimeMs: Date.now() - startTime,
      strategies: fullConfig.strategies,
    };
  }

  /**
   * Apply multiple boosting strategies
   */
  private async applyBoostingStrategies(
    extraction: ExtractionResult,
    contractText: string,
    config: BoostingConfig
  ): Promise<BoostedExtraction> {
    let boostedConfidence = extraction.confidence;
    let evidence: EvidenceItem[] = [];
    let alternativeValues: { value: unknown; confidence: number }[] | undefined;
    let boostMethod: BoostingStrategy = config.strategies[0] || 'evidence_chain';

    // Strategy 1: Evidence chain building
    if (config.strategies.includes('evidence_chain')) {
      const evidenceResult = await this.buildEvidenceChain(
        extraction,
        contractText
      );
      evidence = evidenceResult.evidence;
      
      // Adjust confidence based on evidence
      const supportingEvidence = evidence.filter(e => e.supports);
      const contradictingEvidence = evidence.filter(e => !e.supports);
      
      if (supportingEvidence.length >= config.evidenceMinCount) {
        const avgRelevance = supportingEvidence.reduce((sum, e) => sum + e.relevance, 0) / supportingEvidence.length;
        boostedConfidence = Math.min(0.99, boostedConfidence + (avgRelevance * 0.2));
        boostMethod = 'evidence_chain';
      }
      
      if (contradictingEvidence.length > 0) {
        boostedConfidence = Math.max(0.1, boostedConfidence - (0.1 * contradictingEvidence.length));
      }
    }

    // Strategy 2: Historical calibration
    if (config.strategies.includes('historical_calibration') && config.useHistoricalData) {
      const historical = this.historicalAccuracy.get(extraction.fieldName);
      if (historical && historical.sampleSize >= 10) {
        // Calibrate based on historical accuracy
        const calibrationFactor = historical.accuracy / 0.8; // Normalize around 80% baseline
        boostedConfidence = Math.min(0.99, Math.max(0.1, boostedConfidence * calibrationFactor));
        
        if (historical.recentTrend === 'improving') {
          boostedConfidence = Math.min(0.99, boostedConfidence + 0.05);
        } else if (historical.recentTrend === 'declining') {
          boostedConfidence = Math.max(0.1, boostedConfidence - 0.05);
        }
        boostMethod = 'historical_calibration';
      }
    }

    // Strategy 3: Cross-validation (verify against related fields)
    if (config.strategies.includes('cross_validation')) {
      const crossValidation = await this.crossValidateExtraction(
        extraction,
        contractText
      );
      
      if (crossValidation.isConsistent) {
        boostedConfidence = Math.min(0.99, boostedConfidence + 0.1);
      } else {
        boostedConfidence = Math.max(0.1, boostedConfidence - 0.15);
        alternativeValues = crossValidation.alternativeValues;
      }
      boostMethod = 'cross_validation';
    }

    // Strategy 4: Multi-model consensus
    if (config.strategies.includes('multi_model')) {
      const consensus = await this.getMultiModelConsensus(
        extraction,
        contractText,
        config.multiModelCount
      );
      
      if (consensus.agreement >= 0.8) {
        boostedConfidence = Math.min(0.99, Math.max(boostedConfidence, consensus.consensusConfidence));
        if (consensus.consensusValue !== extraction.value) {
          alternativeValues = [{ value: consensus.consensusValue, confidence: consensus.consensusConfidence }];
        }
      } else {
        // Low agreement suggests uncertainty
        boostedConfidence = Math.max(0.1, boostedConfidence - (0.2 * (1 - consensus.agreement)));
        alternativeValues = consensus.votes.map(v => ({ value: v.value, confidence: v.confidence }));
      }
      boostMethod = 'multi_model';
    }

    // Strategy 5: Ensemble (combine all strategies)
    if (config.strategies.includes('ensemble')) {
      // Already applied above strategies, now ensemble the result
      boostMethod = 'ensemble';
    }

    return {
      fieldName: extraction.fieldName,
      value: extraction.value,
      originalConfidence: extraction.confidence,
      boostedConfidence: Math.round(boostedConfidence * 1000) / 1000,
      boostMethod,
      evidence,
      alternativeValues,
      requiresReview: false,
    };
  }

  /**
   * Build evidence chain for an extraction
   */
  private async buildEvidenceChain(
    extraction: ExtractionResult,
    contractText: string
  ): Promise<{ evidence: EvidenceItem[] }> {
    const openai = this.getOpenAI();

    const prompt = `Find evidence in this contract that supports or contradicts the extracted value.

EXTRACTED FIELD: ${extraction.fieldName}
EXTRACTED VALUE: ${JSON.stringify(extraction.value)}

CONTRACT TEXT:
${contractText.substring(0, 12000)}

Find 2-5 pieces of evidence. For each, provide:
- text: the exact quote from the contract
- location: where in the contract (section name or description)
- relevance: 0-1 how relevant this evidence is
- supports: true if it supports the value, false if it contradicts

Return as JSON with "evidence" array.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return { evidence: parsed.evidence || [] };
    } catch {
      return { evidence: [] };
    }
  }

  /**
   * Cross-validate extraction against related fields
   */
  private async crossValidateExtraction(
    extraction: ExtractionResult,
    contractText: string
  ): Promise<{ isConsistent: boolean; alternativeValues?: { value: unknown; confidence: number }[] }> {
    const openai = this.getOpenAI();

    const prompt = `Cross-validate this extracted value by checking related information in the contract.

FIELD: ${extraction.fieldName}
EXTRACTED VALUE: ${JSON.stringify(extraction.value)}

CONTRACT TEXT:
${contractText.substring(0, 10000)}

Check if this value is consistent with:
1. Other related fields or values mentioned
2. The overall context of the contract
3. Standard formats and expectations

Return JSON with:
- isConsistent: boolean
- reasoning: why consistent or not
- alternativeValues: if inconsistent, what the correct value might be (array of {value, confidence})`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        isConsistent: parsed.isConsistent ?? true,
        alternativeValues: parsed.alternativeValues,
      };
    } catch {
      return { isConsistent: true };
    }
  }

  /**
   * Get consensus from multiple models
   */
  private async getMultiModelConsensus(
    extraction: ExtractionResult,
    contractText: string,
    modelCount: number
  ): Promise<ConsensusResult> {
    const openai = this.getOpenAI();
    const models = ['gpt-4o', 'gpt-4o-mini'];
    const selectedModels = models.slice(0, Math.min(modelCount, models.length));

    const prompt = `Extract the value for this field from the contract:

FIELD: ${extraction.fieldName}

CONTRACT TEXT:
${contractText.substring(0, 8000)}

Return JSON with:
- value: the extracted value
- confidence: 0-1 confidence score
- reasoning: brief explanation`;

    const votes: ModelVote[] = [];

    // Query multiple models
    for (const model of selectedModels) {
      try {
        const response = await openai.chat.completions.create({
          model: model as 'gpt-4o' | 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const content = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);

        votes.push({
          model,
          value: parsed.value,
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning,
        });
      } catch {
        // Skip this model on error
      }
    }

    // Calculate consensus
    const valueGroups = new Map<string, ModelVote[]>();
    for (const vote of votes) {
      const key = JSON.stringify(vote.value);
      if (!valueGroups.has(key)) {
        valueGroups.set(key, []);
      }
      valueGroups.get(key)!.push(vote);
    }

    // Find majority
    let maxGroup: ModelVote[] = [];
    for (const group of valueGroups.values()) {
      if (group.length > maxGroup.length) {
        maxGroup = group;
      }
    }

    const agreement = votes.length > 0 ? maxGroup.length / votes.length : 0;
    const avgConfidence = maxGroup.length > 0
      ? maxGroup.reduce((sum, v) => sum + v.confidence, 0) / maxGroup.length
      : 0.5;

    return {
      fieldName: extraction.fieldName,
      consensusValue: maxGroup[0]?.value ?? extraction.value,
      consensusConfidence: avgConfidence,
      votes,
      agreement,
      dissent: votes
        .filter(v => JSON.stringify(v.value) !== JSON.stringify(maxGroup[0]?.value))
        .map(v => ({ model: v.model, value: v.value, reason: v.reasoning || '' })),
    };
  }

  /**
   * Record actual outcome for calibration
   */
  recordOutcome(
    fieldName: string,
    extractedValue: unknown,
    actualValue: unknown,
    wasCorrect: boolean
  ): void {
    const existing = this.historicalAccuracy.get(fieldName);
    
    if (existing) {
      // Update running accuracy
      const newSampleSize = existing.sampleSize + 1;
      const newAccuracy = 
        (existing.accuracy * existing.sampleSize + (wasCorrect ? 1 : 0)) / newSampleSize;
      
      // Determine trend (compare to previous)
      let trend: 'improving' | 'stable' | 'declining' = existing.recentTrend;
      if (newAccuracy > existing.accuracy + 0.02) {
        trend = 'improving';
      } else if (newAccuracy < existing.accuracy - 0.02) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }

      this.historicalAccuracy.set(fieldName, {
        fieldName,
        accuracy: newAccuracy,
        sampleSize: newSampleSize,
        recentTrend: trend,
      });
    } else {
      this.historicalAccuracy.set(fieldName, {
        fieldName,
        accuracy: wasCorrect ? 1.0 : 0.0,
        sampleSize: 1,
        recentTrend: 'stable',
      });
    }
  }

  /**
   * Get historical accuracy for a field
   */
  getHistoricalAccuracy(fieldName: string): HistoricalAccuracy | undefined {
    return this.historicalAccuracy.get(fieldName);
  }

  /**
   * Get all historical accuracy data
   */
  getAllHistoricalAccuracy(): HistoricalAccuracy[] {
    return Array.from(this.historicalAccuracy.values());
  }

  /**
   * Batch boost for multiple contracts
   */
  async batchBoost(
    contracts: { contractId: string; contractText: string; extractions: ExtractionResult[] }[],
    config: Partial<BoostingConfig> = {}
  ): Promise<BoostingResult[]> {
    const results: BoostingResult[] = [];

    for (const contract of contracts) {
      const result = await this.boostConfidence(
        contract.contractId,
        contract.contractText,
        contract.extractions,
        config
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Get fields that need human review
   */
  getFieldsForReview(result: BoostingResult): BoostedExtraction[] {
    return result.boostedExtractions.filter(e => e.requiresReview);
  }

  /**
   * Apply human correction and update calibration
   */
  applyCorrection(
    fieldName: string,
    originalValue: unknown,
    correctedValue: unknown
  ): void {
    const wasCorrect = JSON.stringify(originalValue) === JSON.stringify(correctedValue);
    this.recordOutcome(fieldName, originalValue, correctedValue, wasCorrect);
  }
}

// Export singleton
export const extractionConfidenceBoostingService = new ExtractionConfidenceBoostingService();
export { ExtractionConfidenceBoostingService };
