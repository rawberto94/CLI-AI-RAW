/**
 * Smart Auto-Correction Service
 * 
 * Automatically detects and corrects common extraction errors.
 * Uses patterns, context, and learned rules to fix values.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('SmartAutoCorrectionService');

// Correction types
export type CorrectionType = 
  | 'format_normalization'
  | 'typo_correction'
  | 'unit_conversion'
  | 'date_standardization'
  | 'currency_formatting'
  | 'entity_name_correction'
  | 'missing_value_inference'
  | 'value_range_correction'
  | 'context_based_correction'
  | 'pattern_based_correction';

export interface CorrectionRule {
  id: string;
  name: string;
  type: CorrectionType;
  field: string | '*';  // '*' applies to all fields
  priority: number;
  
  // Detection
  detect: (value: unknown, context: CorrectionContext) => boolean;
  
  // Correction
  correct: (value: unknown, context: CorrectionContext) => CorrectedValue;
  
  // Confidence
  confidenceImpact: number;  // How much to adjust confidence after correction
}

export interface CorrectionContext {
  field: string;
  originalValue: unknown;
  documentText?: string;
  extractedData?: Record<string, unknown>;
  contractType?: string;
  industry?: string;
  previousCorrections?: AppliedCorrection[];
}

export interface CorrectedValue {
  value: unknown;
  confidence: number;
  explanation: string;
  alternatives?: unknown[];
}

export interface AppliedCorrection {
  field: string;
  ruleId: string;
  ruleName: string;
  type: CorrectionType;
  originalValue: unknown;
  correctedValue: unknown;
  confidence: number;
  explanation: string;
  timestamp: Date;
  requiresReview: boolean;
}

export interface CorrectionResult {
  corrected: boolean;
  data: Record<string, unknown>;
  corrections: AppliedCorrection[];
  confidenceAdjustments: Record<string, number>;
  suggestedReviews: Array<{
    field: string;
    reason: string;
    originalValue: unknown;
    suggestedValue: unknown;
  }>;
}

// Built-in correction rules
const DATE_FORMATS = [
  { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: 'MM/DD/YYYY' },
  { pattern: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, format: 'MM/DD/YY' },
  { pattern: /^(\d{4})-(\d{2})-(\d{2})$/, format: 'YYYY-MM-DD' },
  { pattern: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: 'DD-MM-YYYY' },
  { pattern: /^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/, format: 'Month DD, YYYY' },
  { pattern: /^(\d{1,2})\s+(\w+)\s+(\d{4})$/, format: 'DD Month YYYY' },
  { pattern: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, format: 'DD.MM.YYYY' },
];

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  'CHF': 'CHF',
  'A$': 'AUD',
  'C$': 'CAD',
};

const COMMON_TYPOS: Record<string, string> = {
  'agrement': 'agreement',
  'agrrement': 'agreement',
  'agreemnt': 'agreement',
  'confidental': 'confidential',
  'confidentail': 'confidential',
  'termnation': 'termination',
  'terminaton': 'termination',
  'indemnificaton': 'indemnification',
  'liabilty': 'liability',
  'waranty': 'warranty',
  'warrantee': 'warranty',
  'recieve': 'receive',
  'reciept': 'receipt',
  'occured': 'occurred',
  'occurence': 'occurrence',
  'seperately': 'separately',
  'accomodate': 'accommodate',
  'maintainance': 'maintenance',
  'definiton': 'definition',
  'provisoin': 'provision',
  'obligaton': 'obligation',
  'represenation': 'representation',
  'assignement': 'assignment',
  'ammendment': 'amendment',
  'notcie': 'notice',
  'governign': 'governing',
  'jurisdicton': 'jurisdiction',
};

export class SmartAutoCorrectionService {
  private rules: Map<string, CorrectionRule> = new Map();
  private fieldSpecificRules: Map<string, CorrectionRule[]> = new Map();
  private learnedPatterns: Map<string, LearnedPattern[]> = new Map();
  
  constructor() {
    this.initializeBuiltInRules();
    logger.info('Smart auto-correction service initialized', { ruleCount: this.rules.size });
  }
  
  /**
   * Apply corrections to extracted data
   */
  applyCorrections(
    data: Record<string, unknown>,
    context: Partial<CorrectionContext> = {}
  ): CorrectionResult {
    logger.debug('Applying corrections', { fieldCount: Object.keys(data).length });
    
    const corrections: AppliedCorrection[] = [];
    const confidenceAdjustments: Record<string, number> = {};
    const suggestedReviews: CorrectionResult['suggestedReviews'] = [];
    const correctedData = { ...data };
    
    // Apply corrections for each field
    for (const [field, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      
      const fieldContext: CorrectionContext = {
        ...context,
        field,
        originalValue: value,
        extractedData: data,
        previousCorrections: corrections,
      };
      
      // Get applicable rules
      const applicableRules = this.getApplicableRules(field);
      
      // Sort by priority
      applicableRules.sort((a, b) => b.priority - a.priority);
      
      let currentValue = value;
      let totalConfidenceAdjustment = 0;
      
      for (const rule of applicableRules) {
        try {
          if (rule.detect(currentValue, fieldContext)) {
            const corrected = rule.correct(currentValue, fieldContext);
            
            // Check if value actually changed
            if (JSON.stringify(corrected.value) !== JSON.stringify(currentValue)) {
              const correction: AppliedCorrection = {
                field,
                ruleId: rule.id,
                ruleName: rule.name,
                type: rule.type,
                originalValue: currentValue,
                correctedValue: corrected.value,
                confidence: corrected.confidence,
                explanation: corrected.explanation,
                timestamp: new Date(),
                requiresReview: corrected.confidence < 0.8,
              };
              
              corrections.push(correction);
              currentValue = corrected.value as typeof currentValue;
              totalConfidenceAdjustment += rule.confidenceImpact;
              
              // Add to review suggestions if low confidence
              if (correction.requiresReview) {
                suggestedReviews.push({
                  field,
                  reason: corrected.explanation,
                  originalValue: correction.originalValue,
                  suggestedValue: correction.correctedValue,
                });
              }
            }
          }
        } catch (error) {
          logger.warn('Correction rule failed', { ruleId: rule.id, field, error });
        }
      }
      
      // Update corrected data
      correctedData[field] = currentValue;
      
      if (totalConfidenceAdjustment !== 0) {
        confidenceAdjustments[field] = totalConfidenceAdjustment;
      }
    }
    
    // Apply cross-field corrections
    const crossFieldCorrections = this.applyCrossFieldCorrections(correctedData, context);
    corrections.push(...crossFieldCorrections);
    
    return {
      corrected: corrections.length > 0,
      data: correctedData,
      corrections,
      confidenceAdjustments,
      suggestedReviews,
    };
  }
  
  /**
   * Get rules applicable to a field
   */
  private getApplicableRules(field: string): CorrectionRule[] {
    const rules: CorrectionRule[] = [];
    
    // Field-specific rules
    const fieldRules = this.fieldSpecificRules.get(field.toLowerCase());
    if (fieldRules) {
      rules.push(...fieldRules);
    }
    
    // Generic rules (apply to all fields)
    const genericRules = this.fieldSpecificRules.get('*');
    if (genericRules) {
      rules.push(...genericRules);
    }
    
    // Check for partial matches
    for (const [key, keyRules] of this.fieldSpecificRules.entries()) {
      if (key !== '*' && key !== field.toLowerCase()) {
        // Check if field contains the key or vice versa
        if (field.toLowerCase().includes(key) || key.includes(field.toLowerCase())) {
          rules.push(...keyRules);
        }
      }
    }
    
    return rules;
  }
  
  /**
   * Initialize built-in correction rules
   */
  private initializeBuiltInRules(): void {
    // Date standardization rules
    this.addRule({
      id: 'date-standardization',
      name: 'Date Format Standardization',
      type: 'date_standardization',
      field: '*',
      priority: 100,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        return DATE_FORMATS.some(f => f.pattern.test(value));
      },
      correct: (value, context) => {
        const strValue = String(value);
        const standardized = this.standardizeDate(strValue);
        return {
          value: standardized.date,
          confidence: standardized.confidence,
          explanation: `Standardized date from "${strValue}" to ISO format`,
        };
      },
      confidenceImpact: 0.05,
    });
    
    // Written date to ISO conversion
    this.addRule({
      id: 'written-date-conversion',
      name: 'Written Date Conversion',
      type: 'date_standardization',
      field: '*',
      priority: 99,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        // Matches: "January 1, 2024", "1st January 2024", etc.
        return /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(value);
      },
      correct: (value) => {
        const strValue = String(value);
        const converted = this.convertWrittenDate(strValue);
        return {
          value: converted.date,
          confidence: converted.confidence,
          explanation: `Converted written date "${strValue}" to ISO format`,
        };
      },
      confidenceImpact: 0.03,
    });
    
    // Currency formatting
    this.addRule({
      id: 'currency-formatting',
      name: 'Currency Format Normalization',
      type: 'currency_formatting',
      field: '*',
      priority: 95,
      detect: (value, context) => {
        if (typeof value !== 'string') return false;
        // Check if this is a monetary field
        const field = context.field.toLowerCase();
        const isMonetaryField = ['amount', 'value', 'fee', 'price', 'cost', 'payment', 'salary', 'rate'].some(
          t => field.includes(t)
        );
        if (!isMonetaryField) return false;
        
        // Has currency indicators
        return /[$€£¥]|USD|EUR|GBP/.test(value) || /\d{1,3}(,\d{3})+(\.\d{2})?/.test(value);
      },
      correct: (value) => {
        const strValue = String(value);
        const normalized = this.normalizeCurrency(strValue);
        return {
          value: normalized.formatted,
          confidence: normalized.confidence,
          explanation: `Normalized currency format: ${normalized.formatted}`,
          alternatives: [normalized.numeric],
        };
      },
      confidenceImpact: 0.02,
    });
    
    // Percentage normalization
    this.addRule({
      id: 'percentage-normalization',
      name: 'Percentage Format Normalization',
      type: 'format_normalization',
      field: '*',
      priority: 90,
      detect: (value, context) => {
        if (typeof value !== 'string') return false;
        const field = context.field.toLowerCase();
        const isPercentageField = ['percent', 'rate', 'discount', 'interest', 'margin'].some(
          t => field.includes(t)
        );
        return isPercentageField && /\d+(\.\d+)?/.test(value);
      },
      correct: (value) => {
        const strValue = String(value).replace('%', '').trim();
        const num = parseFloat(strValue);
        
        if (isNaN(num)) {
          return { value, confidence: 0.5, explanation: 'Could not parse percentage' };
        }
        
        // Normalize to percentage format
        const normalized = `${num}%`;
        return {
          value: normalized,
          confidence: 0.95,
          explanation: `Normalized percentage to "${normalized}"`,
        };
      },
      confidenceImpact: 0.02,
    });
    
    // Typo correction
    this.addRule({
      id: 'typo-correction',
      name: 'Common Typo Correction',
      type: 'typo_correction',
      field: '*',
      priority: 80,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        const lower = value.toLowerCase();
        return Object.keys(COMMON_TYPOS).some(typo => lower.includes(typo));
      },
      correct: (value) => {
        let strValue = String(value);
        let corrected = false;
        
        for (const [typo, correction] of Object.entries(COMMON_TYPOS)) {
          const regex = new RegExp(typo, 'gi');
          if (regex.test(strValue)) {
            strValue = strValue.replace(regex, (match) => {
              // Preserve case
              if (match[0] === match[0].toUpperCase()) {
                return correction.charAt(0).toUpperCase() + correction.slice(1);
              }
              return correction;
            });
            corrected = true;
          }
        }
        
        return {
          value: strValue,
          confidence: corrected ? 0.9 : 1,
          explanation: corrected ? 'Corrected common typos' : 'No typos found',
        };
      },
      confidenceImpact: -0.05,
    });
    
    // Party name correction
    this.addRule({
      id: 'party-name-normalization',
      name: 'Party Name Normalization',
      type: 'entity_name_correction',
      field: 'party',
      priority: 85,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        // Detect common entity suffixes that need normalization
        return /\b(inc\.?|corp\.?|llc\.?|ltd\.?|co\.?|l\.l\.c\.?|p\.c\.?)\b/i.test(value);
      },
      correct: (value) => {
        let strValue = String(value).trim();
        
        // Normalize entity suffixes
        const suffixMap: Record<string, string> = {
          'inc.': 'Inc.',
          'inc': 'Inc.',
          'corp.': 'Corp.',
          'corp': 'Corp.',
          'llc': 'LLC',
          'l.l.c.': 'LLC',
          'l.l.c': 'LLC',
          'ltd.': 'Ltd.',
          'ltd': 'Ltd.',
          'co.': 'Co.',
          'co': 'Co.',
          'p.c.': 'P.C.',
          'p.c': 'P.C.',
        };
        
        for (const [pattern, replacement] of Object.entries(suffixMap)) {
          const regex = new RegExp(`\\b${pattern.replace('.', '\\.')}$`, 'i');
          if (regex.test(strValue)) {
            strValue = strValue.replace(regex, replacement);
            break;
          }
        }
        
        return {
          value: strValue,
          confidence: 0.95,
          explanation: 'Normalized entity name suffix',
        };
      },
      confidenceImpact: 0.02,
    });
    
    // Term duration normalization
    this.addRule({
      id: 'term-duration-normalization',
      name: 'Term Duration Normalization',
      type: 'format_normalization',
      field: 'term',
      priority: 85,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        return /\d+\s*(year|month|week|day|yr|mo|wk)/i.test(value);
      },
      correct: (value) => {
        const strValue = String(value).toLowerCase();
        
        // Extract number and unit
        const match = strValue.match(/(\d+)\s*(years?|yrs?|months?|mos?|weeks?|wks?|days?)/i);
        if (!match) {
          return { value, confidence: 0.5, explanation: 'Could not parse duration' };
        }
        
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        // Normalize units
        let normalizedUnit = 'months';
        if (/year|yr/.test(unit)) normalizedUnit = 'years';
        else if (/month|mo/.test(unit)) normalizedUnit = 'months';
        else if (/week|wk/.test(unit)) normalizedUnit = 'weeks';
        else if (/day/.test(unit)) normalizedUnit = 'days';
        
        const normalized = `${num} ${normalizedUnit}`;
        return {
          value: normalized,
          confidence: 0.95,
          explanation: `Normalized duration to "${normalized}"`,
        };
      },
      confidenceImpact: 0.02,
    });
    
    // Notice period normalization
    this.addRule({
      id: 'notice-period-normalization',
      name: 'Notice Period Normalization',
      type: 'format_normalization',
      field: 'notice',
      priority: 85,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        return /(\d+)\s*(?:days?|business\s*days?|calendar\s*days?)/i.test(value);
      },
      correct: (value) => {
        const strValue = String(value);
        const match = strValue.match(/(\d+)\s*(business\s*days?|calendar\s*days?|days?)/i);
        
        if (!match) {
          return { value, confidence: 0.5, explanation: 'Could not parse notice period' };
        }
        
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        let normalized: string;
        if (unit.includes('business')) {
          normalized = `${num} business days`;
        } else if (unit.includes('calendar')) {
          normalized = `${num} calendar days`;
        } else {
          normalized = `${num} days`;
        }
        
        return {
          value: normalized,
          confidence: 0.95,
          explanation: `Normalized notice period to "${normalized}"`,
        };
      },
      confidenceImpact: 0.02,
    });
    
    // Email format validation
    this.addRule({
      id: 'email-validation',
      name: 'Email Format Validation',
      type: 'format_normalization',
      field: 'email',
      priority: 90,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        // Has @ but might have issues
        return value.includes('@');
      },
      correct: (value) => {
        let strValue = String(value).toLowerCase().trim();
        
        // Remove common prefixes
        strValue = strValue.replace(/^(email:|e-mail:|mailto:)/i, '');
        
        // Basic validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isValid = emailRegex.test(strValue);
        
        return {
          value: strValue,
          confidence: isValid ? 0.95 : 0.5,
          explanation: isValid ? 'Email format validated' : 'Email format may be invalid',
        };
      },
      confidenceImpact: 0,
    });
    
    // Boolean normalization
    this.addRule({
      id: 'boolean-normalization',
      name: 'Boolean Value Normalization',
      type: 'format_normalization',
      field: '*',
      priority: 70,
      detect: (value, context) => {
        if (typeof value !== 'string') return false;
        const field = context.field.toLowerCase();
        const isBooleanField = ['auto', 'renewal', 'enable', 'allow', 'require', 'mandatory', 'optional'].some(
          t => field.includes(t)
        );
        if (!isBooleanField) return false;
        
        const lower = value.toLowerCase();
        return ['yes', 'no', 'true', 'false', 'y', 'n', 'enabled', 'disabled'].includes(lower);
      },
      correct: (value) => {
        const lower = String(value).toLowerCase();
        const trueValues = ['yes', 'true', 'y', 'enabled', '1'];
        const falseValues = ['no', 'false', 'n', 'disabled', '0'];
        
        if (trueValues.includes(lower)) {
          return { value: true, confidence: 0.95, explanation: 'Normalized to boolean true' };
        }
        if (falseValues.includes(lower)) {
          return { value: false, confidence: 0.95, explanation: 'Normalized to boolean false' };
        }
        
        return { value, confidence: 0.5, explanation: 'Could not determine boolean value' };
      },
      confidenceImpact: 0.02,
    });
    
    // Phone number normalization
    this.addRule({
      id: 'phone-normalization',
      name: 'Phone Number Normalization',
      type: 'format_normalization',
      field: 'phone',
      priority: 85,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        // Has digits that look like a phone number
        return /[\d\s\-\(\)\+\.]{10,}/.test(value);
      },
      correct: (value) => {
        let strValue = String(value);
        
        // Extract just digits
        const digits = strValue.replace(/\D/g, '');
        
        if (digits.length < 10) {
          return { value, confidence: 0.5, explanation: 'Phone number too short' };
        }
        
        // Format US phone numbers
        if (digits.length === 10) {
          const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
          return { value: formatted, confidence: 0.95, explanation: 'Formatted as US phone number' };
        }
        
        if (digits.length === 11 && digits[0] === '1') {
          const formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
          return { value: formatted, confidence: 0.95, explanation: 'Formatted as US phone number with country code' };
        }
        
        // International format
        const formatted = `+${digits}`;
        return { value: formatted, confidence: 0.85, explanation: 'Formatted as international phone number' };
      },
      confidenceImpact: 0.02,
    });
    
    // State abbreviation normalization
    this.addRule({
      id: 'state-abbreviation',
      name: 'US State Abbreviation Normalization',
      type: 'format_normalization',
      field: 'state',
      priority: 85,
      detect: (value) => {
        if (typeof value !== 'string') return false;
        return /^[A-Za-z]{2,}$/.test(value.trim());
      },
      correct: (value) => {
        const states: Record<string, string> = {
          'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
          'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
          'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
          'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
          'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
          'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
          'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
          'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
          'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
          'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
          'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
          'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
          'wisconsin': 'WI', 'wyoming': 'WY',
        };
        
        const strValue = String(value).toLowerCase().trim();
        const abbrev = states[strValue];
        
        if (abbrev) {
          return { value: abbrev, confidence: 0.95, explanation: `Converted state name to abbreviation: ${abbrev}` };
        }
        
        // Already an abbreviation
        if (strValue.length === 2 && Object.values(states).includes(strValue.toUpperCase())) {
          return { value: strValue.toUpperCase(), confidence: 0.95, explanation: 'Normalized state abbreviation to uppercase' };
        }
        
        return { value, confidence: 0.8, explanation: 'Could not normalize state' };
      },
      confidenceImpact: 0.02,
    });
  }
  
  /**
   * Standardize date to ISO format
   */
  private standardizeDate(value: string): { date: string; confidence: number } {
    for (const format of DATE_FORMATS) {
      const match = format.pattern.exec(value);
      if (match) {
        let year: number, month: number, day: number;
        
        switch (format.format) {
          case 'MM/DD/YYYY':
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            year = parseInt(match[3]);
            break;
          case 'MM/DD/YY':
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            year = 2000 + parseInt(match[3]);
            break;
          case 'YYYY-MM-DD':
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
            break;
          case 'DD-MM-YYYY':
          case 'DD.MM.YYYY':
            day = parseInt(match[1]);
            month = parseInt(match[2]);
            year = parseInt(match[3]);
            break;
          default:
            return { date: value, confidence: 0.5 };
        }
        
        // Validate date
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
          return { date: value, confidence: 0.3 };
        }
        
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: iso, confidence: 0.95 };
      }
    }
    
    return { date: value, confidence: 0.5 };
  }
  
  /**
   * Convert written date to ISO format
   */
  private convertWrittenDate(value: string): { date: string; confidence: number } {
    // Try "Month DD, YYYY" format
    let match = value.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (match) {
      const monthName = match[1].toLowerCase();
      const day = parseInt(match[2]);
      const year = parseInt(match[3]);
      const month = MONTH_NAMES[monthName];
      
      if (month && day >= 1 && day <= 31 && year >= 1900) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: iso, confidence: 0.95 };
      }
    }
    
    // Try "DD Month YYYY" format
    match = value.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (match) {
      const day = parseInt(match[1]);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3]);
      const month = MONTH_NAMES[monthName];
      
      if (month && day >= 1 && day <= 31 && year >= 1900) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: iso, confidence: 0.95 };
      }
    }
    
    // Try "DDth/st/nd/rd Month YYYY" format
    match = value.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s+(\d{4})/i);
    if (match) {
      const day = parseInt(match[1]);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3]);
      const month = MONTH_NAMES[monthName];
      
      if (month && day >= 1 && day <= 31 && year >= 1900) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: iso, confidence: 0.95 };
      }
    }
    
    return { date: value, confidence: 0.5 };
  }
  
  /**
   * Normalize currency value
   */
  private normalizeCurrency(value: string): { formatted: string; numeric: number; confidence: number } {
    // Extract currency symbol
    let currency = 'USD';
    for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
      if (value.includes(symbol)) {
        currency = code;
        break;
      }
    }
    
    // Extract numeric value
    const numericStr = value.replace(/[^0-9.,]/g, '');
    
    // Handle European format (1.234,56) vs US format (1,234.56)
    let numericValue: number;
    if (/^\d{1,3}(\.\d{3})*(,\d{2})?$/.test(numericStr)) {
      // European format
      numericValue = parseFloat(numericStr.replace(/\./g, '').replace(',', '.'));
    } else {
      // US format
      numericValue = parseFloat(numericStr.replace(/,/g, ''));
    }
    
    if (isNaN(numericValue)) {
      return { formatted: value, numeric: 0, confidence: 0.5 };
    }
    
    // Format with proper symbol
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(numericValue);
    
    return { formatted, numeric: numericValue, confidence: 0.95 };
  }
  
  /**
   * Apply cross-field corrections
   */
  private applyCrossFieldCorrections(
    data: Record<string, unknown>,
    context: Partial<CorrectionContext>
  ): AppliedCorrection[] {
    const corrections: AppliedCorrection[] = [];
    
    // Check effective date vs termination date
    if (data.effectiveDate && data.terminationDate) {
      const effective = new Date(String(data.effectiveDate));
      const termination = new Date(String(data.terminationDate));
      
      if (termination < effective) {
        // Dates might be swapped
        corrections.push({
          field: 'terminationDate',
          ruleId: 'cross-field-date-order',
          ruleName: 'Date Order Validation',
          type: 'context_based_correction',
          originalValue: data.terminationDate,
          correctedValue: data.terminationDate,
          confidence: 0.5,
          explanation: 'Warning: Termination date is before effective date. This may be an error.',
          timestamp: new Date(),
          requiresReview: true,
        });
      }
    }
    
    // Check payment terms consistency
    if (data.paymentTerms && data.invoiceFrequency) {
      const terms = String(data.paymentTerms).toLowerCase();
      const frequency = String(data.invoiceFrequency).toLowerCase();
      
      // Net 30 with daily invoicing might be unusual
      if (terms.includes('net 30') && frequency.includes('daily')) {
        corrections.push({
          field: 'invoiceFrequency',
          ruleId: 'cross-field-payment-consistency',
          ruleName: 'Payment Terms Consistency',
          type: 'context_based_correction',
          originalValue: data.invoiceFrequency,
          correctedValue: data.invoiceFrequency,
          confidence: 0.7,
          explanation: 'Note: Daily invoicing with Net 30 payment terms is unusual. Please verify.',
          timestamp: new Date(),
          requiresReview: true,
        });
      }
    }
    
    // Check liability cap vs contract value
    if (data.liabilityCap && data.contractValue) {
      const cap = this.extractNumericValue(String(data.liabilityCap));
      const value = this.extractNumericValue(String(data.contractValue));
      
      if (cap && value && cap > value * 10) {
        corrections.push({
          field: 'liabilityCap',
          ruleId: 'cross-field-liability-ratio',
          ruleName: 'Liability Cap Ratio Check',
          type: 'context_based_correction',
          originalValue: data.liabilityCap,
          correctedValue: data.liabilityCap,
          confidence: 0.6,
          explanation: 'Warning: Liability cap is significantly higher than contract value.',
          timestamp: new Date(),
          requiresReview: true,
        });
      }
    }
    
    return corrections;
  }
  
  /**
   * Extract numeric value from string
   */
  private extractNumericValue(value: string): number | null {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Add a correction rule
   */
  addRule(rule: CorrectionRule): void {
    this.rules.set(rule.id, rule);
    
    // Index by field
    const fieldKey = rule.field.toLowerCase();
    const existing = this.fieldSpecificRules.get(fieldKey) || [];
    existing.push(rule);
    this.fieldSpecificRules.set(fieldKey, existing);
    
    logger.debug('Added correction rule', { ruleId: rule.id, field: rule.field });
  }
  
  /**
   * Learn a pattern from corrected data
   */
  learnPattern(
    field: string,
    originalValue: unknown,
    correctedValue: unknown,
    context?: Partial<CorrectionContext>
  ): void {
    const pattern: LearnedPattern = {
      field,
      originalPattern: this.extractPattern(originalValue),
      correctedPattern: this.extractPattern(correctedValue),
      examples: [{ original: originalValue, corrected: correctedValue }],
      confidence: 0.7,
      occurrences: 1,
      lastSeen: new Date(),
    };
    
    const existing = this.learnedPatterns.get(field) || [];
    
    // Check if similar pattern exists
    const similarIndex = existing.findIndex(p => 
      p.originalPattern === pattern.originalPattern
    );
    
    if (similarIndex >= 0) {
      // Update existing pattern
      existing[similarIndex].occurrences++;
      existing[similarIndex].confidence = Math.min(0.95, existing[similarIndex].confidence + 0.05);
      existing[similarIndex].lastSeen = new Date();
      existing[similarIndex].examples.push({ original: originalValue, corrected: correctedValue });
    } else {
      existing.push(pattern);
    }
    
    this.learnedPatterns.set(field, existing);
    
    logger.debug('Learned correction pattern', { field, pattern: pattern.originalPattern });
  }
  
  /**
   * Extract pattern from value
   */
  private extractPattern(value: unknown): string {
    if (typeof value !== 'string') {
      return typeof value;
    }
    
    // Replace specific values with pattern placeholders
    let pattern = value
      .replace(/\d+/g, '#')  // Numbers
      .replace(/[A-Z]{2,}/g, 'CAPS')  // Uppercase words
      .replace(/\b[a-z]+\b/gi, 'word');  // Words
    
    return pattern;
  }
  
  /**
   * Get correction statistics
   */
  getStatistics(): CorrectionStatistics {
    const stats: CorrectionStatistics = {
      totalRules: this.rules.size,
      rulesByType: {},
      learnedPatterns: 0,
    };
    
    for (const rule of this.rules.values()) {
      stats.rulesByType[rule.type] = (stats.rulesByType[rule.type] || 0) + 1;
    }
    
    for (const patterns of this.learnedPatterns.values()) {
      stats.learnedPatterns += patterns.length;
    }
    
    return stats;
  }
}

interface LearnedPattern {
  field: string;
  originalPattern: string;
  correctedPattern: string;
  examples: Array<{ original: unknown; corrected: unknown }>;
  confidence: number;
  occurrences: number;
  lastSeen: Date;
}

interface CorrectionStatistics {
  totalRules: number;
  rulesByType: Record<string, number>;
  learnedPatterns: number;
}

// Export singleton instance
export const smartAutoCorrectionService = new SmartAutoCorrectionService();
