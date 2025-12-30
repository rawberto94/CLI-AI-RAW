import pino from 'pino';

const logger = pino({ name: 'artifact-quality-validator' });

export interface QualityScore {
  overall: number; // 0-1
  completeness: number; // 0-1
  accuracy: number; // 0-1
  consistency: number; // 0-1
  confidence: number; // 0-1
  issues: string[];
  recommendations: string[];
  passesThreshold: boolean;
}

export interface QualityThresholds {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  confidence: number;
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  overall: 0.7,
  completeness: 0.6,
  accuracy: 0.7,
  consistency: 0.65,
  confidence: 0.6,
};

/**
 * Validate artifact quality with self-critique
 */
export class ArtifactQualityValidator {
  private thresholds: QualityThresholds;

  constructor(thresholds?: Partial<QualityThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Validate artifact data quality
   */
  async validateArtifact(
    artifactType: string,
    artifactData: Record<string, any>,
    contractText: string
  ): Promise<QualityScore> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 1. Completeness Check
    const completeness = this.checkCompleteness(artifactType, artifactData, issues);

    // 2. Accuracy Check (anti-hallucination)
    const accuracy = this.checkAccuracy(artifactData, contractText, issues);

    // 3. Consistency Check
    const consistency = this.checkConsistency(artifactData, issues);

    // 4. Confidence Check
    const confidence = this.extractConfidence(artifactData);

    // Calculate overall score (weighted average)
    const overall =
      completeness * 0.3 +
      accuracy * 0.35 +
      consistency * 0.2 +
      confidence * 0.15;

    // Generate recommendations
    if (completeness < 0.7) {
      recommendations.push('Consider regenerating with expanded prompts for missing fields');
    }
    if (accuracy < 0.7) {
      recommendations.push('Review for hallucinations - verify all data against source text');
    }
    if (consistency < 0.7) {
      recommendations.push('Fix inconsistent data formats or values');
    }
    if (confidence < 0.7) {
      recommendations.push('Low confidence detected - consider human review');
    }

    const passesThreshold =
      overall >= this.thresholds.overall &&
      completeness >= this.thresholds.completeness &&
      accuracy >= this.thresholds.accuracy &&
      consistency >= this.thresholds.consistency &&
      confidence >= this.thresholds.confidence;

    logger.info({
      artifactType,
      overall: overall.toFixed(2),
      completeness: completeness.toFixed(2),
      accuracy: accuracy.toFixed(2),
      consistency: consistency.toFixed(2),
      confidence: confidence.toFixed(2),
      passesThreshold,
      issueCount: issues.length,
    }, '✓ Quality validation complete');

    return {
      overall,
      completeness,
      accuracy,
      consistency,
      confidence,
      issues,
      recommendations,
      passesThreshold,
    };
  }

  /**
   * Check completeness - are required fields present?
   */
  private checkCompleteness(
    artifactType: string,
    data: Record<string, any>,
    issues: string[]
  ): number {
    const requiredFields = this.getRequiredFields(artifactType);
    let present = 0;

    for (const field of requiredFields) {
      const value = this.getNestedValue(data, field);
      if (value !== null && value !== undefined && value !== '') {
        present++;
      } else {
        issues.push(`Missing required field: ${field}`);
      }
    }

    return requiredFields.length > 0 ? present / requiredFields.length : 1.0;
  }

  /**
   * Check accuracy - detect hallucinations
   */
  private checkAccuracy(
    data: Record<string, any>,
    contractText: string,
    issues: string[]
  ): number {
    let totalChecks = 0;
    let accurateChecks = 0;

    // Check if extractedFromText flags are properly set
    this.traverseObject(data, (key, value, path) => {
      if (typeof value === 'object' && value !== null) {
        totalChecks++;
        
        // Check for extractedFromText flag
        if ('extractedFromText' in value) {
          if (value.extractedFromText === true) {
            // Verify there's a source field
            if ('source' in value && value.source) {
              accurateChecks++;
            } else {
              issues.push(`Missing source for extracted data at ${path}`);
            }
          } else if (value.extractedFromText === false) {
            // Should have requiresHumanReview flag
            if ('requiresHumanReview' in value) {
              accurateChecks++;
            } else {
              issues.push(`Inferred data at ${path} should have requiresHumanReview flag`);
            }
          }
        }

        // Check for placeholder values (generic names)
        if ('value' in value && typeof value.value === 'string') {
          const val = value.value.toLowerCase();
          if (
            val.includes('placeholder') ||
            val.includes('client name') ||
            val.includes('vendor name') ||
            val.includes('company name') ||
            val.includes('[') && val.includes(']')
          ) {
            issues.push(`Potential placeholder value at ${path}: "${value.value}"`);
            // Check if properly flagged
            if (value.isPlaceholder === true) {
              accurateChecks++; // Properly flagged
            }
          } else {
            accurateChecks++;
          }
        }
      }
    });

    return totalChecks > 0 ? accurateChecks / totalChecks : 1.0;
  }

  /**
   * Check consistency - data format and logical consistency
   */
  private checkConsistency(
    data: Record<string, any>,
    issues: string[]
  ): number {
    let totalChecks = 0;
    let consistentChecks = 0;

    // Check date formats
    this.traverseObject(data, (key, value, path) => {
      if (key.toLowerCase().includes('date') && typeof value === 'string') {
        totalChecks++;
        // Check ISO date format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
        if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
          consistentChecks++;
        } else {
          issues.push(`Inconsistent date format at ${path}: ${value}`);
        }
      }

      // Check currency values
      if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('value')) {
        if (typeof value === 'number') {
          totalChecks++;
          if (value >= 0) {
            consistentChecks++;
          } else {
            issues.push(`Negative amount at ${path}: ${value}`);
          }
        }
      }

      // Check arrays are not empty when they should have data
      if (Array.isArray(value)) {
        totalChecks++;
        if (value.length > 0) {
          consistentChecks++;
        } else if (key.includes('clauses') || key.includes('risks') || key.includes('parties')) {
          // These should typically have data
          issues.push(`Empty array for ${key} at ${path}`);
        } else {
          consistentChecks++; // Empty is OK for optional arrays
        }
      }
    });

    return totalChecks > 0 ? consistentChecks / totalChecks : 1.0;
  }

  /**
   * Extract confidence score from artifact
   */
  private extractConfidence(data: Record<string, any>): number {
    // Look for certainty field
    if ('certainty' in data && typeof data.certainty === 'number') {
      return Math.min(1.0, Math.max(0.0, data.certainty));
    }

    // Calculate based on extractedFromText flags
    let totalFields = 0;
    let extractedFields = 0;

    this.traverseObject(data, (key, value) => {
      if (typeof value === 'object' && value !== null && 'extractedFromText' in value) {
        totalFields++;
        if (value.extractedFromText === true) {
          extractedFields++;
        }
      }
    });

    if (totalFields > 0) {
      return extractedFields / totalFields;
    }

    // Default confidence
    return 0.5;
  }

  /**
   * Get required fields for artifact type
   */
  private getRequiredFields(artifactType: string): string[] {
    const fieldMap: Record<string, string[]> = {
      OVERVIEW: ['summary', 'contractType', 'parties'],
      CLAUSES: ['clauses'],
      FINANCIAL: ['currency'],
      RISK: ['overallRisk', 'risks'],
      COMPLIANCE: ['checks'],
      OBLIGATIONS: ['obligations'],
      RENEWAL: ['renewalDate'],
      NEGOTIATION_POINTS: ['keyPoints'],
      AMENDMENTS: ['amendments'],
      CONTACTS: ['contacts'],
    };

    return fieldMap[artifactType] || [];
  }

  /**
   * Get nested value from object path
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Traverse object recursively
   */
  private traverseObject(
    obj: any,
    callback: (key: string, value: any, path: string) => void,
    path: string = ''
  ): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      callback(key, value, currentPath);

      if (typeof value === 'object' && value !== null) {
        this.traverseObject(value, callback, currentPath);
      }
    }
  }
}

/**
 * Self-critique: Ask AI to review its own output
 */
export async function selfCritiqueArtifact(
  artifactType: string,
  artifactData: Record<string, any>,
  contractText: string
): Promise<{
  issues: string[];
  suggestions: string[];
  confidence: number;
  shouldRegenerate: boolean;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not configured, skipping self-critique');
    return { issues: [], suggestions: [], confidence: 0.5, shouldRegenerate: false };
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });

    const critiquePrompt = `You are a quality control expert reviewing an AI-generated contract artifact.

Artifact Type: ${artifactType}
Generated Data: ${JSON.stringify(artifactData, null, 2)}

Contract Text Sample: ${contractText.substring(0, 3000)}

Review this artifact and identify:
1. Any hallucinated information (data not in the contract)
2. Missing important information
3. Logical inconsistencies
4. Data quality issues
5. Whether the artifact should be regenerated

Return JSON:
{
  "issues": ["List of specific problems"],
  "suggestions": ["Specific improvements"],
  "confidence": 0.85,
  "shouldRegenerate": false
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: critiquePrompt }],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const critique = JSON.parse(content);

    logger.info({
      artifactType,
      issueCount: critique.issues?.length || 0,
      confidence: critique.confidence,
      shouldRegenerate: critique.shouldRegenerate,
    }, '🔍 Self-critique complete');

    return {
      issues: critique.issues || [],
      suggestions: critique.suggestions || [],
      confidence: critique.confidence || 0.5,
      shouldRegenerate: critique.shouldRegenerate || false,
    };
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Self-critique failed');
    return { issues: [], suggestions: [], confidence: 0.5, shouldRegenerate: false };
  }
}
