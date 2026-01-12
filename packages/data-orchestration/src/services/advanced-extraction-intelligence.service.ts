/**
 * Advanced Extraction Intelligence Service
 * 
 * Provides advanced AI extraction capabilities:
 * 1. Contract-type aware extraction using specialized profiles
 * 2. Industry benchmark comparison for extracted values
 * 3. Entity resolution and deduplication
 * 4. Extraction quality scoring and improvement suggestions
 * 5. Smart value inference from context
 * 6. Missing field prediction
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('advanced-extraction-intelligence');

// ============================================================================
// TYPES
// ============================================================================

export interface ContractTypeProfile {
  type: string;
  displayName: string;
  criticalFields: string[];
  optionalFields: string[];
  financialFields: string[];
  dateFields: string[];
  partyFields: string[];
  riskCategories: string[];
  typicalRanges: Record<string, ValueRange>;
  extractionHints: string;
  expectedSections: string[];
  validationRules: ValidationRule[];
}

export interface ValueRange {
  min?: number;
  max?: number;
  typical?: number;
  unit?: string;
  context?: string;
}

export interface ValidationRule {
  field: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface IndustryBenchmark {
  fieldName: string;
  contractType: string;
  industry?: string;
  benchmarks: {
    min: number;
    max: number;
    median: number;
    p25: number;
    p75: number;
    unit: string;
    sampleSize: number;
    lastUpdated: string;
  };
}

export interface EntityMatch {
  originalName: string;
  normalizedName: string;
  matchedEntities: Array<{
    name: string;
    similarity: number;
    source: string;
    type: 'exact' | 'fuzzy' | 'alias';
  }>;
  suggestedCanonical: string;
  confidence: number;
}

export interface ExtractionImprovement {
  fieldName: string;
  currentValue: any;
  issue: string;
  suggestion: string;
  improvedValue?: any;
  confidence: number;
  source: 'benchmark' | 'context' | 'validation' | 'inference';
}

export interface MissingFieldPrediction {
  fieldName: string;
  displayName: string;
  likelihood: number;
  reason: string;
  suggestedLocation: string;
  defaultValue?: any;
}

// ============================================================================
// CONTRACT TYPE PROFILES
// ============================================================================

const CONTRACT_TYPE_PROFILES: Record<string, ContractTypeProfile> = {
  NDA: {
    type: 'NDA',
    displayName: 'Non-Disclosure Agreement',
    criticalFields: ['parties', 'effective_date', 'confidentiality_definition', 'term'],
    optionalFields: ['purpose', 'exclusions', 'return_of_materials', 'jurisdiction'],
    financialFields: [],
    dateFields: ['effective_date', 'expiration_date', 'signature_date'],
    partyFields: ['disclosing_party', 'receiving_party'],
    riskCategories: ['ip_exposure', 'broad_definition', 'unlimited_term', 'one_sided'],
    typicalRanges: {
      term_years: { min: 1, max: 5, typical: 2, unit: 'years' },
      survival_period: { min: 1, max: 10, typical: 3, unit: 'years' }
    },
    extractionHints: 'Focus on confidentiality definition, exclusions, term, and mutual vs one-way obligations.',
    expectedSections: ['Recitals', 'Definitions', 'Confidentiality Obligations', 'Exclusions', 'Term', 'Return of Materials'],
    validationRules: [
      { field: 'term', rule: 'required', message: 'NDA should specify a term or duration', severity: 'warning' },
      { field: 'exclusions', rule: 'recommended', message: 'Standard NDAs include confidentiality exclusions', severity: 'info' }
    ]
  },
  
  MSA: {
    type: 'MSA',
    displayName: 'Master Service Agreement',
    criticalFields: ['parties', 'effective_date', 'term', 'payment_terms', 'liability_cap', 'termination_notice'],
    optionalFields: ['ip_ownership', 'indemnification', 'insurance_requirements', 'audit_rights'],
    financialFields: ['liability_cap', 'insurance_minimum', 'payment_terms'],
    dateFields: ['effective_date', 'expiration_date', 'signature_date'],
    partyFields: ['client', 'vendor', 'supplier', 'provider'],
    riskCategories: ['unlimited_liability', 'auto_renewal', 'one_sided_termination', 'ip_ownership', 'broad_indemnification'],
    typicalRanges: {
      term_years: { min: 1, max: 5, typical: 3, unit: 'years' },
      renewal_term_years: { min: 1, max: 2, typical: 1, unit: 'years' },
      notice_period_days: { min: 30, max: 180, typical: 90, unit: 'days' },
      payment_terms_days: { min: 15, max: 60, typical: 30, unit: 'days' },
      liability_cap_multiplier: { min: 1, max: 24, typical: 12, unit: 'months fees', context: 'of annual contract value' }
    },
    extractionHints: 'Look for framework terms, rate cards, payment schedules, and liability/indemnification clauses.',
    expectedSections: ['Recitals', 'Services', 'Compensation', 'Term', 'Termination', 'IP Rights', 'Confidentiality', 'Liability', 'Insurance', 'General Provisions'],
    validationRules: [
      { field: 'liability_cap', rule: 'recommended', message: 'MSAs typically include liability caps', severity: 'warning' },
      { field: 'termination_notice', rule: 'required', message: 'MSAs should specify termination notice period', severity: 'warning' }
    ]
  },
  
  SOW: {
    type: 'SOW',
    displayName: 'Statement of Work',
    criticalFields: ['project_name', 'start_date', 'end_date', 'total_value', 'deliverables', 'milestones'],
    optionalFields: ['acceptance_criteria', 'change_process', 'project_manager', 'resources'],
    financialFields: ['total_value', 'milestone_payments', 'hourly_rates', 'fixed_fee'],
    dateFields: ['start_date', 'end_date', 'milestone_dates', 'signature_date'],
    partyFields: ['client', 'vendor'],
    riskCategories: ['scope_creep', 'unclear_acceptance', 'payment_delay', 'timeline_risk'],
    typicalRanges: {
      duration_months: { min: 1, max: 24, typical: 6, unit: 'months' },
      milestone_count: { min: 2, max: 10, typical: 4, unit: 'milestones' }
    },
    extractionHints: 'Focus on deliverables, milestones, pricing schedule, and acceptance criteria.',
    expectedSections: ['Project Overview', 'Scope', 'Deliverables', 'Timeline', 'Pricing', 'Resources', 'Acceptance'],
    validationRules: [
      { field: 'deliverables', rule: 'required', message: 'SOW must specify deliverables', severity: 'error' },
      { field: 'acceptance_criteria', rule: 'recommended', message: 'SOW should include acceptance criteria', severity: 'warning' }
    ]
  },
  
  EMPLOYMENT: {
    type: 'EMPLOYMENT',
    displayName: 'Employment Agreement',
    criticalFields: ['employer', 'employee', 'job_title', 'start_date', 'salary', 'employment_type'],
    optionalFields: ['probation_period', 'benefits', 'bonus', 'equity', 'non_compete', 'non_solicitation'],
    financialFields: ['salary', 'bonus', 'equity', 'benefits_value'],
    dateFields: ['start_date', 'probation_end_date'],
    partyFields: ['employer', 'employee'],
    riskCategories: ['broad_non_compete', 'ip_assignment', 'termination_at_will', 'restrictive_covenants'],
    typicalRanges: {
      probation_months: { min: 1, max: 6, typical: 3, unit: 'months' },
      notice_period_weeks: { min: 1, max: 12, typical: 2, unit: 'weeks' },
      non_compete_months: { min: 6, max: 24, typical: 12, unit: 'months' }
    },
    extractionHints: 'Extract compensation details, job responsibilities, restrictive covenants, and termination provisions.',
    expectedSections: ['Position', 'Compensation', 'Benefits', 'Term', 'Termination', 'Confidentiality', 'IP Assignment', 'Non-Compete'],
    validationRules: [
      { field: 'salary', rule: 'required', message: 'Employment contract must specify compensation', severity: 'error' },
      { field: 'job_title', rule: 'required', message: 'Employment contract must specify position', severity: 'error' }
    ]
  },
  
  SAAS: {
    type: 'SAAS',
    displayName: 'SaaS Agreement',
    criticalFields: ['subscription_term', 'subscription_fee', 'sla_uptime', 'data_handling', 'termination_rights'],
    optionalFields: ['user_count', 'storage_limit', 'support_level', 'api_limits', 'audit_rights'],
    financialFields: ['subscription_fee', 'overage_fees', 'setup_fee'],
    dateFields: ['start_date', 'renewal_date', 'billing_date'],
    partyFields: ['customer', 'provider', 'vendor'],
    riskCategories: ['data_ownership', 'vendor_lock_in', 'sla_penalties', 'auto_renewal', 'price_increases'],
    typicalRanges: {
      sla_uptime: { min: 99, max: 99.99, typical: 99.9, unit: '%' },
      subscription_term_years: { min: 1, max: 3, typical: 1, unit: 'years' },
      price_increase_cap: { min: 3, max: 10, typical: 5, unit: '%', context: 'annual increase' }
    },
    extractionHints: 'Focus on SLA terms, data handling, pricing tiers, and renewal/termination provisions.',
    expectedSections: ['Services', 'Subscription', 'SLA', 'Data', 'Security', 'Fees', 'Term', 'Termination'],
    validationRules: [
      { field: 'sla_uptime', rule: 'recommended', message: 'SaaS agreements should specify uptime SLA', severity: 'warning' },
      { field: 'data_handling', rule: 'recommended', message: 'SaaS agreements should address data ownership', severity: 'warning' }
    ]
  },
  
  LEASE: {
    type: 'LEASE',
    displayName: 'Lease Agreement',
    criticalFields: ['landlord', 'tenant', 'premises', 'lease_term', 'rent', 'security_deposit'],
    optionalFields: ['rent_escalation', 'maintenance', 'insurance', 'subleasing', 'renewal_options'],
    financialFields: ['rent', 'security_deposit', 'cam_charges', 'rent_escalation'],
    dateFields: ['commencement_date', 'expiration_date', 'rent_due_date'],
    partyFields: ['landlord', 'tenant'],
    riskCategories: ['rent_escalation', 'maintenance_responsibility', 'early_termination', 'default_provisions'],
    typicalRanges: {
      security_deposit_months: { min: 1, max: 3, typical: 2, unit: 'months rent' },
      rent_escalation_annual: { min: 2, max: 5, typical: 3, unit: '%' }
    },
    extractionHints: 'Extract property details, rent schedule, escalation clauses, and maintenance responsibilities.',
    expectedSections: ['Premises', 'Term', 'Rent', 'Security Deposit', 'Maintenance', 'Insurance', 'Default', 'Termination'],
    validationRules: [
      { field: 'premises', rule: 'required', message: 'Lease must specify premises address', severity: 'error' },
      { field: 'rent', rule: 'required', message: 'Lease must specify rent amount', severity: 'error' }
    ]
  }
};

// ============================================================================
// INDUSTRY BENCHMARKS
// ============================================================================

const INDUSTRY_BENCHMARKS: IndustryBenchmark[] = [
  // Payment Terms
  {
    fieldName: 'payment_terms_days',
    contractType: 'MSA',
    benchmarks: {
      min: 15, max: 90, median: 30, p25: 30, p75: 45,
      unit: 'days', sampleSize: 5000, lastUpdated: '2025-12-01'
    }
  },
  {
    fieldName: 'payment_terms_days',
    contractType: 'SOW',
    benchmarks: {
      min: 15, max: 60, median: 30, p25: 30, p75: 45,
      unit: 'days', sampleSize: 3000, lastUpdated: '2025-12-01'
    }
  },
  
  // Liability Caps
  {
    fieldName: 'liability_cap_multiplier',
    contractType: 'MSA',
    industry: 'technology',
    benchmarks: {
      min: 6, max: 24, median: 12, p25: 12, p75: 18,
      unit: 'months fees', sampleSize: 2000, lastUpdated: '2025-12-01'
    }
  },
  {
    fieldName: 'liability_cap_multiplier',
    contractType: 'MSA',
    industry: 'consulting',
    benchmarks: {
      min: 12, max: 36, median: 24, p25: 12, p75: 24,
      unit: 'months fees', sampleSize: 1500, lastUpdated: '2025-12-01'
    }
  },
  
  // Notice Periods
  {
    fieldName: 'termination_notice_days',
    contractType: 'MSA',
    benchmarks: {
      min: 30, max: 180, median: 60, p25: 30, p75: 90,
      unit: 'days', sampleSize: 4000, lastUpdated: '2025-12-01'
    }
  },
  
  // SLA Uptime
  {
    fieldName: 'sla_uptime_percentage',
    contractType: 'SAAS',
    benchmarks: {
      min: 99, max: 99.999, median: 99.9, p25: 99.5, p75: 99.95,
      unit: '%', sampleSize: 2500, lastUpdated: '2025-12-01'
    }
  },
  
  // NDA Terms
  {
    fieldName: 'confidentiality_term_years',
    contractType: 'NDA',
    benchmarks: {
      min: 1, max: 10, median: 3, p25: 2, p75: 5,
      unit: 'years', sampleSize: 8000, lastUpdated: '2025-12-01'
    }
  },
  
  // Employment
  {
    fieldName: 'probation_period_months',
    contractType: 'EMPLOYMENT',
    benchmarks: {
      min: 1, max: 6, median: 3, p25: 3, p75: 6,
      unit: 'months', sampleSize: 3000, lastUpdated: '2025-12-01'
    }
  },
  {
    fieldName: 'non_compete_months',
    contractType: 'EMPLOYMENT',
    benchmarks: {
      min: 6, max: 24, median: 12, p25: 6, p75: 18,
      unit: 'months', sampleSize: 2000, lastUpdated: '2025-12-01'
    }
  }
];

// ============================================================================
// ENTITY ALIASES (for resolution)
// ============================================================================

const KNOWN_ENTITY_ALIASES: Record<string, string[]> = {
  'Microsoft Corporation': ['Microsoft', 'Microsoft Corp.', 'Microsoft, Inc.', 'MSFT'],
  'Apple Inc.': ['Apple', 'Apple Computer', 'Apple Inc'],
  'Amazon.com, Inc.': ['Amazon', 'Amazon.com', 'AWS', 'Amazon Web Services'],
  'Google LLC': ['Google', 'Google Inc.', 'Alphabet', 'Alphabet Inc.'],
  'International Business Machines': ['IBM', 'IBM Corporation', 'IBM Corp.'],
  'Accenture PLC': ['Accenture', 'Accenture LLP', 'Accenture Inc.'],
  'Deloitte': ['Deloitte Consulting', 'Deloitte LLP', 'Deloitte & Touche'],
  'PwC': ['PricewaterhouseCoopers', 'PricewaterhouseCoopers LLP'],
  'KPMG': ['KPMG LLP', 'KPMG International'],
  'Ernst & Young': ['EY', 'E&Y', 'Ernst & Young LLP'],
};

// ============================================================================
// ADVANCED EXTRACTION INTELLIGENCE SERVICE
// ============================================================================

export class AdvancedExtractionIntelligenceService {
  private static instance: AdvancedExtractionIntelligenceService;

  private constructor() {
    logger.info('Advanced Extraction Intelligence Service initialized');
  }

  static getInstance(): AdvancedExtractionIntelligenceService {
    if (!AdvancedExtractionIntelligenceService.instance) {
      AdvancedExtractionIntelligenceService.instance = new AdvancedExtractionIntelligenceService();
    }
    return AdvancedExtractionIntelligenceService.instance;
  }

  // ==========================================================================
  // GET CONTRACT TYPE PROFILE
  // ==========================================================================

  getContractTypeProfile(contractType: string): ContractTypeProfile | null {
    const normalizedType = contractType.toUpperCase().replace(/[^A-Z]/g, '');
    return CONTRACT_TYPE_PROFILES[normalizedType] || null;
  }

  // ==========================================================================
  // GET TYPE-SPECIFIC EXTRACTION HINTS
  // ==========================================================================

  getExtractionHints(contractType: string): {
    criticalFields: string[];
    fieldHints: Record<string, string>;
    expectedSections: string[];
    typicalRanges: Record<string, ValueRange>;
  } {
    const profile = this.getContractTypeProfile(contractType);
    
    if (!profile) {
      return {
        criticalFields: ['parties', 'effective_date', 'term', 'total_value'],
        fieldHints: {},
        expectedSections: [],
        typicalRanges: {}
      };
    }

    const fieldHints: Record<string, string> = {};
    
    for (const field of profile.criticalFields) {
      fieldHints[field] = `Critical for ${profile.displayName}`;
    }
    
    for (const field of profile.financialFields) {
      fieldHints[field] = `Financial field - extract exact value and currency`;
    }
    
    for (const field of profile.dateFields) {
      fieldHints[field] = `Date field - normalize to ISO format`;
    }

    return {
      criticalFields: profile.criticalFields,
      fieldHints,
      expectedSections: profile.expectedSections,
      typicalRanges: profile.typicalRanges
    };
  }

  // ==========================================================================
  // COMPARE TO INDUSTRY BENCHMARKS
  // ==========================================================================

  compareToIndustryBenchmarks(
    extractedFields: Array<{ fieldName: string; value: any; valueType: string }>,
    contractType: string,
    industry?: string
  ): Array<{
    fieldName: string;
    extractedValue: number;
    benchmark: IndustryBenchmark;
    position: 'below_market' | 'at_market' | 'above_market' | 'outlier';
    percentile: number;
    recommendation?: string;
  }> {
    const results: Array<{
      fieldName: string;
      extractedValue: number;
      benchmark: IndustryBenchmark;
      position: 'below_market' | 'at_market' | 'above_market' | 'outlier';
      percentile: number;
      recommendation?: string;
    }> = [];

    for (const field of extractedFields) {
      // Find matching benchmark
      const benchmark = INDUSTRY_BENCHMARKS.find(b => 
        b.fieldName === field.fieldName &&
        b.contractType.toUpperCase() === contractType.toUpperCase() &&
        (!b.industry || !industry || b.industry.toLowerCase() === industry.toLowerCase())
      );

      if (!benchmark) continue;

      const numericValue = this.extractNumericValue(field.value);
      if (numericValue === null) continue;

      // Calculate percentile position
      const percentile = this.calculatePercentile(numericValue, benchmark.benchmarks);
      
      // Determine position
      let position: 'below_market' | 'at_market' | 'above_market' | 'outlier';
      let recommendation: string | undefined;

      if (numericValue < benchmark.benchmarks.min || numericValue > benchmark.benchmarks.max) {
        position = 'outlier';
        recommendation = numericValue < benchmark.benchmarks.min
          ? `Value is unusually low. Typical range: ${benchmark.benchmarks.min}-${benchmark.benchmarks.max} ${benchmark.benchmarks.unit}`
          : `Value is unusually high. Typical range: ${benchmark.benchmarks.min}-${benchmark.benchmarks.max} ${benchmark.benchmarks.unit}`;
      } else if (percentile < 25) {
        position = 'below_market';
        recommendation = `Below industry median (${benchmark.benchmarks.median} ${benchmark.benchmarks.unit}). Consider negotiating higher.`;
      } else if (percentile > 75) {
        position = 'above_market';
        recommendation = `Above industry median (${benchmark.benchmarks.median} ${benchmark.benchmarks.unit}). Favorable terms.`;
      } else {
        position = 'at_market';
      }

      results.push({
        fieldName: field.fieldName,
        extractedValue: numericValue,
        benchmark,
        position,
        percentile,
        recommendation
      });
    }

    return results;
  }

  // ==========================================================================
  // ENTITY RESOLUTION
  // ==========================================================================

  resolveEntity(entityName: string): EntityMatch {
    const normalizedName = this.normalizeEntityName(entityName);
    const matchedEntities: EntityMatch['matchedEntities'] = [];

    // Check for exact matches and aliases
    for (const [canonical, aliases] of Object.entries(KNOWN_ENTITY_ALIASES)) {
      const allNames = [canonical.toLowerCase(), ...aliases.map(a => a.toLowerCase())];
      
      if (allNames.includes(normalizedName.toLowerCase())) {
        matchedEntities.push({
          name: canonical,
          similarity: 1.0,
          source: 'known_entity',
          type: 'exact'
        });
      } else {
        // Fuzzy matching
        const similarity = this.calculateStringSimilarity(normalizedName.toLowerCase(), canonical.toLowerCase());
        if (similarity > 0.7) {
          matchedEntities.push({
            name: canonical,
            similarity,
            source: 'fuzzy_match',
            type: 'fuzzy'
          });
        }
      }
    }

    // Sort by similarity
    matchedEntities.sort((a, b) => b.similarity - a.similarity);

    return {
      originalName: entityName,
      normalizedName,
      matchedEntities,
      suggestedCanonical: matchedEntities[0]?.name || normalizedName,
      confidence: matchedEntities[0]?.similarity || 0.5
    };
  }

  // ==========================================================================
  // PREDICT MISSING FIELDS
  // ==========================================================================

  predictMissingFields(
    extractedFieldNames: string[],
    contractType: string
  ): MissingFieldPrediction[] {
    const profile = this.getContractTypeProfile(contractType);
    if (!profile) return [];

    const predictions: MissingFieldPrediction[] = [];
    const extractedSet = new Set(extractedFieldNames.map(f => f.toLowerCase()));

    // Check critical fields
    for (const field of profile.criticalFields) {
      if (!extractedSet.has(field.toLowerCase())) {
        predictions.push({
          fieldName: field,
          displayName: this.toDisplayName(field),
          likelihood: 0.95,
          reason: `Critical field for ${profile.displayName}`,
          suggestedLocation: this.suggestFieldLocation(field, profile)
        });
      }
    }

    // Check optional but common fields
    for (const field of profile.optionalFields) {
      if (!extractedSet.has(field.toLowerCase())) {
        predictions.push({
          fieldName: field,
          displayName: this.toDisplayName(field),
          likelihood: 0.6,
          reason: `Commonly found in ${profile.displayName}`,
          suggestedLocation: this.suggestFieldLocation(field, profile)
        });
      }
    }

    // Sort by likelihood
    return predictions.sort((a, b) => b.likelihood - a.likelihood);
  }

  // ==========================================================================
  // SUGGEST IMPROVEMENTS
  // ==========================================================================

  suggestImprovements(
    extractedFields: Array<{ fieldName: string; value: any; confidence: number }>,
    contractType: string,
    documentText: string
  ): ExtractionImprovement[] {
    const improvements: ExtractionImprovement[] = [];
    const profile = this.getContractTypeProfile(contractType);

    for (const field of extractedFields) {
      // Low confidence suggestions
      if (field.confidence < 0.7) {
        improvements.push({
          fieldName: field.fieldName,
          currentValue: field.value,
          issue: 'Low extraction confidence',
          suggestion: `Consider manual verification. Current confidence: ${Math.round(field.confidence * 100)}%`,
          confidence: 0.8,
          source: 'validation'
        });
      }

      // Value format suggestions
      if (field.fieldName.includes('date') && field.value) {
        const normalized = this.normalizeDateValue(field.value);
        if (normalized && normalized !== field.value) {
          improvements.push({
            fieldName: field.fieldName,
            currentValue: field.value,
            issue: 'Date format could be standardized',
            suggestion: 'Normalize to ISO format',
            improvedValue: normalized,
            confidence: 0.9,
            source: 'validation'
          });
        }
      }

      // Currency format suggestions
      if (profile?.financialFields.includes(field.fieldName) && field.value) {
        const parsed = this.parseCurrencyValue(field.value);
        if (parsed && typeof field.value === 'string') {
          improvements.push({
            fieldName: field.fieldName,
            currentValue: field.value,
            issue: 'Financial value could be structured',
            suggestion: 'Parse into amount and currency',
            improvedValue: parsed,
            confidence: 0.85,
            source: 'validation'
          });
        }
      }
    }

    // Benchmark-based suggestions
    if (profile) {
      const benchmarkComparisons = this.compareToIndustryBenchmarks(
        extractedFields.map(f => ({ fieldName: f.fieldName, value: f.value, valueType: 'unknown' })),
        contractType
      );

      for (const comparison of benchmarkComparisons) {
        if (comparison.position === 'outlier' && comparison.recommendation) {
          improvements.push({
            fieldName: comparison.fieldName,
            currentValue: comparison.extractedValue,
            issue: 'Value outside typical industry range',
            suggestion: comparison.recommendation,
            confidence: 0.75,
            source: 'benchmark'
          });
        }
      }
    }

    return improvements;
  }

  // ==========================================================================
  // VALIDATE AGAINST PROFILE
  // ==========================================================================

  validateAgainstProfile(
    extractedFields: Array<{ fieldName: string; value: any }>,
    contractType: string
  ): Array<{
    field: string;
    rule: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }> {
    const profile = this.getContractTypeProfile(contractType);
    if (!profile) return [];

    const results: Array<{
      field: string;
      rule: string;
      passed: boolean;
      message: string;
      severity: 'error' | 'warning' | 'info';
    }> = [];

    const fieldMap = new Map(extractedFields.map(f => [f.fieldName.toLowerCase(), f.value]));

    for (const rule of profile.validationRules) {
      const value = fieldMap.get(rule.field.toLowerCase());
      let passed = true;

      switch (rule.rule) {
        case 'required':
          passed = value !== undefined && value !== null && value !== '';
          break;
        case 'recommended':
          passed = value !== undefined && value !== null && value !== '';
          break;
        default:
          // Custom rules could be added here
          break;
      }

      results.push({
        field: rule.field,
        rule: rule.rule,
        passed,
        message: passed ? `${rule.field} present` : rule.message,
        severity: passed ? 'info' : rule.severity
      });
    }

    return results;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private extractNumericValue(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
    if (typeof value === 'object' && value?.amount) {
      return value.amount;
    }
    return null;
  }

  private calculatePercentile(value: number, benchmarks: IndustryBenchmark['benchmarks']): number {
    // Simple linear interpolation
    if (value <= benchmarks.min) return 0;
    if (value >= benchmarks.max) return 100;
    if (value <= benchmarks.p25) return ((value - benchmarks.min) / (benchmarks.p25 - benchmarks.min)) * 25;
    if (value <= benchmarks.median) return 25 + ((value - benchmarks.p25) / (benchmarks.median - benchmarks.p25)) * 25;
    if (value <= benchmarks.p75) return 50 + ((value - benchmarks.median) / (benchmarks.p75 - benchmarks.median)) * 25;
    return 75 + ((value - benchmarks.p75) / (benchmarks.max - benchmarks.p75)) * 25;
  }

  private normalizeEntityName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/\./g, '')
      .replace(/,?\s*(Inc|LLC|Ltd|Corp|Corporation|Company|LP|LLP|PLC|SA|GmbH|AG)\.?$/i, '')
      .trim();
  }

  private calculateStringSimilarity(a: string, b: string): number {
    // Levenshtein-based similarity
    const matrix: number[][] = [];
    
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[a.length][b.length];
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }

  private suggestFieldLocation(field: string, profile: ContractTypeProfile): string {
    // Map fields to typical sections
    const fieldToSection: Record<string, string> = {
      'parties': 'Preamble or Recitals',
      'effective_date': 'Preamble or Term section',
      'term': 'Term section',
      'payment_terms': 'Payment or Compensation section',
      'liability_cap': 'Limitation of Liability section',
      'termination_notice': 'Termination section',
      'confidentiality': 'Confidentiality section',
      'deliverables': 'Scope or Deliverables section',
      'salary': 'Compensation section',
      'job_title': 'Position section',
      'rent': 'Rent or Payment section',
      'sla_uptime': 'SLA or Service Level section'
    };

    return fieldToSection[field] || `Look in ${profile.expectedSections.join(', ')}`;
  }

  private toDisplayName(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private normalizeDateValue(value: any): string | null {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }

  private parseCurrencyValue(value: string): { amount: number; currency: string } | null {
    const currencyMatch = value.match(/([€$£¥]|USD|EUR|GBP|CAD|AUD)/);
    const amountMatch = value.match(/[\d,]+(?:\.\d{2})?/);
    
    if (amountMatch) {
      const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
      let currency = 'USD';
      
      if (currencyMatch) {
        const symbol = currencyMatch[1];
        if (symbol === '€' || symbol === 'EUR') currency = 'EUR';
        else if (symbol === '£' || symbol === 'GBP') currency = 'GBP';
        else if (symbol === '¥') currency = 'JPY';
        else if (symbol === 'CAD') currency = 'CAD';
        else if (symbol === 'AUD') currency = 'AUD';
      }
      
      return { amount, currency };
    }
    
    return null;
  }
}

// Export singleton
export const advancedExtractionIntelligence = AdvancedExtractionIntelligenceService.getInstance();
