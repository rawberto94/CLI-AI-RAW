/**
 * Smart Fallback Chain Service
 * 
 * Provides a sophisticated fallback chain for field extraction:
 * 1. Pattern-based extraction (fastest, most reliable)
 * 2. AI extraction with prompt engineering
 * 3. Semantic inference from context
 * 4. Related field inference
 * 5. Historical value lookup
 * 
 * Each method has quality scores, and results are combined with weighted confidence.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('smart-fallback-chain');

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionResult {
  value: any;
  confidence: number;
  source: ExtractionSource;
  evidence: string;
  fallbackLevel: number;
}

export type ExtractionSource = 
  | 'pattern'
  | 'ai_direct'
  | 'ai_contextual'
  | 'semantic_inference'
  | 'related_field_inference'
  | 'historical_lookup'
  | 'default_value'
  | 'user_correction';

export interface FallbackConfig {
  enablePatternExtraction: boolean;
  enableAIExtraction: boolean;
  enableSemanticInference: boolean;
  enableRelatedFieldInference: boolean;
  enableHistoricalLookup: boolean;
  enableDefaultValues: boolean;
  minConfidenceThreshold: number;
  maxFallbackLevels: number;
}

export interface FieldExtractionSpec {
  fieldName: string;
  displayName: string;
  patterns: RegExp[];
  semanticHints: string[];
  relatedFields: string[];
  defaultValue?: any;
  valueType: 'string' | 'number' | 'date' | 'currency' | 'duration' | 'percentage' | 'boolean';
  normalizer?: (value: any) => any;
}

export interface ExtractionChainResult {
  fieldName: string;
  success: boolean;
  finalResult: ExtractionResult | null;
  attemptedSources: Array<{
    source: ExtractionSource;
    success: boolean;
    result: ExtractionResult | null;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
}

// ============================================================================
// FIELD EXTRACTION SPECIFICATIONS
// ============================================================================

const FIELD_SPECS: Record<string, FieldExtractionSpec> = {
  effective_date: {
    fieldName: 'effective_date',
    displayName: 'Effective Date',
    patterns: [
      /effective\s+(?:as\s+of\s+)?(?:date[:\s]+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /dated\s+(?:as\s+of\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /this\s+agreement\s+(?:is\s+)?(?:made|entered).{0,30}?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /commencing\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    ],
    semanticHints: ['start date', 'beginning date', 'commencement', 'enters into effect'],
    relatedFields: ['signature_date', 'start_date', 'commencement_date'],
    valueType: 'date',
    normalizer: normalizeDate
  },
  
  expiration_date: {
    fieldName: 'expiration_date',
    displayName: 'Expiration Date',
    patterns: [
      /(?:expires?|expiration|expiry|termination)\s+(?:date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:ending|end\s+date|terminates?)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(?:until|through)\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
    ],
    semanticHints: ['end date', 'termination date', 'expiry', 'contract ends'],
    relatedFields: ['end_date', 'termination_date', 'term_end'],
    valueType: 'date',
    normalizer: normalizeDate
  },
  
  total_value: {
    fieldName: 'total_value',
    displayName: 'Total Value',
    patterns: [
      /total\s+(?:contract\s+)?(?:value|amount|price|consideration)[:\s]+\$?([\d,]+(?:\.\d{2})?)/i,
      /aggregate\s+(?:amount|value)[:\s]+\$?([\d,]+(?:\.\d{2})?)/i,
      /not\s+(?:to\s+)?exceed\s+\$?([\d,]+(?:\.\d{2})?)/i,
      /maximum\s+(?:amount|value)[:\s]+\$?([\d,]+(?:\.\d{2})?)/i
    ],
    semanticHints: ['contract value', 'total cost', 'purchase price', 'fee amount'],
    relatedFields: ['contract_amount', 'price', 'fee', 'cost'],
    valueType: 'currency',
    normalizer: normalizeCurrency
  },
  
  payment_terms: {
    fieldName: 'payment_terms',
    displayName: 'Payment Terms',
    patterns: [
      /(?:payment|pay)\s+(?:is\s+)?(?:due\s+)?(?:within\s+)?(\d+)\s*(?:calendar\s+)?days/i,
      /net\s*(\d+)/i,
      /(\d+)\s*days?\s+(?:from\s+)?(?:invoice|receipt)/i
    ],
    semanticHints: ['payment due', 'invoice terms', 'net days', 'payment period'],
    relatedFields: ['invoice_terms', 'billing_terms', 'payment_due'],
    valueType: 'duration',
    normalizer: normalizeDuration
  },
  
  termination_notice: {
    fieldName: 'termination_notice',
    displayName: 'Termination Notice Period',
    patterns: [
      /(?:termination|terminate|cancel).{0,50}?(\d+)\s*(?:calendar\s+)?days?\s+(?:prior\s+)?(?:written\s+)?notice/i,
      /(?:provide|give).{0,30}?(\d+)\s*days?\s+(?:written\s+)?notice.{0,30}?terminat/i,
      /notice\s+period[:\s]+(\d+)\s*days?/i
    ],
    semanticHints: ['notice period', 'days notice to terminate', 'termination notice'],
    relatedFields: ['notice_period', 'cancellation_notice'],
    valueType: 'duration',
    normalizer: normalizeDuration
  },
  
  liability_cap: {
    fieldName: 'liability_cap',
    displayName: 'Liability Cap',
    patterns: [
      /(?:liability|liable).{0,100}?(?:shall not|not to|will not)\s+exceed\s+\$?([\d,]+(?:\.\d{2})?)/i,
      /limit(?:ation)?\s+(?:of\s+)?liability.{0,50}?\$?([\d,]+(?:\.\d{2})?)/i,
      /aggregate\s+liability.{0,50}?\$?([\d,]+(?:\.\d{2})?)/i,
      /cap(?:ped)?\s+at\s+\$?([\d,]+(?:\.\d{2})?)/i
    ],
    semanticHints: ['liability limit', 'damages cap', 'maximum liability', 'aggregate liability'],
    relatedFields: ['damage_cap', 'maximum_liability'],
    valueType: 'currency',
    normalizer: normalizeCurrency
  },
  
  auto_renewal: {
    fieldName: 'auto_renewal',
    displayName: 'Auto-Renewal',
    patterns: [
      /(?:shall|will)\s+(?:automatically\s+)?renew\s+for\s+(?:successive|additional|consecutive)\s+(\d+[-\s]?(?:year|month|day))/i,
      /auto(?:matic(?:ally)?)?[-\s]?renew/i,
      /renew\s+(?:automatically|for\s+additional\s+terms)/i
    ],
    semanticHints: ['automatic renewal', 'renews automatically', 'successive terms'],
    relatedFields: ['renewal_term', 'renewal_period'],
    valueType: 'boolean',
    normalizer: normalizeBoolean
  },
  
  governing_law: {
    fieldName: 'governing_law',
    displayName: 'Governing Law',
    patterns: [
      /govern(?:ed|ing)\s+(?:by\s+)?(?:the\s+)?laws?\s+of\s+(?:the\s+)?(?:State\s+of\s+)?([A-Za-z\s]+?)(?:\.|,|without)/i,
      /(?:laws?\s+of|jurisdiction\s+of)\s+(?:the\s+)?(?:State\s+of\s+)?([A-Za-z\s]+?)(?:\s+(?:shall|will|govern)|\.)/i
    ],
    semanticHints: ['governing jurisdiction', 'applicable law', 'laws of state'],
    relatedFields: ['jurisdiction', 'applicable_law', 'choice_of_law'],
    valueType: 'string'
  },
  
  sla_uptime: {
    fieldName: 'sla_uptime',
    displayName: 'SLA Uptime',
    patterns: [
      /(?:uptime|availability)\s+(?:of\s+)?(?:at\s+least\s+)?([\d.]+)\s*%/i,
      /([\d.]+)\s*%\s+(?:uptime|availability)/i,
      /service\s+level.{0,50}?([\d.]+)\s*%/i
    ],
    semanticHints: ['uptime guarantee', 'availability SLA', 'service level'],
    relatedFields: ['availability', 'uptime_guarantee'],
    valueType: 'percentage',
    normalizer: normalizePercentage
  }
};

// ============================================================================
// NORMALIZERS
// ============================================================================

function normalizeDate(value: string): string | null {
  try {
    // Handle various date formats
    const dateStr = value.trim();
    
    // ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.split('T')[0];
    }
    
    // US format MM/DD/YYYY or MM-DD-YYYY
    const usMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (usMatch) {
      let year = parseInt(usMatch[3]);
      if (year < 100) year += 2000;
      return `${year}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
    }
    
    // Named month format
    const namedMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (namedMatch) {
      const months: Record<string, string> = {
        'january': '01', 'february': '02', 'march': '03', 'april': '04',
        'may': '05', 'june': '06', 'july': '07', 'august': '08',
        'september': '09', 'october': '10', 'november': '11', 'december': '12',
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
        'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const month = months[namedMatch[1].toLowerCase()];
      if (month) {
        return `${namedMatch[3]}-${month}-${namedMatch[2].padStart(2, '0')}`;
      }
    }
    
    // Try Date.parse as last resort
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

function normalizeCurrency(value: string): { amount: number; currency: string; formatted: string } | null {
  try {
    const cleanValue = typeof value === 'string' ? value : String(value);
    
    // Extract currency symbol
    const currencyMatch = cleanValue.match(/([€$£¥]|USD|EUR|GBP|CAD|AUD)/);
    let currency = 'USD';
    if (currencyMatch) {
      const symbol = currencyMatch[1];
      if (symbol === '€' || symbol === 'EUR') currency = 'EUR';
      else if (symbol === '£' || symbol === 'GBP') currency = 'GBP';
      else if (symbol === '¥') currency = 'JPY';
      else if (symbol === 'CAD') currency = 'CAD';
      else if (symbol === 'AUD') currency = 'AUD';
    }
    
    // Extract amount
    const amountMatch = cleanValue.replace(/[€$£¥]/g, '').match(/[\d,]+(?:\.\d{2})?/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
      const symbols: Record<string, string> = {
        'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': 'CA$', 'AUD': 'A$'
      };
      return {
        amount,
        currency,
        formatted: `${symbols[currency] || '$'}${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

function normalizeDuration(value: string): { value: number; unit: string; formatted: string } | null {
  try {
    const cleanValue = typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase();
    
    // Extract number
    const numMatch = cleanValue.match(/(\d+)/);
    if (!numMatch) return null;
    
    const num = parseInt(numMatch[1]);
    
    // Determine unit
    let unit = 'days';
    if (/year/i.test(cleanValue)) unit = 'years';
    else if (/month/i.test(cleanValue)) unit = 'months';
    else if (/week/i.test(cleanValue)) unit = 'weeks';
    else if (/day/i.test(cleanValue)) unit = 'days';
    else if (/hour/i.test(cleanValue)) unit = 'hours';
    
    return {
      value: num,
      unit,
      formatted: `${num} ${unit}`
    };
  } catch {
    return null;
  }
}

function normalizePercentage(value: string): { value: number; formatted: string } | null {
  try {
    const cleanValue = typeof value === 'string' ? value : String(value);
    const numMatch = cleanValue.match(/([\d.]+)/);
    
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      return {
        value: num,
        formatted: `${num}%`
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

function normalizeBoolean(value: string): boolean {
  const cleanValue = typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase();
  return /yes|true|auto|automatic|renew/i.test(cleanValue);
}

// ============================================================================
// SMART FALLBACK CHAIN SERVICE
// ============================================================================

export class SmartFallbackChainService {
  private static instance: SmartFallbackChainService;
  private config: FallbackConfig;
  private historicalValues: Map<string, Array<{ value: any; count: number; contractType: string }>> = new Map();

  private constructor() {
    this.config = {
      enablePatternExtraction: true,
      enableAIExtraction: true,
      enableSemanticInference: true,
      enableRelatedFieldInference: true,
      enableHistoricalLookup: true,
      enableDefaultValues: true,
      minConfidenceThreshold: 0.3,
      maxFallbackLevels: 5
    };
    
    logger.info('Smart Fallback Chain Service initialized');
  }

  static getInstance(): SmartFallbackChainService {
    if (!SmartFallbackChainService.instance) {
      SmartFallbackChainService.instance = new SmartFallbackChainService();
    }
    return SmartFallbackChainService.instance;
  }

  // ==========================================================================
  // EXTRACT WITH FALLBACK CHAIN
  // ==========================================================================

  async extractWithFallback(
    fieldName: string,
    documentText: string,
    existingFields: Record<string, any> = {},
    contractType?: string,
    aiExtractor?: (fieldName: string, text: string) => Promise<{ value: any; confidence: number } | null>
  ): Promise<ExtractionChainResult> {
    const startTime = Date.now();
    const attempts: ExtractionChainResult['attemptedSources'] = [];
    let finalResult: ExtractionResult | null = null;
    
    const spec = FIELD_SPECS[fieldName];
    
    // Level 1: Pattern-based extraction
    if (this.config.enablePatternExtraction && spec?.patterns) {
      const patternStart = Date.now();
      try {
        const result = this.extractWithPatterns(fieldName, documentText, spec);
        attempts.push({
          source: 'pattern',
          success: result !== null,
          result,
          duration: Date.now() - patternStart
        });
        
        if (result && result.confidence >= this.config.minConfidenceThreshold) {
          finalResult = result;
        }
      } catch (error) {
        attempts.push({
          source: 'pattern',
          success: false,
          result: null,
          duration: Date.now() - patternStart,
          error: String(error)
        });
      }
    }

    // Level 2: Direct AI extraction
    if (!finalResult && this.config.enableAIExtraction && aiExtractor) {
      const aiStart = Date.now();
      try {
        const aiResult = await aiExtractor(fieldName, documentText);
        if (aiResult) {
          const result: ExtractionResult = {
            value: spec?.normalizer ? spec.normalizer(aiResult.value) ?? aiResult.value : aiResult.value,
            confidence: aiResult.confidence,
            source: 'ai_direct',
            evidence: 'AI extraction',
            fallbackLevel: 2
          };
          
          attempts.push({
            source: 'ai_direct',
            success: true,
            result,
            duration: Date.now() - aiStart
          });
          
          if (result.confidence >= this.config.minConfidenceThreshold) {
            finalResult = result;
          }
        } else {
          attempts.push({
            source: 'ai_direct',
            success: false,
            result: null,
            duration: Date.now() - aiStart
          });
        }
      } catch (error) {
        attempts.push({
          source: 'ai_direct',
          success: false,
          result: null,
          duration: Date.now() - aiStart,
          error: String(error)
        });
      }
    }

    // Level 3: Semantic inference from context
    if (!finalResult && this.config.enableSemanticInference && spec) {
      const semanticStart = Date.now();
      try {
        const result = this.inferFromSemanticHints(fieldName, documentText, spec);
        attempts.push({
          source: 'semantic_inference',
          success: result !== null,
          result,
          duration: Date.now() - semanticStart
        });
        
        if (result && result.confidence >= this.config.minConfidenceThreshold) {
          finalResult = result;
        }
      } catch (error) {
        attempts.push({
          source: 'semantic_inference',
          success: false,
          result: null,
          duration: Date.now() - semanticStart,
          error: String(error)
        });
      }
    }

    // Level 4: Related field inference
    if (!finalResult && this.config.enableRelatedFieldInference && spec?.relatedFields) {
      const relatedStart = Date.now();
      try {
        const result = this.inferFromRelatedFields(fieldName, existingFields, spec);
        attempts.push({
          source: 'related_field_inference',
          success: result !== null,
          result,
          duration: Date.now() - relatedStart
        });
        
        if (result && result.confidence >= this.config.minConfidenceThreshold) {
          finalResult = result;
        }
      } catch (error) {
        attempts.push({
          source: 'related_field_inference',
          success: false,
          result: null,
          duration: Date.now() - relatedStart,
          error: String(error)
        });
      }
    }

    // Level 5: Historical lookup
    if (!finalResult && this.config.enableHistoricalLookup && contractType) {
      const historicalStart = Date.now();
      try {
        const result = this.lookupHistoricalValue(fieldName, contractType);
        attempts.push({
          source: 'historical_lookup',
          success: result !== null,
          result,
          duration: Date.now() - historicalStart
        });
        
        if (result && result.confidence >= this.config.minConfidenceThreshold) {
          finalResult = result;
        }
      } catch (error) {
        attempts.push({
          source: 'historical_lookup',
          success: false,
          result: null,
          duration: Date.now() - historicalStart,
          error: String(error)
        });
      }
    }

    // Level 6: Default value
    if (!finalResult && this.config.enableDefaultValues && spec?.defaultValue !== undefined) {
      const defaultResult: ExtractionResult = {
        value: spec.defaultValue,
        confidence: 0.3,
        source: 'default_value',
        evidence: 'Default value used',
        fallbackLevel: 6
      };
      
      attempts.push({
        source: 'default_value',
        success: true,
        result: defaultResult,
        duration: 0
      });
      
      finalResult = defaultResult;
    }

    return {
      fieldName,
      success: finalResult !== null,
      finalResult,
      attemptedSources: attempts,
      totalDuration: Date.now() - startTime
    };
  }

  // ==========================================================================
  // EXTRACTION METHODS
  // ==========================================================================

  private extractWithPatterns(
    fieldName: string,
    text: string,
    spec: FieldExtractionSpec
  ): ExtractionResult | null {
    for (const pattern of spec.patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const rawValue = match[1].trim();
        const normalizedValue = spec.normalizer ? spec.normalizer(rawValue) : rawValue;
        
        return {
          value: normalizedValue ?? rawValue,
          confidence: 0.9,
          source: 'pattern',
          evidence: `Matched pattern: ${match[0].substring(0, 100)}`,
          fallbackLevel: 1
        };
      }
    }
    
    return null;
  }

  private inferFromSemanticHints(
    fieldName: string,
    text: string,
    spec: FieldExtractionSpec
  ): ExtractionResult | null {
    const lowerText = text.toLowerCase();
    
    for (const hint of spec.semanticHints) {
      const hintIndex = lowerText.indexOf(hint.toLowerCase());
      if (hintIndex !== -1) {
        // Look for a value near the hint
        const surroundingText = text.substring(
          Math.max(0, hintIndex - 50),
          Math.min(text.length, hintIndex + hint.length + 200)
        );
        
        // Try to extract value based on type
        let extractedValue: any = null;
        
        switch (spec.valueType) {
          case 'date':
            const dateMatch = surroundingText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
            if (dateMatch) extractedValue = normalizeDate(dateMatch[1]);
            break;
          case 'currency':
            const currencyMatch = surroundingText.match(/\$?([\d,]+(?:\.\d{2})?)/);
            if (currencyMatch) extractedValue = normalizeCurrency(currencyMatch[0]);
            break;
          case 'number':
            const numMatch = surroundingText.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
            if (numMatch) extractedValue = parseFloat(numMatch[1].replace(/,/g, ''));
            break;
          case 'percentage':
            const pctMatch = surroundingText.match(/([\d.]+)\s*%/);
            if (pctMatch) extractedValue = normalizePercentage(pctMatch[0]);
            break;
          case 'duration':
            const durMatch = surroundingText.match(/(\d+)\s*(days?|weeks?|months?|years?)/i);
            if (durMatch) extractedValue = normalizeDuration(durMatch[0]);
            break;
        }
        
        if (extractedValue) {
          return {
            value: extractedValue,
            confidence: 0.65,
            source: 'semantic_inference',
            evidence: `Found near "${hint}": ${surroundingText.substring(0, 100)}`,
            fallbackLevel: 3
          };
        }
      }
    }
    
    return null;
  }

  private inferFromRelatedFields(
    fieldName: string,
    existingFields: Record<string, any>,
    spec: FieldExtractionSpec
  ): ExtractionResult | null {
    for (const relatedField of spec.relatedFields) {
      if (existingFields[relatedField]) {
        return {
          value: existingFields[relatedField],
          confidence: 0.5,
          source: 'related_field_inference',
          evidence: `Inferred from related field: ${relatedField}`,
          fallbackLevel: 4
        };
      }
    }
    
    return null;
  }

  private lookupHistoricalValue(
    fieldName: string,
    contractType: string
  ): ExtractionResult | null {
    const key = `${fieldName}:${contractType}`;
    const historical = this.historicalValues.get(key);
    
    if (historical && historical.length > 0) {
      // Return most common value
      const sorted = [...historical].sort((a, b) => b.count - a.count);
      const mostCommon = sorted[0];
      
      return {
        value: mostCommon.value,
        confidence: Math.min(0.5, 0.3 + (mostCommon.count / 100)),
        source: 'historical_lookup',
        evidence: `Historical value (seen ${mostCommon.count} times)`,
        fallbackLevel: 5
      };
    }
    
    return null;
  }

  // ==========================================================================
  // LEARN FROM EXTRACTIONS
  // ==========================================================================

  recordExtraction(fieldName: string, value: any, contractType: string): void {
    const key = `${fieldName}:${contractType}`;
    const historical = this.historicalValues.get(key) || [];
    
    const existing = historical.find(h => JSON.stringify(h.value) === JSON.stringify(value));
    if (existing) {
      existing.count++;
    } else {
      historical.push({ value, count: 1, contractType });
    }
    
    // Keep only top 10 values
    historical.sort((a, b) => b.count - a.count);
    this.historicalValues.set(key, historical.slice(0, 10));
  }

  recordUserCorrection(fieldName: string, incorrectValue: any, correctValue: any, contractType: string): void {
    // Boost the correct value
    this.recordExtraction(fieldName, correctValue, contractType);
    this.recordExtraction(fieldName, correctValue, contractType);
    this.recordExtraction(fieldName, correctValue, contractType);
    
    logger.info(`Recorded user correction for ${fieldName}: ${incorrectValue} -> ${correctValue}`);
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  updateConfig(updates: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  getFieldSpec(fieldName: string): FieldExtractionSpec | undefined {
    return FIELD_SPECS[fieldName];
  }

  getAllFieldSpecs(): Record<string, FieldExtractionSpec> {
    return { ...FIELD_SPECS };
  }
}

// Export singleton
export const smartFallbackChain = SmartFallbackChainService.getInstance();
