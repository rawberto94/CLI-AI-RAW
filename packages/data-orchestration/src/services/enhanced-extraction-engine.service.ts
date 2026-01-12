/**
 * Enhanced Extraction Engine Service
 * 
 * This service provides advanced multi-pass extraction with:
 * 1. Multi-pass extraction (structure → details → validation)
 * 2. Confidence calibration with evidence requirements
 * 3. Cross-field validation for consistency
 * 4. Fallback strategies for reliability
 * 5. Domain-specific extraction patterns
 * 6. Self-correction mechanism
 * 7. Semantic deduplication
 * 
 * Goal: Maximum accuracy, reliability, and flexibility in document extraction.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('enhanced-extraction-engine');

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionResult {
  fields: ExtractedField[];
  relationships: FieldRelationship[];
  validationReport: ValidationReport;
  extractionMetadata: ExtractionMetadata;
}

export interface ExtractedField {
  id: string;
  fieldName: string;
  displayName: string;
  value: any;
  normalizedValue: any;
  valueType: FieldValueType;
  
  // Confidence & Evidence
  confidence: number;
  confidenceFactors: ConfidenceFactor[];
  evidence: Evidence[];
  
  // Source tracking
  sourceText: string;
  sourceLocation: SourceLocation;
  extractionMethod: ExtractionMethod;
  
  // Categorization
  category: FieldCategory;
  importance: ImportanceLevel;
  isStandardField: boolean;
  suggestedSchemaField?: string;
  
  // Validation
  validationStatus: ValidationStatus;
  validationMessages: string[];
  
  // Alternatives (for ambiguous extractions)
  alternatives?: AlternativeValue[];
}

export interface ConfidenceFactor {
  factor: string;
  impact: number; // -1 to +1
  reason: string;
}

export interface Evidence {
  type: 'direct_quote' | 'inferred' | 'calculated' | 'pattern_match' | 'cross_reference';
  text: string;
  location?: string;
  weight: number;
}

export interface SourceLocation {
  section?: string;
  paragraph?: number;
  startChar?: number;
  endChar?: number;
  pageEstimate?: number;
}

export type ExtractionMethod = 
  | 'ai_extraction'
  | 'pattern_matching'
  | 'rule_based'
  | 'semantic_inference'
  | 'cross_reference'
  | 'hybrid';

export type FieldValueType = 
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'date_range'
  | 'duration'
  | 'percentage'
  | 'boolean'
  | 'list'
  | 'object'
  | 'party'
  | 'address'
  | 'email'
  | 'phone'
  | 'url';

export type FieldCategory =
  | 'identity'        // Contract ID, names, references
  | 'parties'         // Involved parties
  | 'financial'       // Money, payments, rates
  | 'temporal'        // Dates, durations, timelines
  | 'obligations'     // Duties, requirements
  | 'deliverables'    // Products, services
  | 'terms'           // Conditions, restrictions
  | 'legal'           // Jurisdiction, governing law
  | 'compliance'      // Regulatory requirements
  | 'contacts'        // People, roles
  | 'technical'       // Technical specs, SLAs
  | 'other';

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

export type ValidationStatus = 'valid' | 'warning' | 'error' | 'unverified';

export interface AlternativeValue {
  value: any;
  confidence: number;
  reason: string;
}

export interface FieldRelationship {
  fromFieldId: string;
  toFieldId: string;
  relationshipType: 'depends_on' | 'validates' | 'conflicts_with' | 'related_to' | 'derived_from';
  description: string;
  strength: number;
}

export interface ValidationReport {
  overallScore: number;
  totalFields: number;
  validFields: number;
  warningFields: number;
  errorFields: number;
  crossValidationResults: CrossValidationResult[];
  missingCriticalFields: string[];
  anomalies: DataAnomaly[];
  suggestions: ValidationSuggestion[];
}

export interface CrossValidationResult {
  fieldIds: string[];
  rule: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface DataAnomaly {
  type: 'outlier' | 'inconsistency' | 'impossible_value' | 'suspicious_pattern' | 'duplicate';
  fieldId: string;
  description: string;
  expectedRange?: { min: any; max: any };
  actualValue: any;
  suggestedAction: string;
}

export interface ValidationSuggestion {
  type: 'add' | 'modify' | 'remove' | 'verify';
  fieldId?: string;
  message: string;
  priority: ImportanceLevel;
}

export interface ExtractionMetadata {
  version: string;
  passes: PassResult[];
  totalTime: number;
  tokenUsage: number;
  fallbacksUsed: string[];
  documentProfile: DocumentProfile;
}

export interface PassResult {
  passNumber: number;
  passType: 'structure' | 'detail' | 'validation' | 'correction';
  fieldsExtracted: number;
  fieldsModified: number;
  timeMs: number;
}

export interface DocumentProfile {
  estimatedType: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  language: string;
  structureScore: number;
  completeness: number;
}

// ============================================================================
// EXTRACTION PATTERNS (Domain-Specific)
// ============================================================================

interface ExtractionPattern {
  name: string;
  category: FieldCategory;
  patterns: RegExp[];
  extractionFunction?: (match: RegExpMatchArray, context: string) => any;
  confidence: number;
  priority: number;
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // Dates
  {
    name: 'effective_date',
    category: 'temporal',
    patterns: [
      /effective\s+(?:date|as\s+of)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /effective\s+(?:date|as\s+of)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /this\s+agreement\s+is\s+effective\s+(?:as\s+of\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ],
    confidence: 0.9,
    priority: 10
  },
  {
    name: 'expiration_date',
    category: 'temporal',
    patterns: [
      /(?:expiration|expiry|end)\s+date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(?:expiration|expiry|end)\s+date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:terminates?|expires?|ends?)\s+(?:on|upon)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ],
    confidence: 0.9,
    priority: 10
  },
  {
    name: 'signature_date',
    category: 'temporal',
    patterns: [
      /(?:signed|executed|dated)[:\s]+(?:this\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(?:as\s+of|dated)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ],
    confidence: 0.85,
    priority: 9
  },
  
  // Financial
  {
    name: 'total_value',
    category: 'financial',
    patterns: [
      /total\s+(?:contract\s+)?value[:\s]+[$€£¥]?\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:aggregate|maximum)\s+amount[:\s]+[$€£¥]?\s*([\d,]+(?:\.\d{2})?)/i,
      /not\s+(?:to\s+)?exceed[:\s]+[$€£¥]?\s*([\d,]+(?:\.\d{2})?)/i,
    ],
    confidence: 0.85,
    priority: 10
  },
  {
    name: 'currency',
    category: 'financial',
    patterns: [
      /(?:all\s+)?amounts?\s+(?:are\s+)?(?:in|expressed\s+in)[:\s]+(USD|EUR|GBP|CAD|AUD|JPY|CHF)/i,
      /\((USD|EUR|GBP|CAD|AUD|JPY|CHF)\)/i,
    ],
    confidence: 0.9,
    priority: 8
  },
  {
    name: 'payment_terms',
    category: 'financial',
    patterns: [
      /payment\s+(?:terms?|due)[:\s]+(?:net\s+)?(\d+)\s*(?:days?)?/i,
      /(?:net\s+)?(\d+)\s*days?\s+(?:from\s+)?(?:receipt|invoice)/i,
      /payable\s+within\s+(\d+)\s*days?/i,
    ],
    confidence: 0.85,
    priority: 9
  },
  
  // Parties
  {
    name: 'party_with_role',
    category: 'parties',
    patterns: [
      /(".*?"|\b[A-Z][A-Za-z\s,\.]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|LP|LLP)\.?)\s*\((?:the\s+)?"?(Client|Vendor|Supplier|Customer|Provider|Contractor|Consultant|Licensee|Licensor|Buyer|Seller)"?\)/i,
      /(?:the\s+)?"?(Client|Vendor|Supplier|Customer|Provider|Contractor|Consultant|Licensee|Licensor|Buyer|Seller)"?\s*(?:shall\s+)?(?:mean|refers?\s+to)\s*(".*?"|\b[A-Z][A-Za-z\s,\.]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|LP|LLP)\.?)/i,
    ],
    confidence: 0.9,
    priority: 10
  },
  
  // Term/Duration
  {
    name: 'term_duration',
    category: 'temporal',
    patterns: [
      /(?:initial\s+)?term\s+(?:of|is|shall\s+be)[:\s]+(\d+)\s*(year|month|day)s?/i,
      /(?:for\s+a\s+)?(?:period|term)\s+of\s+(\d+)\s*(year|month|day)s?/i,
    ],
    confidence: 0.85,
    priority: 9
  },
  {
    name: 'renewal_term',
    category: 'temporal',
    patterns: [
      /(?:auto(?:matic)?(?:ally)?|successive)\s+renew(?:al)?(?:s)?\s+(?:of|for)\s+(\d+)\s*(year|month|day)s?/i,
      /renew(?:al)?(?:s)?\s+for\s+(?:additional|successive)\s+(\d+)\s*(year|month|day)s?\s+(?:term|period)s?/i,
    ],
    confidence: 0.8,
    priority: 8
  },
  {
    name: 'notice_period',
    category: 'temporal',
    patterns: [
      /(?:prior\s+)?(?:written\s+)?notice\s+(?:of\s+)?(?:at\s+least\s+)?(\d+)\s*(?:calendar\s+|business\s+)?(days?|months?)/i,
      /(\d+)\s*(?:calendar\s+|business\s+)?(days?|months?)\s+(?:prior\s+)?(?:written\s+)?notice/i,
    ],
    confidence: 0.8,
    priority: 8
  },
  
  // Liability
  {
    name: 'liability_cap',
    category: 'legal',
    patterns: [
      /(?:total|aggregate)\s+liability\s+(?:shall\s+)?(?:not\s+)?exceed\s+[$€£¥]?\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:capped|limited)\s+(?:at|to)\s+[$€£¥]?\s*([\d,]+(?:\.\d{2})?)/i,
      /liability\s+(?:cap|limit)[:\s]+[$€£¥]?\s*([\d,]+(?:\.\d{2})?)/i,
    ],
    confidence: 0.85,
    priority: 9
  },
  
  // SLA/Performance
  {
    name: 'sla_uptime',
    category: 'technical',
    patterns: [
      /(?:uptime|availability)[:\s]+(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s+(?:uptime|availability)/i,
      /(?:service\s+level|SLA)[:\s]+(\d+(?:\.\d+)?)\s*%/i,
    ],
    confidence: 0.9,
    priority: 8
  },
  {
    name: 'response_time',
    category: 'technical',
    patterns: [
      /response\s+time[:\s]+(?:within\s+)?(\d+)\s*(hour|minute|second|business\s+day)s?/i,
      /(?:respond|acknowledge)\s+within\s+(\d+)\s*(hour|minute|second|business\s+day)s?/i,
    ],
    confidence: 0.8,
    priority: 7
  },
  
  // Jurisdiction
  {
    name: 'governing_law',
    category: 'legal',
    patterns: [
      /govern(?:ed|ing)\s+(?:by\s+)?(?:the\s+)?(?:laws?\s+of\s+)?(?:the\s+)?(?:State\s+of\s+)?([A-Za-z\s]+)/i,
      /(?:laws?\s+of\s+)?(?:the\s+)?(?:State\s+of\s+)?([A-Za-z\s]+)\s+(?:shall\s+)?govern/i,
    ],
    confidence: 0.75,
    priority: 7
  },
];

// ============================================================================
// CROSS-VALIDATION RULES
// ============================================================================

interface CrossValidationRule {
  id: string;
  name: string;
  description: string;
  fields: string[];
  validate: (fields: Map<string, ExtractedField>) => CrossValidationResult;
}

const CROSS_VALIDATION_RULES: CrossValidationRule[] = [
  {
    id: 'date_sequence',
    name: 'Date Sequence Validation',
    description: 'Validates that dates are in logical order',
    fields: ['effective_date', 'expiration_date', 'signature_date'],
    validate: (fields) => {
      const effective = fields.get('effective_date');
      const expiration = fields.get('expiration_date');
      const signature = fields.get('signature_date');
      
      const issues: string[] = [];
      
      if (effective && expiration) {
        const effDate = new Date(effective.normalizedValue);
        const expDate = new Date(expiration.normalizedValue);
        if (expDate <= effDate) {
          issues.push('Expiration date must be after effective date');
        }
      }
      
      if (signature && effective) {
        const sigDate = new Date(signature.normalizedValue);
        const effDate = new Date(effective.normalizedValue);
        if (sigDate > effDate) {
          issues.push('Signature date should typically be on or before effective date');
        }
      }
      
      return {
        fieldIds: [effective?.id, expiration?.id, signature?.id].filter(Boolean) as string[],
        rule: 'date_sequence',
        passed: issues.length === 0,
        message: issues.length === 0 ? 'Dates are in logical sequence' : issues.join('; '),
        severity: issues.length === 0 ? 'info' : 'warning'
      };
    }
  },
  {
    id: 'term_date_consistency',
    name: 'Term Duration vs Dates Consistency',
    description: 'Validates that term duration matches the dates',
    fields: ['effective_date', 'expiration_date', 'term_duration'],
    validate: (fields) => {
      const effective = fields.get('effective_date');
      const expiration = fields.get('expiration_date');
      const termDuration = fields.get('term_duration');
      
      if (!effective || !expiration || !termDuration) {
        return {
          fieldIds: [],
          rule: 'term_date_consistency',
          passed: true,
          message: 'Insufficient fields for validation',
          severity: 'info'
        };
      }
      
      const effDate = new Date(effective.normalizedValue);
      const expDate = new Date(expiration.normalizedValue);
      const diffMonths = (expDate.getFullYear() - effDate.getFullYear()) * 12 + 
                        (expDate.getMonth() - effDate.getMonth());
      
      // Parse term duration (assuming format like "1 year" or "12 months")
      const termStr = String(termDuration.value).toLowerCase();
      let expectedMonths = 0;
      
      const yearMatch = termStr.match(/(\d+)\s*year/);
      const monthMatch = termStr.match(/(\d+)\s*month/);
      
      if (yearMatch) expectedMonths = parseInt(yearMatch[1]) * 12;
      if (monthMatch) expectedMonths += parseInt(monthMatch[1]);
      
      const tolerance = 1; // Allow 1 month tolerance
      const matched = Math.abs(diffMonths - expectedMonths) <= tolerance;
      
      return {
        fieldIds: [effective.id, expiration.id, termDuration.id],
        rule: 'term_date_consistency',
        passed: matched,
        message: matched 
          ? 'Term duration matches the date range' 
          : `Term duration (${expectedMonths} months) doesn't match dates (${diffMonths} months)`,
        severity: matched ? 'info' : 'warning'
      };
    }
  },
  {
    id: 'financial_consistency',
    name: 'Financial Value Consistency',
    description: 'Validates that financial values are consistent',
    fields: ['total_value', 'monthly_fee', 'term_duration'],
    validate: (fields) => {
      const totalValue = fields.get('total_value');
      const monthlyFee = fields.get('monthly_fee');
      const termDuration = fields.get('term_duration');
      
      if (!totalValue || !monthlyFee || !termDuration) {
        return {
          fieldIds: [],
          rule: 'financial_consistency',
          passed: true,
          message: 'Insufficient fields for validation',
          severity: 'info'
        };
      }
      
      // Parse values
      const total = parseFloat(String(totalValue.normalizedValue).replace(/[^\d.]/g, ''));
      const monthly = parseFloat(String(monthlyFee.normalizedValue).replace(/[^\d.]/g, ''));
      
      const termStr = String(termDuration.value).toLowerCase();
      let months = 0;
      const yearMatch = termStr.match(/(\d+)\s*year/);
      const monthMatch = termStr.match(/(\d+)\s*month/);
      if (yearMatch) months = parseInt(yearMatch[1]) * 12;
      if (monthMatch) months += parseInt(monthMatch[1]);
      
      const expectedTotal = monthly * months;
      const tolerance = 0.05; // 5% tolerance
      const matched = Math.abs(total - expectedTotal) / total <= tolerance;
      
      return {
        fieldIds: [totalValue.id, monthlyFee.id, termDuration.id],
        rule: 'financial_consistency',
        passed: matched,
        message: matched 
          ? 'Financial values are consistent'
          : `Total value ($${total}) doesn't match monthly ($${monthly}) × term (${months} months) = $${expectedTotal}`,
        severity: matched ? 'info' : 'warning'
      };
    }
  },
  {
    id: 'notice_period_reasonability',
    name: 'Notice Period Reasonability',
    description: 'Validates that notice period is reasonable for contract term',
    fields: ['notice_period', 'term_duration'],
    validate: (fields) => {
      const noticePeriod = fields.get('notice_period');
      const termDuration = fields.get('term_duration');
      
      if (!noticePeriod) {
        return {
          fieldIds: [],
          rule: 'notice_period_reasonability',
          passed: true,
          message: 'No notice period found',
          severity: 'info'
        };
      }
      
      // Parse notice period to days
      const noticeStr = String(noticePeriod.value).toLowerCase();
      let noticeDays = 0;
      const dayMatch = noticeStr.match(/(\d+)\s*day/);
      const monthMatch = noticeStr.match(/(\d+)\s*month/);
      if (dayMatch) noticeDays = parseInt(dayMatch[1]);
      if (monthMatch) noticeDays = parseInt(monthMatch[1]) * 30;
      
      // Very short notice (<7 days) or very long notice (>180 days) is unusual
      const isReasonable = noticeDays >= 7 && noticeDays <= 180;
      
      return {
        fieldIds: [noticePeriod.id],
        rule: 'notice_period_reasonability',
        passed: isReasonable,
        message: isReasonable 
          ? 'Notice period is within typical range'
          : noticeDays < 7 
            ? `Notice period (${noticeDays} days) is unusually short`
            : `Notice period (${noticeDays} days) is unusually long`,
        severity: isReasonable ? 'info' : 'warning'
      };
    }
  }
];

// ============================================================================
// VALUE NORMALIZERS
// ============================================================================

interface ValueNormalizer {
  type: FieldValueType;
  normalize: (value: any) => any;
}

const VALUE_NORMALIZERS: Record<string, ValueNormalizer> = {
  date: {
    type: 'date',
    normalize: (value: any): string | null => {
      if (!value) return null;
      const str = String(value).trim();
      
      // Try multiple date formats
      const formats = [
        /(\d{4})-(\d{2})-(\d{2})/,                    // ISO
        /(\d{2})\/(\d{2})\/(\d{4})/,                  // MM/DD/YYYY
        /(\d{2})-(\d{2})-(\d{4})/,                    // MM-DD-YYYY
        /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,        // Month DD, YYYY
        /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/,          // DD Month YYYY
      ];
      
      for (const format of formats) {
        const match = str.match(format);
        if (match) {
          try {
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
              return date.toISOString().split('T')[0];
            }
          } catch {
            // Continue to next format
          }
        }
      }
      
      // Last resort: try native parsing
      try {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        // Return null if parsing fails
      }
      
      return null;
    }
  },
  currency: {
    type: 'currency',
    normalize: (value: any): { amount: number; currency: string } | null => {
      if (!value) return null;
      const str = String(value).trim();
      
      // Extract currency symbol or code
      let currency = 'USD';
      if (str.includes('€') || /EUR/i.test(str)) currency = 'EUR';
      else if (str.includes('£') || /GBP/i.test(str)) currency = 'GBP';
      else if (str.includes('¥') || /JPY/i.test(str)) currency = 'JPY';
      else if (/CAD/i.test(str)) currency = 'CAD';
      else if (/AUD/i.test(str)) currency = 'AUD';
      
      // Extract numeric value
      const numericStr = str.replace(/[^\d.,]/g, '').replace(/,/g, '');
      const amount = parseFloat(numericStr);
      
      if (isNaN(amount)) return null;
      
      return { amount, currency };
    }
  },
  percentage: {
    type: 'percentage',
    normalize: (value: any): number | null => {
      if (!value) return null;
      const str = String(value).replace(/[^\d.]/g, '');
      const num = parseFloat(str);
      return isNaN(num) ? null : num;
    }
  },
  duration: {
    type: 'duration',
    normalize: (value: any): { value: number; unit: string } | null => {
      if (!value) return null;
      const str = String(value).toLowerCase().trim();
      
      const yearMatch = str.match(/(\d+)\s*year/);
      const monthMatch = str.match(/(\d+)\s*month/);
      const dayMatch = str.match(/(\d+)\s*day/);
      
      if (yearMatch) return { value: parseInt(yearMatch[1]), unit: 'year' };
      if (monthMatch) return { value: parseInt(monthMatch[1]), unit: 'month' };
      if (dayMatch) return { value: parseInt(dayMatch[1]), unit: 'day' };
      
      return null;
    }
  }
};

// ============================================================================
// ENHANCED EXTRACTION ENGINE
// ============================================================================

export interface ExtractionOptions {
  maxPasses?: number;
  minConfidence?: number;
  enablePatternMatching?: boolean;
  enableCrossValidation?: boolean;
  enableSelfCorrection?: boolean;
  contractType?: string;
  customPatterns?: ExtractionPattern[];
}

export class EnhancedExtractionEngine {
  private static instance: EnhancedExtractionEngine;
  private readonly version = '1.0.0';

  private constructor() {
    logger.info('Enhanced Extraction Engine initialized');
  }

  static getInstance(): EnhancedExtractionEngine {
    if (!EnhancedExtractionEngine.instance) {
      EnhancedExtractionEngine.instance = new EnhancedExtractionEngine();
    }
    return EnhancedExtractionEngine.instance;
  }

  /**
   * Main extraction method with multi-pass approach
   */
  async extract(
    documentText: string,
    existingFields: ExtractedField[] = [],
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const passes: PassResult[] = [];
    const fallbacksUsed: string[] = [];
    
    const mergedOptions: Required<ExtractionOptions> = {
      maxPasses: options.maxPasses ?? 3,
      minConfidence: options.minConfidence ?? 0.6,
      enablePatternMatching: options.enablePatternMatching ?? true,
      enableCrossValidation: options.enableCrossValidation ?? true,
      enableSelfCorrection: options.enableSelfCorrection ?? true,
      contractType: options.contractType ?? 'unknown',
      customPatterns: options.customPatterns ?? []
    };

    // Document profile analysis
    const documentProfile = this.analyzeDocumentProfile(documentText);
    
    let allFields: ExtractedField[] = [...existingFields];
    
    // ========== PASS 1: Pattern-Based Extraction ==========
    if (mergedOptions.enablePatternMatching) {
      const pass1Start = Date.now();
      const patternFields = this.extractWithPatterns(
        documentText, 
        [...EXTRACTION_PATTERNS, ...mergedOptions.customPatterns]
      );
      
      allFields = this.mergeFields(allFields, patternFields);
      
      passes.push({
        passNumber: 1,
        passType: 'structure',
        fieldsExtracted: patternFields.length,
        fieldsModified: 0,
        timeMs: Date.now() - pass1Start
      });
      
      logger.info({ fieldsFound: patternFields.length }, 'Pass 1 (Pattern) completed');
    }

    // ========== PASS 2: AI-Powered Deep Extraction ==========
    const pass2Start = Date.now();
    try {
      const aiFields = await this.extractWithAI(
        documentText, 
        allFields,
        mergedOptions.contractType,
        documentProfile
      );
      
      allFields = this.mergeFields(allFields, aiFields);
      
      passes.push({
        passNumber: 2,
        passType: 'detail',
        fieldsExtracted: aiFields.length,
        fieldsModified: 0,
        timeMs: Date.now() - pass2Start
      });
      
      logger.info({ fieldsFound: aiFields.length }, 'Pass 2 (AI) completed');
    } catch (error) {
      logger.warn({ error }, 'AI extraction failed, using pattern fallback');
      fallbacksUsed.push('ai_to_pattern');
    }

    // ========== PASS 3: Validation & Self-Correction ==========
    if (mergedOptions.enableSelfCorrection) {
      const pass3Start = Date.now();
      const corrections = await this.selfCorrect(allFields, documentText);
      
      passes.push({
        passNumber: 3,
        passType: 'correction',
        fieldsExtracted: 0,
        fieldsModified: corrections.modificationsCount,
        timeMs: Date.now() - pass3Start
      });
      
      allFields = corrections.fields;
      logger.info({ modifications: corrections.modificationsCount }, 'Pass 3 (Correction) completed');
    }

    // ========== Cross-Validation ==========
    let crossValidationResults: CrossValidationResult[] = [];
    if (mergedOptions.enableCrossValidation) {
      crossValidationResults = this.runCrossValidation(allFields);
    }

    // ========== Build Relationships ==========
    const relationships = this.buildRelationships(allFields);

    // ========== Generate Validation Report ==========
    const validationReport = this.generateValidationReport(
      allFields, 
      crossValidationResults,
      documentProfile
    );

    // ========== Filter by Confidence ==========
    allFields = allFields.filter(f => f.confidence >= mergedOptions.minConfidence);

    return {
      fields: allFields,
      relationships,
      validationReport,
      extractionMetadata: {
        version: this.version,
        passes,
        totalTime: Date.now() - startTime,
        tokenUsage: Math.ceil(documentText.length / 4),
        fallbacksUsed,
        documentProfile
      }
    };
  }

  // ==========================================================================
  // DOCUMENT PROFILE ANALYSIS
  // ==========================================================================

  private analyzeDocumentProfile(documentText: string): DocumentProfile {
    const lines = documentText.split('\n');
    const wordCount = documentText.split(/\s+/).length;
    
    // Detect structure
    const hasNumberedSections = /^\s*\d+\.\s+/m.test(documentText);
    const hasHeaders = /^[A-Z][A-Z\s]+$/m.test(documentText);
    const hasArticles = /\bArticle\s+[IVXLC\d]+\b/i.test(documentText);
    
    // Estimate complexity
    let complexity: DocumentProfile['complexity'] = 'simple';
    if (wordCount > 10000 || hasArticles) complexity = 'very_complex';
    else if (wordCount > 5000 || hasNumberedSections) complexity = 'complex';
    else if (wordCount > 2000) complexity = 'moderate';
    
    // Estimate quality (based on structure indicators)
    const structureIndicators = [
      hasNumberedSections,
      hasHeaders,
      /\bWHEREAS\b/i.test(documentText),
      /\bNOW,?\s*THEREFORE\b/i.test(documentText),
      /\bIN\s+WITNESS\s+WHEREOF\b/i.test(documentText)
    ];
    const structureScore = structureIndicators.filter(Boolean).length / structureIndicators.length;
    
    let quality: DocumentProfile['quality'] = 'fair';
    if (structureScore >= 0.8) quality = 'excellent';
    else if (structureScore >= 0.6) quality = 'good';
    else if (structureScore < 0.3) quality = 'poor';
    
    // Detect language
    const language = /[À-ÿ]/.test(documentText) ? 'mixed' : 'en';
    
    // Estimate completeness (check for key sections)
    const keySections = [
      /\b(?:term|duration)\b/i,
      /\b(?:payment|compensation|fees?)\b/i,
      /\b(?:termination|cancellation)\b/i,
      /\b(?:governing\s+law|jurisdiction)\b/i,
      /\b(?:confidential|NDA)\b/i
    ];
    const completeness = keySections.filter(r => r.test(documentText)).length / keySections.length;

    return {
      estimatedType: this.detectDocumentType(documentText),
      complexity,
      quality,
      language,
      structureScore,
      completeness
    };
  }

  private detectDocumentType(documentText: string): string {
    const typeIndicators: Array<{ type: string; patterns: RegExp[] }> = [
      { type: 'Master Service Agreement', patterns: [/master\s+service/i, /MSA\b/] },
      { type: 'Non-Disclosure Agreement', patterns: [/non-?disclosure/i, /NDA\b/, /confidentiality\s+agreement/i] },
      { type: 'Employment Agreement', patterns: [/employment\s+agreement/i, /offer\s+letter/i] },
      { type: 'Software License', patterns: [/software\s+license/i, /EULA\b/, /end\s+user\s+license/i] },
      { type: 'Statement of Work', patterns: [/statement\s+of\s+work/i, /SOW\b/, /work\s+order/i] },
      { type: 'Lease Agreement', patterns: [/lease\s+agreement/i, /rental\s+agreement/i] },
      { type: 'Purchase Agreement', patterns: [/purchase\s+agreement/i, /sales?\s+agreement/i] },
      { type: 'Partnership Agreement', patterns: [/partnership\s+agreement/i, /joint\s+venture/i] },
      { type: 'Consulting Agreement', patterns: [/consulting\s+agreement/i, /consultant\s+agreement/i] },
      { type: 'Service Level Agreement', patterns: [/service\s+level/i, /SLA\b/] },
    ];

    for (const indicator of typeIndicators) {
      if (indicator.patterns.some(p => p.test(documentText))) {
        return indicator.type;
      }
    }

    return 'General Contract';
  }

  // ==========================================================================
  // PATTERN-BASED EXTRACTION
  // ==========================================================================

  private extractWithPatterns(
    documentText: string, 
    patterns: ExtractionPattern[]
  ): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const usedPatternNames = new Set<string>();

    // Sort patterns by priority
    const sortedPatterns = [...patterns].sort((a, b) => b.priority - a.priority);

    for (const pattern of sortedPatterns) {
      if (usedPatternNames.has(pattern.name)) continue;

      for (const regex of pattern.patterns) {
        const match = documentText.match(regex);
        if (match) {
          const value = pattern.extractionFunction 
            ? pattern.extractionFunction(match, documentText)
            : match[1]?.trim();

          if (value) {
            const normalizedValue = this.normalizeValue(value, this.inferValueType(value, pattern.category));
            
            fields.push({
              id: `${pattern.name}_${Date.now()}`,
              fieldName: pattern.name,
              displayName: this.toDisplayName(pattern.name),
              value,
              normalizedValue,
              valueType: this.inferValueType(value, pattern.category),
              confidence: pattern.confidence,
              confidenceFactors: [
                { factor: 'pattern_match', impact: 0.3, reason: 'Matched known pattern' }
              ],
              evidence: [{
                type: 'direct_quote',
                text: match[0],
                weight: 1.0
              }],
              sourceText: match[0],
              sourceLocation: {
                startChar: match.index,
                endChar: match.index ? match.index + match[0].length : undefined
              },
              extractionMethod: 'pattern_matching',
              category: pattern.category,
              importance: this.inferImportance(pattern.name, pattern.category),
              isStandardField: true,
              validationStatus: 'unverified',
              validationMessages: []
            });

            usedPatternNames.add(pattern.name);
            break;
          }
        }
      }
    }

    return fields;
  }

  // ==========================================================================
  // AI-POWERED EXTRACTION
  // ==========================================================================

  private async extractWithAI(
    documentText: string,
    existingFields: ExtractedField[],
    contractType: string,
    profile: DocumentProfile
  ): Promise<ExtractedField[]> {
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured, skipping AI extraction');
      return [];
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build context from existing fields
    const existingContext = existingFields.length > 0
      ? `\n\nFields already extracted (verify and extend):\n${existingFields.map(f => `- ${f.displayName}: ${f.value}`).join('\n')}`
      : '';

    const prompt = `You are an expert contract analyst performing PRECISE data extraction.

Document Type: ${profile.estimatedType || contractType}
Complexity: ${profile.complexity}
Quality: ${profile.quality}
${existingContext}

EXTRACTION RULES:
1. Extract ONLY what is explicitly stated - no assumptions
2. For each value, you MUST quote the source text
3. Assign confidence based on:
   - 0.9+ : Exact match, unambiguous
   - 0.7-0.9: Clear meaning, minor inference
   - 0.5-0.7: Context-dependent, some ambiguity
   - <0.5: Uncertain, needs verification
4. Mark any value requiring human review

REQUIRED OUTPUT FORMAT (JSON):
{
  "fields": [
    {
      "fieldName": "snake_case_name",
      "displayName": "Human Readable Name",
      "value": "extracted value exactly as it appears",
      "valueType": "string|number|date|currency|duration|percentage|boolean|list",
      "confidence": 0.0-1.0,
      "sourceQuote": "exact text from document that contains this value",
      "sourceSection": "section name if identifiable",
      "category": "identity|parties|financial|temporal|obligations|deliverables|terms|legal|compliance|contacts|technical|other",
      "importance": "critical|high|medium|low",
      "needsReview": false,
      "reviewReason": null,
      "alternatives": [{"value": "alt value", "confidence": 0.5, "reason": "why this might be correct"}]
    }
  ],
  "missingCritical": ["list of expected but missing critical fields"],
  "ambiguities": ["list of unclear or conflicting information"]
}`;

    // Truncate for token limits
    const maxLength = 60000;
    const textToAnalyze = documentText.length > maxLength 
      ? documentText.substring(0, maxLength) + '\n\n[TRUNCATED]'
      : documentText;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Extract all important data from this ${profile.estimatedType}:\n\n${textToAnalyze}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 4000
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      const aiFields = result.fields || [];

      return aiFields.map((f: any, idx: number) => ({
        id: `ai_${f.fieldName}_${idx}`,
        fieldName: f.fieldName,
        displayName: f.displayName,
        value: f.value,
        normalizedValue: this.normalizeValue(f.value, f.valueType),
        valueType: f.valueType || 'string',
        confidence: f.confidence || 0.7,
        confidenceFactors: [
          { factor: 'ai_extraction', impact: 0.4, reason: 'AI extraction with verification' },
          ...(f.needsReview ? [{ factor: 'needs_review', impact: -0.2, reason: f.reviewReason }] : [])
        ],
        evidence: [{
          type: 'direct_quote' as const,
          text: f.sourceQuote || f.value,
          weight: f.confidence || 0.7
        }],
        sourceText: f.sourceQuote || f.value,
        sourceLocation: { section: f.sourceSection },
        extractionMethod: 'ai_extraction' as const,
        category: f.category || 'other',
        importance: f.importance || 'medium',
        isStandardField: false,
        validationStatus: f.needsReview ? 'warning' as const : 'unverified' as const,
        validationMessages: f.needsReview ? [f.reviewReason] : [],
        alternatives: f.alternatives?.map((alt: any) => ({
          value: alt.value,
          confidence: alt.confidence,
          reason: alt.reason
        }))
      }));
    } catch (error) {
      logger.error({ error }, 'AI extraction failed');
      return [];
    }
  }

  // ==========================================================================
  // SELF-CORRECTION
  // ==========================================================================

  private async selfCorrect(
    fields: ExtractedField[],
    documentText: string
  ): Promise<{ fields: ExtractedField[]; modificationsCount: number }> {
    let modificationsCount = 0;
    const correctedFields = [...fields];

    for (const field of correctedFields) {
      // Check 1: Verify source text exists in document
      if (field.sourceText && !documentText.includes(field.sourceText.substring(0, 50))) {
        field.validationStatus = 'warning';
        field.validationMessages.push('Source text not found in document - may be paraphrased');
        field.confidence = Math.max(0.5, field.confidence - 0.1);
        modificationsCount++;
      }

      // Check 2: Validate normalized value
      if (field.normalizedValue === null && field.value) {
        field.validationStatus = 'warning';
        field.validationMessages.push('Value could not be normalized to expected type');
        field.confidence = Math.max(0.5, field.confidence - 0.1);
        modificationsCount++;
      }

      // Check 3: Date sanity check
      if (field.valueType === 'date' && field.normalizedValue) {
        const date = new Date(field.normalizedValue);
        const now = new Date();
        const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
        const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
        
        if (date < tenYearsAgo || date > tenYearsFromNow) {
          field.validationStatus = 'warning';
          field.validationMessages.push('Date is outside typical range (±10 years)');
          modificationsCount++;
        }
      }

      // Check 4: Currency sanity check  
      if (field.valueType === 'currency' && field.normalizedValue?.amount) {
        const amount = field.normalizedValue.amount;
        if (amount > 1000000000) { // > $1B
          field.validationStatus = 'warning';
          field.validationMessages.push('Unusually large amount - verify');
          modificationsCount++;
        }
      }

      // Check 5: Percentage sanity check
      if (field.valueType === 'percentage' && field.normalizedValue !== null) {
        if (field.normalizedValue > 100 || field.normalizedValue < 0) {
          field.validationStatus = 'error';
          field.validationMessages.push('Percentage outside valid range (0-100)');
          field.confidence = 0.3;
          modificationsCount++;
        }
      }
    }

    return { fields: correctedFields, modificationsCount };
  }

  // ==========================================================================
  // CROSS-VALIDATION
  // ==========================================================================

  private runCrossValidation(fields: ExtractedField[]): CrossValidationResult[] {
    const results: CrossValidationResult[] = [];
    const fieldMap = new Map(fields.map(f => [f.fieldName, f]));

    for (const rule of CROSS_VALIDATION_RULES) {
      // Check if we have enough fields for this rule
      const hasRequiredFields = rule.fields.some(fieldName => fieldMap.has(fieldName));
      if (hasRequiredFields) {
        const result = rule.validate(fieldMap);
        results.push(result);
      }
    }

    return results;
  }

  // ==========================================================================
  // RELATIONSHIP BUILDING
  // ==========================================================================

  private buildRelationships(fields: ExtractedField[]): FieldRelationship[] {
    const relationships: FieldRelationship[] = [];
    
    // Date relationships
    const dateFields = fields.filter(f => f.valueType === 'date');
    for (let i = 0; i < dateFields.length; i++) {
      for (let j = i + 1; j < dateFields.length; j++) {
        relationships.push({
          fromFieldId: dateFields[i].id,
          toFieldId: dateFields[j].id,
          relationshipType: 'related_to',
          description: 'Both are date fields that may form a timeline',
          strength: 0.6
        });
      }
    }

    // Financial relationships
    const financialFields = fields.filter(f => f.category === 'financial');
    for (let i = 0; i < financialFields.length; i++) {
      for (let j = i + 1; j < financialFields.length; j++) {
        relationships.push({
          fromFieldId: financialFields[i].id,
          toFieldId: financialFields[j].id,
          relationshipType: 'related_to',
          description: 'Related financial values',
          strength: 0.5
        });
      }
    }

    // Term ↔ Dates relationship
    const termField = fields.find(f => f.fieldName.includes('term') || f.fieldName.includes('duration'));
    const effectiveDate = fields.find(f => f.fieldName.includes('effective'));
    const expirationDate = fields.find(f => f.fieldName.includes('expir'));
    
    if (termField && effectiveDate) {
      relationships.push({
        fromFieldId: termField.id,
        toFieldId: effectiveDate.id,
        relationshipType: 'validates',
        description: 'Term duration should match date calculations',
        strength: 0.8
      });
    }
    
    if (termField && expirationDate) {
      relationships.push({
        fromFieldId: termField.id,
        toFieldId: expirationDate.id,
        relationshipType: 'validates',
        description: 'Term duration should match date calculations',
        strength: 0.8
      });
    }

    return relationships;
  }

  // ==========================================================================
  // VALIDATION REPORT
  // ==========================================================================

  private generateValidationReport(
    fields: ExtractedField[],
    crossValidationResults: CrossValidationResult[],
    profile: DocumentProfile
  ): ValidationReport {
    const validFields = fields.filter(f => f.validationStatus === 'valid');
    const warningFields = fields.filter(f => f.validationStatus === 'warning');
    const errorFields = fields.filter(f => f.validationStatus === 'error');

    // Check for missing critical fields
    const criticalFieldNames = [
      'effective_date', 'expiration_date', 'total_value', 
      'party_client', 'party_vendor', 'governing_law'
    ];
    const extractedFieldNames = new Set(fields.map(f => f.fieldName));
    const missingCriticalFields = criticalFieldNames.filter(f => !extractedFieldNames.has(f));

    // Detect anomalies
    const anomalies: DataAnomaly[] = [];
    
    for (const field of fields) {
      // Check for duplicates
      const duplicates = fields.filter(f => 
        f.id !== field.id && 
        f.fieldName === field.fieldName
      );
      if (duplicates.length > 0) {
        anomalies.push({
          type: 'duplicate',
          fieldId: field.id,
          description: `Duplicate field: ${field.displayName}`,
          actualValue: field.value,
          suggestedAction: 'Review and remove duplicate'
        });
      }
    }

    // Calculate overall score
    const totalFields = fields.length;
    const avgConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / (totalFields || 1);
    const crossValidationScore = crossValidationResults.filter(r => r.passed).length / (crossValidationResults.length || 1);
    const overallScore = (avgConfidence * 0.6) + (crossValidationScore * 0.3) + (profile.completeness * 0.1);

    // Generate suggestions
    const suggestions: ValidationSuggestion[] = [];
    
    if (missingCriticalFields.length > 0) {
      suggestions.push({
        type: 'add',
        message: `Missing critical fields: ${missingCriticalFields.join(', ')}`,
        priority: 'critical'
      });
    }
    
    for (const field of errorFields) {
      suggestions.push({
        type: 'verify',
        fieldId: field.id,
        message: `Verify ${field.displayName}: ${field.validationMessages.join('; ')}`,
        priority: 'high'
      });
    }

    return {
      overallScore,
      totalFields,
      validFields: validFields.length,
      warningFields: warningFields.length,
      errorFields: errorFields.length,
      crossValidationResults,
      missingCriticalFields,
      anomalies,
      suggestions
    };
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private mergeFields(existing: ExtractedField[], newFields: ExtractedField[]): ExtractedField[] {
    const merged = [...existing];
    
    for (const newField of newFields) {
      const existingIdx = merged.findIndex(f => f.fieldName === newField.fieldName);
      
      if (existingIdx >= 0) {
        // Keep the one with higher confidence
        if (newField.confidence > merged[existingIdx].confidence) {
          merged[existingIdx] = newField;
        }
      } else {
        merged.push(newField);
      }
    }
    
    return merged;
  }

  private normalizeValue(value: any, valueType: FieldValueType): any {
    const normalizer = VALUE_NORMALIZERS[valueType];
    if (normalizer) {
      return normalizer.normalize(value);
    }
    return value;
  }

  private inferValueType(value: any, category: FieldCategory): FieldValueType {
    const str = String(value);
    
    // Currency
    if (/[$€£¥]|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|CAD)/i.test(str)) {
      return 'currency';
    }
    
    // Percentage
    if (/\d+(?:\.\d+)?%/.test(str)) {
      return 'percentage';
    }
    
    // Date
    if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/.test(str)) {
      return 'date';
    }
    
    // Duration
    if (/\d+\s*(year|month|day|week|hour)s?/i.test(str)) {
      return 'duration';
    }
    
    // Number
    if (/^\d+(?:\.\d+)?$/.test(str)) {
      return 'number';
    }
    
    // Category-based inference
    if (category === 'temporal') return 'date';
    if (category === 'financial') return 'currency';
    
    return 'string';
  }

  private inferImportance(fieldName: string, category: FieldCategory): ImportanceLevel {
    const criticalFields = ['effective_date', 'expiration_date', 'total_value', 'liability_cap'];
    const highFields = ['payment_terms', 'notice_period', 'termination', 'renewal', 'governing_law'];
    
    if (criticalFields.some(f => fieldName.includes(f))) return 'critical';
    if (highFields.some(f => fieldName.includes(f))) return 'high';
    if (category === 'financial' || category === 'legal') return 'high';
    if (category === 'temporal' || category === 'obligations') return 'medium';
    
    return 'medium';
  }

  private toDisplayName(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Export singleton instance
export const enhancedExtractionEngine = EnhancedExtractionEngine.getInstance();
