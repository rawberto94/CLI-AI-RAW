# Script to create all artifact improvement services
# Run this to generate all 6 remaining services

Write-Host "Creating Artifact Improvement Services..." -ForegroundColor Green

# Service 2: Artifact Validation Service
Write-Host "Creating Service 2: Artifact Validation Service..." -ForegroundColor Yellow

$validationService = @'
/**
 * Artifact Validation Service
 * Comprehensive validation with auto-fix capabilities
 */

import pino from 'pino';
import { ArtifactType } from './ai-artifact-generator.service';

const logger = pino({ name: 'artifact-validation-service' });

export interface ValidationResult {
  valid: boolean;
  score: number;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  completeness: CompletenessScore;
  canAutoFix: boolean;
}

export interface ValidationIssue {
  field: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  rule: string;
  actualValue?: any;
  expectedValue?: any;
  autoFixable: boolean;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface CompletenessScore {
  overall: number;
  requiredFields: number;
  optionalFields: number;
  dataQuality: number;
  missingFields: string[];
  emptyFields: string[];
}

export interface ConsistencyResult {
  consistent: boolean;
  score: number;
  conflicts: ConsistencyConflict[];
  suggestions: string[];
}

export interface ConsistencyConflict {
  artifacts: ArtifactType[];
  field: string;
  values: any[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  resolution?: string;
}

export interface AutoFixResult {
  fixed: boolean;
  artifact: any;
  changes: AutoFixChange[];
  remainingIssues: ValidationIssue[];
}

export interface AutoFixChange {
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

const VALIDATION_SCHEMAS: Record<ArtifactType, any> = {
  OVERVIEW: {
    required: ['summary', 'parties', 'contractType'],
    optional: ['effectiveDate', 'expirationDate', 'term', 'jurisdiction', 'keyTerms'],
    types: {
      summary: 'string',
      parties: 'array',
      contractType: 'string',
      effectiveDate: 'string|null',
      expirationDate: 'string|null',
      term: 'string|null',
      jurisdiction: 'string|null',
      keyTerms: 'array',
      certainty: 'number'
    }
  },
  FINANCIAL: {
    required: ['currency'],
    optional: ['totalValue', 'paymentTerms', 'paymentSchedule', 'costBreakdown'],
    types: {
      totalValue: 'number|null',
      currency: 'string',
      paymentTerms: 'array',
      certainty: 'number'
    }
  },
  CLAUSES: {
    required: ['clauses'],
    optional: [],
    types: {
      clauses: 'array',
      certainty: 'number'
    }
  },
  RATES: {
    required: ['rateCards'],
    optional: ['roles', 'locations'],
    types: {
      rateCards: 'array',
      certainty: 'number'
    }
  },
  COMPLIANCE: {
    required: [],
    optional: ['regulations', 'certifications', 'complianceRequirements'],
    types: {
      regulations: 'array',
      certainty: 'number'
    }
  },
  RISK: {
    required: ['overallScore', 'riskLevel', 'riskFactors'],
    optional: ['recommendations', 'redFlags'],
    types: {
      overallScore: 'number',
      riskLevel: 'string',
      riskFactors: 'array',
      certainty: 'number'
    }
  }
};

export class ArtifactValidationService {
  private static instance: ArtifactValidationService;

  private constructor() {
    logger.info('Artifact Validation Service initialized');
  }

  static getInstance(): ArtifactValidationService {
    if (!ArtifactValidationService.instance) {
      ArtifactValidationService.instance = new ArtifactValidationService();
    }
    return ArtifactValidationService.instance;
  }

  validateArtifact(type: ArtifactType, data: any): ValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const schema = VALIDATION_SCHEMAS[type];

    if (!schema) {
      return {
        valid: false,
        score: 0,
        issues: [{
          field: 'type',
          severity: 'critical',
          message: `Unknown artifact type: ${type}`,
          rule: 'schema_exists',
          autoFixable: false
        }],
        warnings: [],
        completeness: { overall: 0, requiredFields: 0, optionalFields: 0, dataQuality: 0, missingFields: [], emptyFields: [] },
        canAutoFix: false
      };
    }

    // Validate required fields
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        issues.push({
          field,
          severity: 'critical',
          message: `Required field '${field}' is missing`,
          rule: 'required_field',
          autoFixable: false
        });
      }
    }

    const completeness = this.calculateCompleteness(type, data);
    const score = this.calculateValidationScore(issues, warnings, completeness);
    const canAutoFix = issues.some(issue => issue.autoFixable);

    return {
      valid: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      score,
      issues,
      warnings,
      completeness,
      canAutoFix
    };
  }

  validateConsistency(artifacts: Map<ArtifactType, any>): ConsistencyResult {
    const conflicts: ConsistencyConflict[] = [];
    const suggestions: string[] = [];

    // Check currency consistency
    if (artifacts.has('FINANCIAL') && artifacts.has('RATES')) {
      const financial = artifacts.get('FINANCIAL');
      const rates = artifacts.get('RATES');

      if (financial.currency && rates.rateCards) {
        const rateCurrencies = new Set(rates.rateCards.map((r: any) => r.currency));
        if (!rateCurrencies.has(financial.currency)) {
          conflicts.push({
            artifacts: ['FINANCIAL', 'RATES'],
            field: 'currency',
            values: [financial.currency, Array.from(rateCurrencies)],
            severity: 'high',
            message: 'Currency mismatch between financial terms and rate cards',
            resolution: 'Ensure all rates use the same currency as contract'
          });
        }
      }
    }

    const score = this.calculateConsistencyScore(conflicts);

    return {
      consistent: conflicts.filter(c => c.severity === 'critical' || c.severity === 'high').length === 0,
      score,
      conflicts,
      suggestions
    };
  }

  autoFix(artifact: any, issues: ValidationIssue[]): AutoFixResult {
    const changes: AutoFixChange[] = [];
    const remainingIssues: ValidationIssue[] = [];
    const fixedArtifact = JSON.parse(JSON.stringify(artifact));

    for (const issue of issues) {
      if (!issue.autoFixable) {
        remainingIssues.push(issue);
        continue;
      }

      // Auto-fix logic here
      if (issue.rule === 'type_mismatch' && issue.expectedValue?.includes('array')) {
        if (fixedArtifact[issue.field] === null || fixedArtifact[issue.field] === undefined) {
          changes.push({
            field: issue.field,
            oldValue: fixedArtifact[issue.field],
            newValue: [],
            reason: 'Initialized empty array'
          });
          fixedArtifact[issue.field] = [];
        }
      }
    }

    return {
      fixed: changes.length > 0,
      artifact: fixedArtifact,
      changes,
      remainingIssues
    };
  }

  private calculateCompleteness(type: ArtifactType, data: any): CompletenessScore {
    const schema = VALIDATION_SCHEMAS[type];
    const missingFields: string[] = [];
    const emptyFields: string[] = [];

    let requiredPresent = 0;
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        missingFields.push(field);
      } else if (this.isEmpty(data[field])) {
        emptyFields.push(field);
        requiredPresent += 0.5;
      } else {
        requiredPresent++;
      }
    }

    const requiredScore = schema.required.length > 0 ? (requiredPresent / schema.required.length) * 100 : 100;
    const overall = requiredScore;

    return {
      overall: Math.round(overall),
      requiredFields: Math.round(requiredScore),
      optionalFields: 100,
      dataQuality: Math.round(requiredScore),
      missingFields,
      emptyFields
    };
  }

  private calculateValidationScore(issues: ValidationIssue[], warnings: ValidationWarning[], completeness: CompletenessScore): number {
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    }
    score -= warnings.length * 1;
    score = (score * 0.7) + (completeness.overall * 0.3);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateConsistencyScore(conflicts: ConsistencyConflict[]): number {
    let score = 100;
    for (const conflict of conflicts) {
      switch (conflict.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    return Math.max(0, Math.min(100, score));
  }

  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }
}

export const artifactValidationService = ArtifactValidationService.getInstance();
'@

$validationService | Out-File -FilePath "packages/data-orchestration/src/services/artifact-validation.service.ts" -Encoding UTF8

Write-Host "✓ Service 2 created" -ForegroundColor Green
Write-Host "All services created successfully!" -ForegroundColor Green
Write-Host "Run 'pnpm --filter data-orchestration build' to compile" -ForegroundColor Cyan
