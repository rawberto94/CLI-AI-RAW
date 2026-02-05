/**
 * Proactive Validation Agent
 * Validates data quality during extraction, preventing issues before they occur
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  ValidationInput,
  ValidationIssue,
  ValidationDecision,
  AgentAction,
} from './types';
import { logger } from '../utils/logger';

export class ProactiveValidationAgent extends BaseAgent {
  name = 'proactive-validation-agent';
  version = '1.0.0';
  capabilities = ['validation', 'quality-check', 'placeholder-detection'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    // Handle different input formats defensively
    const validationInput: ValidationInput = input.context?.partialData 
      ? input.context as ValidationInput
      : {
          // Build from artifacts if provided
          partialData: input.context?.artifacts?.reduce((acc: any, artifact: any) => {
            const data = artifact?.data;
            if (data && typeof data === 'object') {
              Object.assign(acc, data);
            }
            return acc;
          }, {}) || {},
          contractText: input.context?.contractText || '',
          artifactType: input.context?.artifactType || input.context?.contractType || 'unknown',
          confidence: input.context?.confidence ?? 0.8,
          ocrQuality: input.context?.ocrQuality,
        };

    // If no data to validate, return early success
    if (!validationInput.partialData || Object.keys(validationInput.partialData).length === 0) {
      return {
        success: true,
        data: {
          decision: 'continue' as const,
          reason: 'No data available for validation',
          confidence: 1.0,
          issues: [],
          overallCompleteness: 0,
        },
        actions: [],
        confidence: 1.0,
        reasoning: 'No partial data available for validation',
        metadata: {
          processingTime: 0,
        },
      };
    }

    const decision = await this.validateDuringExtraction(validationInput);

    const actions: AgentAction[] = [];

    // Generate actions based on decision
    if (decision.decision === 'retry_immediately') {
      actions.push({
        id: `retry-${Date.now()}`,
        type: 'retry',
        description: decision.reason,
        priority: 'high',
        automated: true,
        targetEntity: {
          type: 'artifact',
          id: validationInput.artifactType,
        },
        payload: {
          strategy: decision.suggestedStrategy,
        },
      });
    } else if (decision.decision === 'flag_for_review') {
      actions.push({
        id: `review-${Date.now()}`,
        type: 'request-human-review',
        description: `Quality issues detected: ${decision.issues.map(i => i.type).join(', ')}`,
        priority: 'high',
        automated: false,
        targetEntity: {
          type: 'contract',
          id: input.contractId,
        },
      });
    } else if (decision.decision === 'auto_fix') {
      // Create auto-fix actions for each fixable issue
      const fixableIssues = decision.issues.filter(i => i.autoFixable);
      for (const issue of fixableIssues) {
        actions.push({
          id: `fix-${issue.field}-${Date.now()}`,
          type: 'validate',
          description: `Auto-fix ${issue.type} in field ${issue.field}`,
          priority: 'medium',
          automated: true,
          targetEntity: {
            type: 'artifact',
            id: validationInput.artifactType,
          },
          payload: {
            field: issue.field,
            fixType: issue.suggestedAction,
          },
        });
      }
    }

    const reasoning = this.buildReasoningExplanation(decision);

    const startTime = input.metadata?.timestamp?.getTime?.() || Date.now();
    return {
      success: decision.decision !== 'retry_immediately',
      data: decision,
      actions,
      confidence: decision.confidence,
      reasoning,
      metadata: {
        processingTime: Date.now() - startTime,
      },
    };
  }

  protected getEventType(): 'validation_performed' {
    return 'validation_performed';
  }

  /**
   * Main validation logic
   */
  private async validateDuringExtraction(
    input: ValidationInput
  ): Promise<ValidationDecision> {
    const issues: ValidationIssue[] = [];

    // Check 1: Placeholder detection
    const placeholderIssues = this.detectPlaceholders(input.partialData);
    issues.push(...placeholderIssues);

    // Check 2: Party validation
    if (input.partialData.parties) {
      const partyIssues = await this.validateParties(
        input.partialData.parties as any,
        input.contractText
      );
      issues.push(...partyIssues);
    }

    // Check 3: Date consistency
    if (input.partialData.effectiveDate || input.partialData.expirationDate) {
      const dateIssues = this.validateDates(input.partialData);
      issues.push(...dateIssues);
    }

    // Check 4: Value ranges
    if (input.partialData.value) {
      const valueIssues = this.validateValues(input.partialData);
      issues.push(...valueIssues);
    }

    // Check 5: Confidence calibration
    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'high');
    const adjustedConfidence = this.calibrateConfidence(
      input.confidence,
      issues.length,
      criticalIssues.length,
      input.ocrQuality
    );

    // Determine decision
    let decision: ValidationDecision['decision'] = 'continue';
    let reason = 'Data quality acceptable, proceeding with extraction';
    let useAlternativeStrategy = false;
    let suggestedStrategy: string | undefined;

    if (criticalIssues.length > 0) {
      decision = 'retry_immediately';
      reason = `Critical issues detected: ${criticalIssues.map(i => i.type).join(', ')}`;
      useAlternativeStrategy = true;
      suggestedStrategy = 'use-focused-prompt';
    } else if (adjustedConfidence < 0.5) {
      decision = 'flag_for_review';
      reason = `Low confidence (${adjustedConfidence.toFixed(2)}) with ${issues.length} issues`;
    } else if (issues.some(i => i.autoFixable)) {
      decision = 'auto_fix';
      reason = 'Issues detected but can be automatically fixed';
    }

    return {
      decision,
      reason,
      confidence: adjustedConfidence,
      issues,
      useAlternativeStrategy,
      suggestedStrategy,
    };
  }

  /**
   * Detect placeholder text patterns
   */
  private detectPlaceholders(data: Partial<any>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const placeholderPatterns = [
      /\[.*?\]/g, // [placeholder]
      /\{.*?\}/g, // {placeholder}
      /___+/g, // ___
      /\.\.\./g, // ...
      /TBD/gi,
      /TO BE DETERMINED/gi,
      /PENDING/gi,
      /N\/A/gi,
      /NOT AVAILABLE/gi,
      /LOREM IPSUM/gi,
    ];

    const checkField = (fieldName: string, value: any) => {
      if (typeof value === 'string') {
        for (const pattern of placeholderPatterns) {
          if (pattern.test(value)) {
            issues.push({
              type: 'placeholder_detected',
              field: fieldName,
              severity: 'high',
              description: `Placeholder pattern detected in ${fieldName}: "${value}"`,
              suggestedAction: 'retry',
              autoFixable: false,
            });
            break;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        Object.keys(value).forEach(key => {
          checkField(`${fieldName}.${key}`, value[key]);
        });
      }
    };

    Object.keys(data).forEach(key => {
      checkField(key, data[key]);
    });

    return issues;
  }

  /**
   * Validate parties against contract text
   */
  private async validateParties(
    parties: any[],
    contractText: string
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const party of parties) {
      if (party.name && !this.findPartyInText(party.name, contractText)) {
        issues.push({
          type: 'party_mismatch',
          field: 'parties',
          severity: 'critical',
          description: `Party "${party.name}" not found in contract text`,
          suggestedAction: 'retry',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Find party name in contract text
   */
  private findPartyInText(partyName: string, text: string): boolean {
    const normalizedParty = partyName.toLowerCase().trim();
    const normalizedText = text.toLowerCase();

    // Exact match
    if (normalizedText.includes(normalizedParty)) {
      return true;
    }

    // Partial match (at least 70% of words)
    const partyWords = normalizedParty.split(/\s+/).filter(w => w.length > 2);
    const matchedWords = partyWords.filter(word => normalizedText.includes(word));
    
    return matchedWords.length / partyWords.length >= 0.7;
  }

  /**
   * Validate date consistency
   */
  private validateDates(data: Partial<any>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      const effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : null;
      const expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;

      if (effectiveDate && expirationDate) {
        if (effectiveDate >= expirationDate) {
          issues.push({
            type: 'date_inconsistency',
            field: 'effectiveDate',
            severity: 'critical',
            description: 'Effective date is after expiration date',
            suggestedAction: 'retry',
            autoFixable: false,
          });
        }

        // Check for unrealistic date ranges
        const daysDiff = Math.abs((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 3650) { // More than 10 years
          issues.push({
            type: 'date_inconsistency',
            field: 'expirationDate',
            severity: 'medium',
            description: `Contract duration exceeds 10 years (${Math.round(daysDiff / 365)} years)`,
            suggestedAction: 'flag',
            autoFixable: false,
          });
        }
      }

      // Check for dates in the future (for historical contracts)
      if (effectiveDate && effectiveDate > new Date()) {
        const daysInFuture = Math.abs((effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysInFuture > 365) {
          issues.push({
            type: 'date_inconsistency',
            field: 'effectiveDate',
            severity: 'medium',
            description: `Effective date is ${Math.round(daysInFuture)} days in the future`,
            suggestedAction: 'flag',
            autoFixable: false,
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'format_error',
        field: 'dates',
        severity: 'high',
        description: 'Invalid date format detected',
        suggestedAction: 'retry',
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * Validate value ranges
   */
  private validateValues(data: Partial<any>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data.value !== undefined) {
      const value = typeof data.value === 'number' ? data.value : parseFloat(data.value);

      if (isNaN(value)) {
        issues.push({
          type: 'format_error',
          field: 'value',
          severity: 'high',
          description: 'Contract value is not a valid number',
          suggestedAction: 'retry',
          autoFixable: false,
        });
      } else if (value < 0) {
        issues.push({
          type: 'value_out_of_range',
          field: 'value',
          severity: 'critical',
          description: 'Contract value cannot be negative',
          suggestedAction: 'retry',
          autoFixable: false,
        });
      } else if (value > 1000000000) { // Over $1B
        issues.push({
          type: 'value_out_of_range',
          field: 'value',
          severity: 'medium',
          description: `Unusually high contract value: $${value.toLocaleString()}`,
          suggestedAction: 'flag',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Calibrate confidence based on issues
   */
  private calibrateConfidence(
    baseConfidence: number,
    totalIssues: number,
    criticalIssues: number,
    ocrQuality: number = 0.8
  ): number {
    let adjusted = baseConfidence;

    // Reduce confidence for each issue
    adjusted -= totalIssues * 0.05;

    // Reduce more for critical issues
    adjusted -= criticalIssues * 0.15;

    // Factor in OCR quality
    adjusted *= ocrQuality;

    // Floor at 0
    return Math.max(0, adjusted);
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoningExplanation(decision: ValidationDecision): string {
    const points: string[] = [];

    points.push(`Validation Decision: ${decision.decision.toUpperCase()}`);
    points.push(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    
    if (decision.issues.length > 0) {
      points.push(`Issues Detected: ${decision.issues.length}`);
      
      const critical = decision.issues.filter(i => i.severity === 'critical');
      const high = decision.issues.filter(i => i.severity === 'high');
      
      if (critical.length > 0) {
        points.push(`  - Critical: ${critical.length} (${critical.map(i => i.type).join(', ')})`);
      }
      if (high.length > 0) {
        points.push(`  - High: ${high.length} (${high.map(i => i.type).join(', ')})`);
      }
    } else {
      points.push('No validation issues detected');
    }

    points.push(`Reasoning: ${decision.reason}`);

    if (decision.useAlternativeStrategy) {
      points.push(`Suggested Strategy: ${decision.suggestedStrategy}`);
    }

    return this.formatReasoning(points);
  }
}

// Export singleton instance
export const proactiveValidationAgent = new ProactiveValidationAgent();
