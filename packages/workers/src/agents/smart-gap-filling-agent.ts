/**
 * Smart Gap Filling Agent
 * Intelligently fills missing fields using cross-artifact inference and targeted AI extraction
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  GapFillingInput,
  IdentifiedGap,
  FilledGap,
  GapFillingResult,
  AgentAction,
} from './types';
import { logger } from '../utils/logger';
import { openai } from '../lib/openai';

export class SmartGapFillingAgent extends BaseAgent {
  name = 'smart-gap-filling-agent';
  version = '1.0.0';
  capabilities = ['gap-filling', 'cross-artifact-inference', 'targeted-extraction'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const gapInput = input.context as GapFillingInput;
    const result = await this.fillMissingFields(gapInput);

    const actions: AgentAction[] = [];

    // Create actions for remaining gaps
    for (const gap of result.remainingGaps) {
      if (gap.importance === 'critical' || gap.importance === 'high') {
        actions.push({
          id: `gap-${gap.field}-${Date.now()}`,
          type: 'request-human-review',
          description: `Unable to auto-fill critical field: ${gap.field}`,
          priority: gap.importance === 'critical' ? 'urgent' : 'high',
          automated: false,
          targetEntity: {
            type: 'artifact',
            id: String(gapInput.artifact.id ?? ''),
          },
          payload: {
            field: gap.field,
            suggestions: gap.suggestions,
          },
        });
      }
    }

    // Create update action if gaps were filled
    if (result.filledGaps.length > 0) {
      actions.push({
        id: `update-artifact-${Date.now()}`,
        type: 'update-metadata',
        description: `Update artifact with ${result.filledGaps.length} filled fields`,
        priority: 'medium',
        automated: true,
        targetEntity: {
          type: 'artifact',
          id: String(gapInput.artifact.id ?? ''),
        },
        payload: {
          filledGaps: result.filledGaps,
        },
      });
    }

    const improvement = ((result.newCompleteness - result.originalCompleteness) * 100).toFixed(1);

    return {
      success: true,
      data: result,
      actions,
      confidence: result.confidence,
      reasoning: this.formatReasoning([
        `Original Completeness: ${(result.originalCompleteness * 100).toFixed(1)}%`,
        `New Completeness: ${(result.newCompleteness * 100).toFixed(1)}%`,
        `Improvement: +${improvement}%`,
        `Fields Filled: ${result.filledGaps.length}`,
        `Remaining Gaps: ${result.remainingGaps.length}`,
        '',
        'Filled Fields:',
        ...result.filledGaps.map(g => 
          `  - ${g.field}: ${g.source} (${(g.confidence * 100).toFixed(0)}% confidence)`
        ),
      ]),
      metadata: {
        processingTime: Date.now() - (input.metadata?.timestamp?.getTime() ?? Date.now()),
      },
    };
  }

  protected getEventType(): 'gap_filled' {
    return 'gap_filled';
  }

  /**
   * Main gap filling logic
   */
  private async fillMissingFields(
    input: GapFillingInput
  ): Promise<GapFillingResult> {
    const { artifact, allArtifacts, contractText, aggressiveMode, minimumCompleteness } = input;

    // Step 1: Identify gaps (more thorough in aggressive mode)
    const gaps = this.identifyGaps(artifact, aggressiveMode);
    const originalCompleteness = this.calculateCompleteness(artifact);

    const filledGaps: FilledGap[] = [];
    const remainingGaps: IdentifiedGap[] = [];

    // In aggressive mode, lower the confidence thresholds
    const crossArtifactConfidenceThreshold = aggressiveMode ? 0.65 : 0.8;
    const aiExtractionConfidenceThreshold = aggressiveMode ? 0.55 : 0.7;

    // Step 2: Try to fill each gap
    for (const gap of gaps) {
      let filled = false;

      // Strategy 1: Cross-artifact inference
      const inferredValue = await this.inferFromOtherArtifacts(
        gap.field,
        allArtifacts
      );

      if (inferredValue && inferredValue.confidence > crossArtifactConfidenceThreshold) {
        filledGaps.push({
          field: gap.field,
          value: inferredValue.value,
          source: 'cross_artifact_inference',
          confidence: inferredValue.confidence,
          reasoning: inferredValue.reasoning,
        });
        filled = true;
        continue;
      }

      // Strategy 2: Targeted AI extraction (use full text in aggressive mode)
      if (!filled && gap.fillability !== 'impossible') {
        const textToUse = aggressiveMode && contractText 
          ? contractText 
          : contractText?.slice(0, 8000) ?? '';
          
        const extracted = await this.targetedExtraction(
          gap.field,
          textToUse,
          String(artifact.type ?? ''),
          aggressiveMode
        );

        if (extracted && extracted.confidence > aiExtractionConfidenceThreshold) {
          filledGaps.push({
            field: gap.field,
            value: extracted.value,
            source: 'targeted_ai_extraction',
            confidence: extracted.confidence,
            reasoning: extracted.reasoning,
          });
          filled = true;
          continue;
        }
      }

      // Strategy 3: Metadata lookup
      if (!filled && input.contractMetadata) {
        const metadataValue = this.lookupInMetadata(gap.field, input.contractMetadata);
        
        if (metadataValue) {
          filledGaps.push({
            field: gap.field,
            value: metadataValue,
            source: 'metadata_lookup',
            confidence: 0.95,
            reasoning: 'Retrieved from contract metadata',
          });
          filled = true;
          continue;
        }
      }

      // Strategy 4 (Aggressive mode only): Context-aware inference
      if (!filled && aggressiveMode && contractText) {
        const contextInferred = await this.contextAwareInference(
          gap.field,
          contractText,
          allArtifacts
        );
        
        if (contextInferred && contextInferred.confidence > 0.5) {
          filledGaps.push({
            field: gap.field,
            value: contextInferred.value,
            source: 'context_inference',
            confidence: contextInferred.confidence,
            reasoning: contextInferred.reasoning,
          });
          filled = true;
          continue;
        }
      }

      // If still not filled, add to remaining gaps
      if (!filled) {
        remainingGaps.push(gap);
      }
    }

    // Calculate new completeness
    const enrichedArtifact = { ...artifact };
    for (const filled of filledGaps) {
      this.setNestedValue(enrichedArtifact, filled.field, filled.value);
    }
    const newCompleteness = this.calculateCompleteness(enrichedArtifact);

    // Overall confidence based on filled gaps
    const avgConfidence = filledGaps.length > 0
      ? filledGaps.reduce((sum, g) => sum + g.confidence, 0) / filledGaps.length
      : 1.0;

    // Check if we've met the minimum completeness threshold
    const targetCompleteness = minimumCompleteness ?? 0.85;
    const meetsTarget = newCompleteness >= targetCompleteness;

    return {
      originalCompleteness,
      newCompleteness,
      filledGaps,
      remainingGaps,
      confidence: avgConfidence,
      meetsTargetCompleteness: meetsTarget,
      targetCompleteness,
    };
  }

  /**
   * Context-aware inference for aggressive gap filling
   * Uses surrounding context and document patterns to infer missing values
   */
  private async contextAwareInference(
    field: string,
    contractText: string,
    allArtifacts: any[]
  ): Promise<{ value: any; confidence: number; reasoning: string } | null> {
    try {
      const prompt = `You are a contract analysis expert. Based on the full context of this contract, infer the most likely value for the missing field.

Field to infer: ${field}

Contract context (analyze for patterns, implicit information, industry standards):
${contractText.slice(0, 10000)}

Guidelines:
1. Look for implicit information that could indicate the value
2. Consider industry standards and common practices
3. Look for related terms that might indicate the value
4. If inferring dates, look for time-related clauses
5. If inferring values, look for financial context
6. Be conservative but provide best reasonable inference

Return JSON: { "value": inferred_value_or_null, "confidence": 0.0-1.0, "reasoning": "detailed explanation of inference" }
If you cannot make a reasonable inference, return: { "value": null, "confidence": 0, "reasoning": "explanation" }`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing contracts and inferring missing information from context.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      if (result.value && !this.isFieldEmpty(result.value) && result.confidence > 0.3) {
        return {
          value: result.value,
          confidence: result.confidence,
          reasoning: `Context inference: ${result.reasoning}`,
        };
      }

      return null;
    } catch (error) {
      logger.error({ error, field }, 'Context-aware inference failed');
      return null;
    }
  }

  /**
   * Identify gaps in artifact data
   */
  private identifyGaps(artifact: any, aggressiveMode: boolean = false): IdentifiedGap[] {
    const gaps: IdentifiedGap[] = [];

    // Define critical fields by artifact type (expanded for aggressive mode)
    const criticalFieldsByType: Record<string, string[]> = {
      OVERVIEW: ['parties', 'effectiveDate', 'expirationDate', 'contractValue', 'title', 'summary', 'contractType'],
      FINANCIAL: ['totalValue', 'paymentTerms', 'currency', 'paymentSchedule', 'fees'],
      OBLIGATIONS: ['obligations', 'deliverables', 'milestones'],
      CLAUSES: ['clauses'],
      RISK: ['riskScore', 'riskFactors', 'mitigationStrategies'],
      PARTIES: ['parties', 'roles', 'contactInfo'],
      TIMELINE: ['effectiveDate', 'expirationDate', 'milestones', 'renewalTerms'],
      DELIVERABLES: ['deliverables', 'acceptanceCriteria', 'timeline'],
      PRICING: ['pricing', 'rates', 'discounts', 'totalValue'],
    };

    // Additional fields to check in aggressive mode
    const additionalFieldsByType: Record<string, string[]> = {
      OVERVIEW: ['governingLaw', 'jurisdiction', 'terminationConditions', 'renewalTerms'],
      FINANCIAL: ['penalties', 'discounts', 'taxes', 'invoicingTerms'],
      OBLIGATIONS: ['performanceMetrics', 'serviceLevel', 'escalationPath'],
      CLAUSES: ['keyTerms', 'definitions', 'exhibits'],
      RISK: ['complianceRequirements', 'insuranceRequirements', 'liabilityLimits'],
    };

    let criticalFields = criticalFieldsByType[artifact.type] || [];
    
    // In aggressive mode, also check additional fields
    if (aggressiveMode) {
      const additionalFields = additionalFieldsByType[artifact.type] || [];
      criticalFields = [...criticalFields, ...additionalFields];
    }

    // Check each critical field
    for (const field of criticalFields) {
      const value = this.getNestedValue(artifact, field);
      
      if (this.isFieldEmpty(value)) {
        gaps.push({
          field,
          artifactType: artifact.type,
          importance: aggressiveMode ? 'high' : 'critical',
          fillability: this.assessFillability(field, artifact),
          suggestions: this.generateSuggestions(field, artifact),
        });
      }
    }

    // Check for low-quality extractions (placeholders, etc)
    this.findLowQualityFields(artifact, gaps, aggressiveMode);

    return gaps;
  }

  /**
   * Check if a field is empty or has low-quality data
   */
  private isFieldEmpty(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return true;
    }

    if (Array.isArray(value) && value.length === 0) {
      return true;
    }

    if (typeof value === 'string') {
      const lowQualityPatterns = [
        /^N\/A$/i,
        /^TBD$/i,
        /^PENDING$/i,
        /^NOT AVAILABLE$/i,
        /^\[.*\]$/,
        /^___+$/,
      ];

      return lowQualityPatterns.some(pattern => pattern.test(value.trim()));
    }

    return false;
  }

  /**
   * Find fields with low-quality data
   */
  private findLowQualityFields(artifact: any, gaps: IdentifiedGap[], aggressiveMode: boolean = false): void {
    const checkObject = (obj: any, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'string' && this.isFieldEmpty(value)) {
          gaps.push({
            field: fieldPath,
            artifactType: artifact.type,
            importance: aggressiveMode ? 'high' : 'medium',
            fillability: 'medium',
            suggestions: [`Re-extract ${fieldPath} from contract text`],
          });
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          checkObject(value, fieldPath);
        } else if (aggressiveMode && Array.isArray(value) && value.length === 0) {
          // In aggressive mode, flag empty arrays too
          gaps.push({
            field: fieldPath,
            artifactType: artifact.type,
            importance: 'medium',
            fillability: 'medium',
            suggestions: [`Extract ${fieldPath} items from contract text`],
          });
        }
      }
    };

    checkObject(artifact.data);
  }

  /**
   * Infer value from other artifacts
   */
  private async inferFromOtherArtifacts(
    field: string,
    artifacts: any[]
  ): Promise<{ value: any; confidence: number; reasoning: string } | null> {
    // Mapping of common field inference patterns
    const inferencePatterns: Record<string, (artifacts: any[]) => any> = {
      'effectiveDate': (arts) => {
        const overview = arts.find(a => a.type === 'OVERVIEW');
        return overview?.data?.effectiveDate;
      },
      'expirationDate': (arts) => {
        const overview = arts.find(a => a.type === 'OVERVIEW');
        return overview?.data?.expirationDate;
      },
      'parties': (arts) => {
        const overview = arts.find(a => a.type === 'OVERVIEW');
        return overview?.data?.parties;
      },
      'contractValue': (arts) => {
        // Try FINANCIAL first
        const financial = arts.find(a => a.type === 'FINANCIAL');
        if (financial?.data?.totalValue) return financial.data.totalValue;
        
        // Fall back to OVERVIEW
        const overview = arts.find(a => a.type === 'OVERVIEW');
        return overview?.data?.contractValue;
      },
      'currency': (arts) => {
        const financial = arts.find(a => a.type === 'FINANCIAL');
        return financial?.data?.currency;
      },
      'liabilityLimit': (arts) => {
        const clauses = arts.find(a => a.type === 'CLAUSES');
        const liabilityClause = clauses?.data?.clauses?.find(
          (c: any) => c.title?.toLowerCase().includes('liability')
        );
        
        if (liabilityClause) {
          // Extract amount from clause content
          const amountMatch = liabilityClause.content?.match(/\$[\d,]+(?:\.\d{2})?/);
          if (amountMatch) {
            return parseFloat(amountMatch[0].replace(/[$,]/g, ''));
          }
        }
        return null;
      },
    };

    const inferFunc = inferencePatterns[field];
    if (!inferFunc) return null;

    const value = inferFunc(artifacts);
    if (!value || this.isFieldEmpty(value)) return null;

    return {
      value,
      confidence: 0.95,
      reasoning: `Inferred from other artifacts (cross-reference)`,
    };
  }

  /**
   * Perform targeted AI extraction for a specific field
   */
  private async targetedExtraction(
    field: string,
    contractText: string,
    artifactType: string,
    aggressiveMode: boolean = false
  ): Promise<{ value: any; confidence: number; reasoning: string } | null> {
    try {
      const prompt = this.buildFieldSpecificPrompt(field, artifactType, aggressiveMode);
      
      // Use more text in aggressive mode
      const textLength = aggressiveMode ? 12000 : 8000;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: `Extract the following field from this contract:\n\nField: ${field}\n\nContract Text:\n${contractText.slice(0, textLength)}`,
          },
        ],
        temperature: aggressiveMode ? 0.2 : 0.1, // Slightly higher temp in aggressive mode for more creative extraction
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      if (result.value && !this.isFieldEmpty(result.value)) {
        return {
          value: result.value,
          confidence: result.confidence || 0.75,
          reasoning: result.reasoning || 'Extracted via targeted AI prompt',
        };
      }

      return null;
    } catch (error) {
      logger.error({ error, field }, 'Targeted extraction failed');
      return null;
    }
  }

  /**
   * Build field-specific extraction prompt
   */
  private buildFieldSpecificPrompt(field: string, artifactType: string, aggressiveMode: boolean = false): string {
    const basePrompts: Record<string, string> = {
      'effectiveDate': `Extract the contract effective date. Look for "effective date", "commencement date", "start date", or dates mentioned near the beginning. Return JSON: { "value": "YYYY-MM-DD", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'expirationDate': `Extract the contract expiration/termination date. Look for "expiration", "termination", "end date", or term duration clauses. Return JSON: { "value": "YYYY-MM-DD", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'parties': `Extract all contract parties with their roles. Look for signature blocks, "between...and", "parties" sections. Return JSON: { "value": [{"name": "Party Name", "role": "buyer|seller|service_provider|customer|etc"}], "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'contractValue': `Extract the total contract value/amount. Look for total price, contract amount, consideration, or fee sections. Return JSON: { "value": numeric_value, "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'paymentTerms': `Extract payment terms (e.g., "Net 30", "Monthly", "Upon delivery"). Look for payment, invoicing, or billing sections. Return JSON: { "value": "terms", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'currency': `Extract the contract currency (USD, EUR, GBP, etc). Look for currency symbols or explicit currency mentions. Return JSON: { "value": "currency_code", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'governingLaw': `Extract the governing law/jurisdiction. Look for "governed by", "jurisdiction", or "applicable law" clauses. Return JSON: { "value": "jurisdiction", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'terminationConditions': `Extract termination conditions. Look for termination clause, notice periods, and termination for cause/convenience. Return JSON: { "value": "conditions summary", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'renewalTerms': `Extract renewal terms. Look for auto-renewal, renewal notice, or term extension clauses. Return JSON: { "value": "renewal terms", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
    };
    
    const aggressiveHint = aggressiveMode 
      ? '\n\nIMPORTANT: Even if the information is not explicitly stated, try to infer it from context, related clauses, or industry standards. Provide your best reasonable interpretation with appropriate confidence level.'
      : '';

    const basePrompt = basePrompts[field] || 
      `Extract the field "${field}" from the contract. Return JSON: { "value": extracted_value, "confidence": 0.0-1.0, "reasoning": "explanation" }`;
    
    return basePrompt + aggressiveHint;
  }

  /**
   * Lookup value in contract metadata
   */
  private lookupInMetadata(field: string, metadata: any): any {
    // Direct field mapping
    const directMapping: Record<string, string> = {
      'effectiveDate': 'effectiveDate',
      'expirationDate': 'expirationDate',
      'contractValue': 'value',
      'currency': 'currency',
    };

    const metadataField = directMapping[field];
    if (metadataField && metadata[metadataField]) {
      return metadata[metadataField];
    }

    return null;
  }

  /**
   * Calculate artifact completeness
   */
  private calculateCompleteness(artifact: any): number {
    const allFields = this.getAllFields(artifact.data);
    const filledFields = allFields.filter(field => !this.isFieldEmpty(field.value));
    
    return allFields.length > 0 ? filledFields.length / allFields.length : 0;
  }

  /**
   * Get all fields in object
   */
  private getAllFields(obj: any, prefix: string = ''): Array<{ path: string; value: any }> {
    const fields: Array<{ path: string; value: any }> = [];

    if (!obj || typeof obj !== 'object') {
      return fields;
    }

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value)) {
        fields.push({ path, value });
      } else if (typeof value === 'object' && value !== null) {
        fields.push(...this.getAllFields(value, path));
      } else {
        fields.push({ path, value });
      }
    }

    return fields;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  /**
   * Assess how fillable a gap is
   */
  private assessFillability(field: string, artifact: any): IdentifiedGap['fillability'] {
    // Fields that are usually extractable
    const easyFields = ['effectiveDate', 'expirationDate', 'parties', 'contractValue'];
    if (easyFields.includes(field)) return 'easy';

    // Fields that require complex analysis
    const hardFields = ['riskScore', 'complianceStatus'];
    if (hardFields.includes(field)) return 'hard';

    return 'medium';
  }

  /**
   * Generate suggestions for filling a gap
   */
  private generateSuggestions(field: string, artifact: any): string[] {
    return [
      `Check other artifacts for cross-reference`,
      `Perform targeted AI extraction for "${field}"`,
      `Review contract metadata`,
      `Manual entry may be required`,
    ];
  }
}

// Export singleton instance
export const smartGapFillingAgent = new SmartGapFillingAgent();
