/**
 * AI Explainability Service
 * 
 * Provides transparency into AI extraction decisions:
 * - Shows source text for each extracted field
 * - Explains reasoning and confidence levels
 * - Highlights alternative interpretations
 * - Enables audit trails for compliance
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import OpenAI from 'openai';

const logger = createLogger('ai-explainability');

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractionExplanation {
  fieldName: string;
  extractedValue: any;
  confidence: number;
  sourceEvidence: SourceEvidence[];
  reasoning: string;
  alternatives?: AlternativeInterpretation[];
  warnings?: ExtractionWarning[];
}

export interface SourceEvidence {
  text: string;
  location: {
    pageNumber?: number;
    sectionName?: string;
    paragraphIndex?: number;
    characterRange?: { start: number; end: number };
  };
  relevanceScore: number;
  matchType: 'exact' | 'semantic' | 'inferred';
}

export interface AlternativeInterpretation {
  value: any;
  confidence: number;
  reasoning: string;
  sourceText?: string;
}

export interface ExtractionWarning {
  type: 'ambiguous' | 'conflicting' | 'missing_source' | 'low_confidence' | 'format_uncertainty';
  message: string;
  suggestion?: string;
}

export interface ExplainableArtifact {
  artifactType: string;
  contractId: string;
  generatedAt: Date;
  modelUsed: string;
  totalConfidence: number;
  fieldExplanations: Record<string, ExtractionExplanation>;
  overallReasoning: string;
  processingNotes: string[];
}

export interface ExplainabilityRequest {
  contractText: string;
  artifactType: string;
  extractedData: Record<string, any>;
  maxExplanationsPerField?: number;
  includeAlternatives?: boolean;
  includeSourceHighlighting?: boolean;
}

// =============================================================================
// PROMPT TEMPLATES
// =============================================================================

const EXPLAINABILITY_PROMPT = `You are an AI transparency expert. Your job is to explain how specific values were extracted from a contract.

For each extracted field, provide:
1. **Source Evidence**: The exact text that supports this extraction (with location if identifiable)
2. **Reasoning**: Why this interpretation is correct
3. **Confidence Level**: How certain you are (0.0-1.0)
4. **Alternatives**: Other possible interpretations, if any
5. **Warnings**: Any ambiguities or concerns

GUIDELINES:
- Be precise about source locations (section names, paragraph numbers if identifiable)
- Distinguish between exact matches, semantic matches, and inferred values
- Flag any conflicting information found
- If a value was derived from multiple sources, list all of them
- If information is missing or inferred, clearly state this

CONTRACT TEXT:
{contractText}

EXTRACTED DATA:
{extractedData}

Provide explanations in this JSON format:
{
  "fieldExplanations": {
    "[fieldName]": {
      "extractedValue": "the value",
      "confidence": 0.95,
      "sourceEvidence": [
        {
          "text": "exact quote from contract",
          "location": {
            "sectionName": "Payment Terms",
            "paragraphIndex": 3
          },
          "relevanceScore": 0.95,
          "matchType": "exact|semantic|inferred"
        }
      ],
      "reasoning": "explanation of why this value was extracted",
      "alternatives": [
        {
          "value": "alternative value",
          "confidence": 0.3,
          "reasoning": "why this could also be valid"
        }
      ],
      "warnings": [
        {
          "type": "ambiguous|conflicting|missing_source|low_confidence|format_uncertainty",
          "message": "description of the issue",
          "suggestion": "recommended action"
        }
      ]
    }
  },
  "overallReasoning": "high-level summary of the extraction process",
  "processingNotes": ["any relevant notes about the extraction"]
}`;

// =============================================================================
// EXPLAINABILITY SERVICE
// =============================================================================

export class AIExplainabilityService {
  private static instance: AIExplainabilityService;
  private openai: OpenAI | null = null;

  private constructor() {
    this.initializeClient();
  }

  static getInstance(): AIExplainabilityService {
    if (!AIExplainabilityService.instance) {
      AIExplainabilityService.instance = new AIExplainabilityService();
    }
    return AIExplainabilityService.instance;
  }

  private initializeClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  // ===========================================================================
  // MAIN EXPLAIN METHOD
  // ===========================================================================

  async explainExtraction(request: ExplainabilityRequest): Promise<ExplainableArtifact> {
    const startTime = Date.now();
    
    logger.info({
      artifactType: request.artifactType,
      fieldCount: Object.keys(request.extractedData).length,
    }, 'Starting extraction explanation');

    try {
      // For complex explanations, use AI
      const aiExplanation = await this.getAIExplanation(request);

      // Enhance with local source matching
      const enhancedExplanations = this.enhanceWithLocalMatching(
        aiExplanation.fieldExplanations,
        request.contractText,
        request.extractedData
      );

      return {
        artifactType: request.artifactType,
        contractId: '', // Set by caller
        generatedAt: new Date(),
        modelUsed: 'gpt-4o-mini',
        totalConfidence: this.calculateOverallConfidence(enhancedExplanations),
        fieldExplanations: enhancedExplanations,
        overallReasoning: aiExplanation.overallReasoning || 'Extraction completed using AI analysis',
        processingNotes: [
          ...aiExplanation.processingNotes || [],
          `Explanation generated in ${Date.now() - startTime}ms`,
        ],
      };
    } catch (error) {
      logger.error({ error }, 'Explainability generation failed');
      
      // Fallback to local-only explanation
      return this.generateLocalExplanation(request);
    }
  }

  // ===========================================================================
  // AI EXPLANATION
  // ===========================================================================

  private async getAIExplanation(request: ExplainabilityRequest): Promise<{
    fieldExplanations: Record<string, ExtractionExplanation>;
    overallReasoning: string;
    processingNotes: string[];
  }> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Truncate contract text if too long
    const maxLength = 12000;
    const truncatedText = request.contractText.length > maxLength
      ? request.contractText.substring(0, maxLength) + '\n...[truncated]...'
      : request.contractText;

    const prompt = EXPLAINABILITY_PROMPT
      .replace('{contractText}', truncatedText)
      .replace('{extractedData}', JSON.stringify(request.extractedData, null, 2));

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI transparency expert. Respond only with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    return {
      fieldExplanations: this.normalizeFieldExplanations(parsed.fieldExplanations || {}),
      overallReasoning: parsed.overallReasoning || '',
      processingNotes: parsed.processingNotes || [],
    };
  }

  private normalizeFieldExplanations(raw: any): Record<string, ExtractionExplanation> {
    const normalized: Record<string, ExtractionExplanation> = {};

    for (const [fieldName, data] of Object.entries(raw)) {
      const fieldData = data as any;
      normalized[fieldName] = {
        fieldName,
        extractedValue: fieldData.extractedValue,
        confidence: Math.min(1, Math.max(0, fieldData.confidence || 0.5)),
        sourceEvidence: (fieldData.sourceEvidence || []).map((s: any) => ({
          text: s.text || '',
          location: {
            pageNumber: s.location?.pageNumber,
            sectionName: s.location?.sectionName,
            paragraphIndex: s.location?.paragraphIndex,
            characterRange: s.location?.characterRange,
          },
          relevanceScore: s.relevanceScore || 0.5,
          matchType: s.matchType || 'semantic',
        })),
        reasoning: fieldData.reasoning || 'No reasoning provided',
        alternatives: fieldData.alternatives?.map((a: any) => ({
          value: a.value,
          confidence: a.confidence || 0.3,
          reasoning: a.reasoning || '',
          sourceText: a.sourceText,
        })),
        warnings: fieldData.warnings?.map((w: any) => ({
          type: w.type || 'low_confidence',
          message: w.message || '',
          suggestion: w.suggestion,
        })),
      };
    }

    return normalized;
  }

  // ===========================================================================
  // LOCAL MATCHING ENHANCEMENT
  // ===========================================================================

  private enhanceWithLocalMatching(
    aiExplanations: Record<string, ExtractionExplanation>,
    contractText: string,
    extractedData: Record<string, any>
  ): Record<string, ExtractionExplanation> {
    const enhanced: Record<string, ExtractionExplanation> = { ...aiExplanations };

    // Add explanations for fields not covered by AI
    for (const [fieldName, value] of Object.entries(extractedData)) {
      if (!enhanced[fieldName]) {
        enhanced[fieldName] = this.generateLocalFieldExplanation(
          fieldName,
          value,
          contractText
        );
      } else {
        // Enhance existing with additional source matching
        const additionalEvidence = this.findSourceEvidence(value, contractText);
        if (additionalEvidence.length > 0) {
          enhanced[fieldName].sourceEvidence = [
            ...enhanced[fieldName].sourceEvidence,
            ...additionalEvidence.filter(e => 
              !enhanced[fieldName].sourceEvidence.some(existing => 
                existing.text === e.text
              )
            ),
          ];
        }
      }
    }

    return enhanced;
  }

  private generateLocalFieldExplanation(
    fieldName: string,
    value: any,
    contractText: string
  ): ExtractionExplanation {
    const sourceEvidence = this.findSourceEvidence(value, contractText);
    const confidence = sourceEvidence.length > 0 ? 0.7 : 0.3;

    return {
      fieldName,
      extractedValue: value,
      confidence,
      sourceEvidence,
      reasoning: sourceEvidence.length > 0
        ? `Value found in contract text with ${sourceEvidence.length} source reference(s)`
        : 'Value was inferred or derived from context',
      alternatives: undefined,
      warnings: sourceEvidence.length === 0
        ? [{
            type: 'missing_source',
            message: 'Could not locate source text for this value',
            suggestion: 'Review extraction manually for accuracy',
          }]
        : undefined,
    };
  }

  private findSourceEvidence(value: any, contractText: string): SourceEvidence[] {
    const evidence: SourceEvidence[] = [];
    const searchValue = String(value).toLowerCase();

    if (!searchValue || searchValue.length < 3) {
      return evidence;
    }

    const textLower = contractText.toLowerCase();
    let searchIndex = 0;
    let matchCount = 0;

    while (matchCount < 3) {
      const foundIndex = textLower.indexOf(searchValue, searchIndex);
      if (foundIndex === -1) break;

      // Extract context around the match
      const contextStart = Math.max(0, foundIndex - 50);
      const contextEnd = Math.min(contractText.length, foundIndex + searchValue.length + 50);
      const contextText = contractText.substring(contextStart, contextEnd);

      evidence.push({
        text: contextText.trim(),
        location: {
          characterRange: { start: foundIndex, end: foundIndex + searchValue.length },
        },
        relevanceScore: 0.9,
        matchType: 'exact',
      });

      searchIndex = foundIndex + searchValue.length;
      matchCount++;
    }

    return evidence;
  }

  // ===========================================================================
  // FALLBACK LOCAL EXPLANATION
  // ===========================================================================

  private generateLocalExplanation(request: ExplainabilityRequest): ExplainableArtifact {
    const fieldExplanations: Record<string, ExtractionExplanation> = {};

    for (const [fieldName, value] of Object.entries(request.extractedData)) {
      fieldExplanations[fieldName] = this.generateLocalFieldExplanation(
        fieldName,
        value,
        request.contractText
      );
    }

    return {
      artifactType: request.artifactType,
      contractId: '',
      generatedAt: new Date(),
      modelUsed: 'local-matching',
      totalConfidence: this.calculateOverallConfidence(fieldExplanations),
      fieldExplanations,
      overallReasoning: 'Explanation generated using local text matching (AI unavailable)',
      processingNotes: ['Fallback mode: AI explanation unavailable'],
    };
  }

  private calculateOverallConfidence(explanations: Record<string, ExtractionExplanation>): number {
    const values = Object.values(explanations);
    if (values.length === 0) return 0;

    const sum = values.reduce((acc, exp) => acc + exp.confidence, 0);
    return sum / values.length;
  }

  // ===========================================================================
  // EXPLAIN SPECIFIC FIELD
  // ===========================================================================

  async explainField(
    contractText: string,
    fieldName: string,
    extractedValue: any
  ): Promise<ExtractionExplanation> {
    const request: ExplainabilityRequest = {
      contractText,
      artifactType: 'single-field',
      extractedData: { [fieldName]: extractedValue },
      maxExplanationsPerField: 5,
      includeAlternatives: true,
    };

    const result = await this.explainExtraction(request);
    return result.fieldExplanations[fieldName] || {
      fieldName,
      extractedValue,
      confidence: 0.5,
      sourceEvidence: [],
      reasoning: 'Unable to generate explanation',
    };
  }

  // ===========================================================================
  // AUDIT TRAIL
  // ===========================================================================

  generateAuditReport(artifact: ExplainableArtifact): string {
    const lines: string[] = [
      '# AI Extraction Audit Report',
      '',
      `**Artifact Type**: ${artifact.artifactType}`,
      `**Generated At**: ${artifact.generatedAt.toISOString()}`,
      `**Model Used**: ${artifact.modelUsed}`,
      `**Overall Confidence**: ${(artifact.totalConfidence * 100).toFixed(1)}%`,
      '',
      '## Field Extractions',
      '',
    ];

    for (const [fieldName, explanation] of Object.entries(artifact.fieldExplanations)) {
      lines.push(`### ${fieldName}`);
      lines.push(`- **Value**: \`${JSON.stringify(explanation.extractedValue)}\``);
      lines.push(`- **Confidence**: ${(explanation.confidence * 100).toFixed(1)}%`);
      lines.push(`- **Reasoning**: ${explanation.reasoning}`);
      
      if (explanation.sourceEvidence.length > 0) {
        lines.push('- **Source Evidence**:');
        for (const source of explanation.sourceEvidence) {
          lines.push(`  - "${source.text.substring(0, 100)}..." (${source.matchType})`);
        }
      }
      
      if (explanation.warnings?.length) {
        lines.push('- **⚠️ Warnings**:');
        for (const warning of explanation.warnings) {
          lines.push(`  - [${warning.type}] ${warning.message}`);
        }
      }
      
      lines.push('');
    }

    lines.push('## Processing Notes');
    for (const note of artifact.processingNotes) {
      lines.push(`- ${note}`);
    }

    return lines.join('\n');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const aiExplainabilityService = AIExplainabilityService.getInstance();
