/**
 * Artifact Validation Service
 * 
 * PRODUCTION-READY VALIDATION:
 * - Validates source grounding (all extracted values must have sources)
 * - Checks for hallucination indicators (extractedFromText flags)
 * - Enforces certainty thresholds for human review
 * - Validates data completeness and structure
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues?: ValidationIssue[];
  criticalIssues?: number;
  canAutoFix?: boolean;
  confidence?: number;
  completeness?: number;
  hallucinationRisk?: 'low' | 'medium' | 'high';
  requiresHumanReview?: boolean;
  reviewReasons?: string[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  type?: 'missing_source' | 'low_confidence' | 'potential_hallucination' | 'missing_field' | 'invalid_format' | 'placeholder_detected';
  suggestedFix?: string;
}

// Minimum certainty threshold - artifacts below this require human review
const CERTAINTY_THRESHOLD = 0.65; // Slightly lowered for better coverage

// Fields that MUST have source citations for production-ready artifacts
const SOURCE_REQUIRED_FIELDS = [
  'parties', 'totalValue', 'effectiveDate', 'expirationDate', 
  'rateCards', 'clauses', 'riskFactors', 'complianceRequirements',
  'termDuration', 'terminationDate', 'renewalTerms', 'obligations',
  'penalties', 'paymentTerms', 'liabilityCap', 'indemnification',
  'governingLaw', 'jurisdiction', 'confidentialityPeriod'
];

// Known placeholder/template party names that indicate unextracted or template values
const PLACEHOLDER_PARTY_NAMES = [
  'client name', 'company name', 'service provider name', 'vendor name',
  'contractor name', 'party a', 'party b', 'first party', 'second party',
  '[insert name]', '[company]', '[client]', '[vendor]', 'xxx', 'tbd',
  'your company', 'your name', 'provider name', 'buyer name', 'seller name',
  'licensor name', 'licensee name', 'employer name', 'employee name',
  'landlord name', 'tenant name', 'borrower name', 'lender name',
  'customer name', 'partner name', 'consultant name', 'agency name',
  'organization name', 'firm name', 'corporation name', 'llc name',
  'the company', 'the client', 'the vendor', 'the provider', 'the contractor',
  'insert company name', 'insert client name', 'enter name here', 'name here',
  'abc company', 'xyz corporation', 'acme inc', 'sample company', 'example corp'
];

// Quality scoring weights
const QUALITY_WEIGHTS = {
  sourceGrounding: 0.25,      // How well values cite sources
  partyValidation: 0.20,      // Party names are real, not placeholders
  completeness: 0.20,         // Required fields present
  consistency: 0.15,          // Values consistent across artifacts
  certainty: 0.20             // AI confidence in extraction
};

class ArtifactValidationService {
  private static instance: ArtifactValidationService;

  private constructor() {}

  public static getInstance(): ArtifactValidationService {
    if (!ArtifactValidationService.instance) {
      ArtifactValidationService.instance = new ArtifactValidationService();
    }
    return ArtifactValidationService.instance;
  }

  /**
   * Comprehensive artifact validation for production use
   */
  async validateArtifact(artifactType: string, data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const issues: ValidationIssue[] = [];
    const reviewReasons: string[] = [];

    // 1. Basic structure validation
    if (!data) {
      errors.push('Artifact data is required');
      issues.push({ field: 'data', message: 'Artifact data is required', severity: 'error', type: 'missing_field' });
    }

    // 2. Certainty/confidence validation
    const certainty = data?.certainty ?? data?.confidence ?? 0.5;
    if (certainty < CERTAINTY_THRESHOLD) {
      warnings.push(`Low certainty (${certainty.toFixed(2)}) - requires human review`);
      reviewReasons.push(`Certainty below threshold: ${certainty.toFixed(2)} < ${CERTAINTY_THRESHOLD}`);
      issues.push({
        field: 'certainty',
        message: `Certainty ${certainty.toFixed(2)} is below production threshold`,
        severity: 'warning',
        type: 'low_confidence'
      });
    }

    // 3. Source grounding validation (anti-hallucination check)
    const sourceValidation = this.validateSourceGrounding(data);
    issues.push(...sourceValidation.issues);
    if (sourceValidation.missingSourceCount > 0) {
      warnings.push(`${sourceValidation.missingSourceCount} field(s) missing source citations`);
      reviewReasons.push(`Missing source citations for: ${sourceValidation.fieldsWithoutSources.join(', ')}`);
    }

    // 4. Check for potential hallucinations (values without extractedFromText: true)
    const hallucinationCheck = this.checkHallucinationIndicators(data);
    issues.push(...hallucinationCheck.issues);
    if (hallucinationCheck.potentialHallucinations.length > 0) {
      warnings.push(`${hallucinationCheck.potentialHallucinations.length} potentially inferred value(s) detected`);
      reviewReasons.push(`Potential inferred values: ${hallucinationCheck.potentialHallucinations.join(', ')}`);
    }

    // 5. Type-specific validation
    const typeValidation = await this.validateByType(artifactType, data);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);
    issues.push(...(typeValidation.issues || []));

    // 5.5 Party name validation (detect placeholders/templates)
    const partyValidation = this.validatePartyNames(data);
    issues.push(...partyValidation.issues);
    if (partyValidation.hasPlaceholders) {
      warnings.push(`${partyValidation.placeholderCount} placeholder party name(s) detected`);
      reviewReasons.push(`Placeholder party names: ${partyValidation.placeholderNames.join(', ')}`);
    }

    // 6. Calculate completeness score
    const completeness = this.calculateCompleteness(artifactType, data);

    // 6.5 Calculate quality score
    const qualityScore = this.calculateQualityScore({
      sourceGrounding: 1 - (sourceValidation.missingSourceCount / Math.max(1, SOURCE_REQUIRED_FIELDS.length)),
      partyValidation: partyValidation.hasPlaceholders ? 0.3 : 1.0,
      completeness,
      consistency: 1.0, // TODO: Cross-artifact consistency check
      certainty
    });

    // 7. Determine hallucination risk level
    const hallucinationRisk = this.calculateHallucinationRisk(
      sourceValidation.missingSourceCount,
      hallucinationCheck.potentialHallucinations.length,
      certainty
    );

    const criticalIssues = issues.filter(i => i.severity === 'error').length;
    const requiresHumanReview = 
      certainty < CERTAINTY_THRESHOLD || 
      hallucinationRisk === 'high' ||
      hallucinationCheck.potentialHallucinations.length > 0 ||
      partyValidation.hasPlaceholders;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      issues,
      criticalIssues,
      canAutoFix: issues.some(i => i.suggestedFix !== undefined),
      confidence: certainty,
      completeness,
      hallucinationRisk,
      requiresHumanReview,
      reviewReasons: reviewReasons.length > 0 ? reviewReasons : undefined
    };
  }

  /**
   * Validate that extracted values have source citations
   */
  private validateSourceGrounding(data: any): {
    issues: ValidationIssue[];
    missingSourceCount: number;
    fieldsWithoutSources: string[];
  } {
    const issues: ValidationIssue[] = [];
    const fieldsWithoutSources: string[] = [];

    const checkForSource = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      // If this is a value object, check for source
      if (obj.value !== undefined && obj.source === undefined) {
        fieldsWithoutSources.push(path || 'root');
        issues.push({
          field: path,
          message: `Value extracted without source citation`,
          severity: 'warning',
          type: 'missing_source',
          suggestedFix: 'Add source quote from contract text'
        });
      }

      // Recursively check arrays and objects
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => checkForSource(item, `${path}[${idx}]`));
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          if (SOURCE_REQUIRED_FIELDS.includes(key)) {
            checkForSource(value, path ? `${path}.${key}` : key);
          }
        });
      }
    };

    checkForSource(data);

    return {
      issues,
      missingSourceCount: fieldsWithoutSources.length,
      fieldsWithoutSources
    };
  }

  /**
   * Validate party names for placeholders/template values
   */
  private validatePartyNames(data: any): {
    issues: ValidationIssue[];
    hasPlaceholders: boolean;
    placeholderCount: number;
    placeholderNames: string[];
  } {
    const issues: ValidationIssue[] = [];
    const placeholderNames: string[] = [];

    // Check parties array
    const parties = data?.parties || [];
    for (const party of parties) {
      const name = party?.name || party?.partyName || party;
      if (typeof name === 'string') {
        const normalizedName = name.toLowerCase().trim();
        
        // Check against known placeholders
        const isPlaceholder = PLACEHOLDER_PARTY_NAMES.some(placeholder => 
          normalizedName === placeholder || 
          normalizedName.includes(placeholder) ||
          placeholder.includes(normalizedName)
        );

        // Also check for suspicious patterns
        const hasPlaceholderPattern = 
          /^\[.*\]$/.test(name) ||           // [Any brackets]
          /^<.*>$/.test(name) ||              // <Any angle brackets>
          /^_{2,}$/.test(name) ||             // Just underscores
          /^\.{3,}$/.test(name) ||            // Just dots
          /^x{2,}$/i.test(name) ||            // Just x's
          /insert|enter|your|sample|example|placeholder|tbd|n\/a/i.test(name) ||
          name.length < 3;                     // Too short to be a real name

        if (isPlaceholder || hasPlaceholderPattern) {
          placeholderNames.push(name);
          issues.push({
            field: 'parties',
            message: `Placeholder party name detected: "${name}" - this may be a template document`,
            severity: 'warning',
            type: 'placeholder_detected',
            suggestedFix: 'This appears to be a template document. Party names should be replaced with actual company/person names.'
          });
        }
      }

      // Check if party has isPlaceholder flag set by AI
      if (party?.isPlaceholder === true) {
        const name = party?.name || party?.partyName || 'Unknown';
        if (!placeholderNames.includes(name)) {
          placeholderNames.push(name);
          issues.push({
            field: 'parties',
            message: `AI flagged party "${name}" as placeholder`,
            severity: 'warning',
            type: 'placeholder_detected'
          });
        }
      }
    }

    return {
      issues,
      hasPlaceholders: placeholderNames.length > 0,
      placeholderCount: placeholderNames.length,
      placeholderNames
    };
  }

  /**
   * Calculate overall quality score based on multiple factors
   */
  private calculateQualityScore(factors: {
    sourceGrounding: number;
    partyValidation: number;
    completeness: number;
    consistency: number;
    certainty: number;
  }): number {
    return (
      factors.sourceGrounding * QUALITY_WEIGHTS.sourceGrounding +
      factors.partyValidation * QUALITY_WEIGHTS.partyValidation +
      factors.completeness * QUALITY_WEIGHTS.completeness +
      factors.consistency * QUALITY_WEIGHTS.consistency +
      factors.certainty * QUALITY_WEIGHTS.certainty
    );
  }

  /**
   * Check for values that may be hallucinated (not marked as extracted from text)
   */
  private checkHallucinationIndicators(data: any): {
    issues: ValidationIssue[];
    potentialHallucinations: string[];
  } {
    const issues: ValidationIssue[] = [];
    const potentialHallucinations: string[] = [];

    const check = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      // Check for extractedFromText: false or requiresHumanReview: true
      if (obj.extractedFromText === false || obj.requiresHumanReview === true) {
        potentialHallucinations.push(path || 'root');
        issues.push({
          field: path,
          message: 'Value may be inferred or calculated (not extracted from text)',
          severity: 'warning',
          type: 'potential_hallucination'
        });
      }

      // Recursively check
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => check(item, `${path}[${idx}]`));
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'object') {
            check(value, path ? `${path}.${key}` : key);
          }
        });
      }
    };

    check(data);

    return { issues, potentialHallucinations };
  }

  /**
   * Type-specific validation rules
   */
  private async validateByType(type: string, data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const issues: ValidationIssue[] = [];

    switch (type) {
      case 'OVERVIEW':
        if (!data.parties || !Array.isArray(data.parties) || data.parties.length === 0) {
          warnings.push('No parties extracted');
        }
        if (!data.contractType) {
          warnings.push('Contract type not identified');
        }
        break;

      case 'FINANCIAL':
        if (data.totalValue?.value !== undefined && data.totalValue?.value < 0) {
          errors.push('Total value cannot be negative');
        }
        if (data.calculatedTotals && !data.calculatedTotals.every((c: any) => c.requiresHumanReview)) {
          warnings.push('Calculated financial values should be flagged for human review');
        }
        break;

      case 'CLAUSES':
        if (data.clauses) {
          const clausesWithoutSource = data.clauses.filter((c: any) => !c.source);
          if (clausesWithoutSource.length > 0) {
            warnings.push(`${clausesWithoutSource.length} clause(s) missing source references`);
          }
        }
        break;

      case 'RATES':
        if (data.calculatedRates && data.calculatedRates.length > 0) {
          const unflagged = data.calculatedRates.filter((r: any) => !r.requiresHumanReview);
          if (unflagged.length > 0) {
            warnings.push(`${unflagged.length} calculated rate(s) not flagged for human review`);
          }
        }
        break;

      case 'RISK':
        if (data.riskFactors) {
          const risksWithoutSource = data.riskFactors.filter((r: any) => !r.source);
          if (risksWithoutSource.length > 0) {
            warnings.push(`${risksWithoutSource.length} risk factor(s) missing source references`);
            issues.push({
              field: 'riskFactors',
              message: 'Risk factors should cite specific contract language',
              severity: 'warning',
              type: 'missing_source'
            });
          }
        }
        break;

      case 'COMPLIANCE':
        // Compliance requirements without source are high risk
        if (data.complianceRequirements) {
          const reqsWithoutSource = data.complianceRequirements.filter((r: any) => !r.source);
          if (reqsWithoutSource.length > 0) {
            warnings.push(`${reqsWithoutSource.length} compliance requirement(s) missing source - potential hallucination`);
          }
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings, issues };
  }

  /**
   * Calculate artifact completeness score
   */
  private calculateCompleteness(type: string, data: any): number {
    const requiredFields: Record<string, string[]> = {
      OVERVIEW: ['parties', 'contractType', 'effectiveDate'],
      FINANCIAL: ['currency'],
      CLAUSES: ['clauses'],
      RATES: ['rateCards'],
      RISK: ['overallScore', 'riskLevel'],
      COMPLIANCE: []
    };

    const required = requiredFields[type] || [];
    if (required.length === 0) return 1.0;

    const present = required.filter(field => {
      const value = data[field];
      return value !== null && value !== undefined && 
        (Array.isArray(value) ? value.length > 0 : true);
    });

    return present.length / required.length;
  }

  /**
   * Calculate hallucination risk level
   */
  private calculateHallucinationRisk(
    missingSourceCount: number,
    inferredCount: number,
    certainty: number
  ): 'low' | 'medium' | 'high' {
    const score = (missingSourceCount * 2) + (inferredCount * 3) + ((1 - certainty) * 5);
    
    if (score <= 2) return 'low';
    if (score <= 5) return 'medium';
    return 'high';
  }

  async validateStructure(artifact: any): Promise<ValidationResult> {
    return this.validateArtifact(artifact?.type || 'UNKNOWN', artifact?.data);
  }

  async validateContent(artifact: any): Promise<ValidationResult> {
    return this.validateArtifact(artifact?.type || 'UNKNOWN', artifact?.data);
  }

  async validateConsistency(artifact: any): Promise<ValidationResult> {
    return this.validateArtifact(artifact?.type || 'UNKNOWN', artifact?.data);
  }

  /**
   * Auto-fix common issues
   */
  async autoFix(artifact: any, issues: ValidationIssue[]): Promise<{ fixed: boolean; artifact: any; changes: string[] }> {
    const changes: string[] = [];
    let fixedArtifact = JSON.parse(JSON.stringify(artifact));

    for (const issue of issues) {
      if (issue.type === 'potential_hallucination' && !issue.field.includes('requiresHumanReview')) {
        // Add requiresHumanReview flag to inferred values
        const path = issue.field.split('.');
        let target = fixedArtifact;
        for (let i = 0; i < path.length - 1; i++) {
          target = target[path[i]];
        }
        if (target && typeof target === 'object') {
          target.requiresHumanReview = true;
          changes.push(`Added requiresHumanReview flag to ${issue.field}`);
        }
      }
    }

    return {
      fixed: changes.length > 0,
      artifact: fixedArtifact,
      changes
    };
  }
}

export const artifactValidationService = ArtifactValidationService.getInstance();
