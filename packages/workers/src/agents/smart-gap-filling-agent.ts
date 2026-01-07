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
        processingTime: Date.now() - input.metadata!.timestamp.getTime(),
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
    const { artifact, allArtifacts, contractText } = input;

    // Step 1: Identify gaps
    const gaps = this.identifyGaps(artifact);
    const originalCompleteness = this.calculateCompleteness(artifact);

    const filledGaps: FilledGap[] = [];
    const remainingGaps: IdentifiedGap[] = [];

    // Step 2: Try to fill each gap
    for (const gap of gaps) {
      let filled = false;

      // Strategy 1: Cross-artifact inference
      const inferredValue = await this.inferFromOtherArtifacts(
        gap.field,
        allArtifacts
      );

      if (inferredValue && inferredValue.confidence > 0.8) {
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

      // Strategy 2: Targeted AI extraction
      if (!filled && gap.fillability !== 'impossible') {
        const extracted = await this.targetedExtraction(
          gap.field,
          contractText,
          String(artifact.type ?? '')
        );

        if (extracted && extracted.confidence > 0.7) {
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

    return {
      originalCompleteness,
      newCompleteness,
      filledGaps,
      remainingGaps,
      confidence: avgConfidence,
    };
  }

  /**
   * Identify gaps in artifact data
   */
  private identifyGaps(artifact: any): IdentifiedGap[] {
    const gaps: IdentifiedGap[] = [];

    // Define critical fields by artifact type
    const criticalFieldsByType: Record<string, string[]> = {
      OVERVIEW: ['parties', 'effectiveDate', 'expirationDate', 'contractValue'],
      FINANCIAL: ['totalValue', 'paymentTerms', 'currency'],
      OBLIGATIONS: ['obligations'],
      CLAUSES: ['clauses'],
      RISK: ['riskScore', 'riskFactors'],
    };

    const criticalFields = criticalFieldsByType[artifact.type] || [];

    // Check each critical field
    for (const field of criticalFields) {
      const value = this.getNestedValue(artifact, field);
      
      if (this.isFieldEmpty(value)) {
        gaps.push({
          field,
          artifactType: artifact.type,
          importance: 'critical',
          fillability: this.assessFillability(field, artifact),
          suggestions: this.generateSuggestions(field, artifact),
        });
      }
    }

    // Check for low-quality extractions (placeholders, etc)
    this.findLowQualityFields(artifact, gaps);

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
  private findLowQualityFields(artifact: any, gaps: IdentifiedGap[]): void {
    const checkObject = (obj: any, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'string' && this.isFieldEmpty(value)) {
          gaps.push({
            field: fieldPath,
            artifactType: artifact.type,
            importance: 'medium',
            fillability: 'medium',
            suggestions: [`Re-extract ${fieldPath} from contract text`],
          });
        } else if (typeof value === 'object' && value !== null) {
          checkObject(value, fieldPath);
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
    artifactType: string
  ): Promise<{ value: any; confidence: number; reasoning: string } | null> {
    try {
      const prompt = this.buildFieldSpecificPrompt(field, artifactType);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: `Extract the following field from this contract:\n\nField: ${field}\n\nContract Text:\n${contractText.slice(0, 8000)}`,
          },
        ],
        temperature: 0.1,
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
  private buildFieldSpecificPrompt(field: string, artifactType: string): string {
    const fieldPrompts: Record<string, string> = {
      'effectiveDate': `Extract the contract effective date. Return JSON: { "value": "YYYY-MM-DD", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'expirationDate': `Extract the contract expiration date. Return JSON: { "value": "YYYY-MM-DD", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'parties': `Extract all contract parties with their roles. Return JSON: { "value": [{"name": "Party Name", "role": "buyer|seller|etc"}], "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'contractValue': `Extract the total contract value. Return JSON: { "value": numeric_value, "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'paymentTerms': `Extract payment terms (e.g., "Net 30", "Monthly"). Return JSON: { "value": "terms", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
      'currency': `Extract the contract currency (USD, EUR, etc). Return JSON: { "value": "currency_code", "confidence": 0.0-1.0, "reasoning": "explanation" }`,
    };

    return fieldPrompts[field] || 
      `Extract the field "${field}" from the contract. Return JSON: { "value": extracted_value, "confidence": 0.0-1.0, "reasoning": "explanation" }`;
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
