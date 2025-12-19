/**
 * Field Type Extractors
 * 
 * Specialized extraction logic for different field types.
 * Each extractor understands the nuances of its field type
 * and provides optimized prompts and parsing.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ============================================================================
// Types
// ============================================================================

export interface FieldExtractionContext {
  fieldName: string;
  fieldLabel: string;
  aiHint?: string;
  options?: Array<{ value: string; label: string }>;
  validations?: any[];
  currency?: string;
  dateFormat?: string;
  min?: number;
  max?: number;
}

export interface ExtractionResponse {
  value: any;
  rawValue: string;
  confidence: number;
  explanation: string;
  sourceText: string;
  alternatives: Array<{ value: any; confidence: number; source: string }>;
}

// ============================================================================
// Base Extractor
// ============================================================================

abstract class BaseFieldExtractor {
  abstract fieldType: string;
  
  abstract getExtractionPrompt(
    context: FieldExtractionContext,
    documentText: string
  ): string;
  
  abstract parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse;
  
  getSystemPrompt(): string {
    return `You are a precision metadata extractor. Extract the requested field value from the document.
Always respond in valid JSON format with these fields:
- value: the extracted value (appropriate type for the field)
- confidence: 0-100 score based on clarity of extraction
- explanation: why you assigned this confidence
- source_text: exact text from document where you found this
- alternatives: array of other possible values if ambiguous`;
  }
  
  async extract(
    context: FieldExtractionContext,
    documentText: string
  ): Promise<ExtractionResponse> {
    const prompt = this.getExtractionPrompt(context, documentText);
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return this.parseResponse(response, context);
    } catch (error) {
      console.error(`Extraction error for ${context.fieldName}:`, error);
      return {
        value: null,
        rawValue: '',
        confidence: 0,
        explanation: `Extraction failed: ${(error as Error).message}`,
        sourceText: '',
        alternatives: [],
      };
    }
  }
}

// ============================================================================
// Date Extractor
// ============================================================================

export class DateFieldExtractor extends BaseFieldExtractor {
  fieldType = 'date';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    return `Extract the "${context.fieldLabel}" date from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

Look for:
- Explicit date labels like "Effective Date:", "Start Date:", "Signed on:"
- Dates in various formats: "January 1, 2024", "01/01/2024", "2024-01-01"
- Relative dates like "upon signing" or "30 days from effective date"

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": "YYYY-MM-DD format or null",
  "raw_value": "original text found",
  "confidence": 0-100,
  "explanation": "why this confidence",
  "source_text": "exact quote from document",
  "date_type": "specific|relative|inferred",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Normalize to ISO date
    if (value && value !== 'null') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        value = date.toISOString().split('T')[0];
      }
    } else {
      value = null;
    }
    
    // Adjust confidence based on date type
    let confidence = (response.confidence || 0) / 100;
    if (response.date_type === 'relative') {
      confidence *= 0.8; // Lower confidence for relative dates
    } else if (response.date_type === 'inferred') {
      confidence *= 0.6;
    }
    
    return {
      value,
      rawValue: response.raw_value || '',
      confidence,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).map((alt: any) => ({
        value: alt.value,
        confidence: (alt.confidence || 50) / 100,
        source: alt.source || '',
      })),
    };
  }
}

// ============================================================================
// Currency/Amount Extractor
// ============================================================================

export class CurrencyFieldExtractor extends BaseFieldExtractor {
  fieldType = 'currency';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    const expectedCurrency = context.currency || 'USD';
    
    return `Extract the "${context.fieldLabel}" monetary amount from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}
Expected currency: ${expectedCurrency}

Look for:
- Total contract value, fees, prices
- Currency symbols: $, €, £, CHF, Fr.
- Written amounts: "One Million Dollars"
- Abbreviations: "1M", "2.5K", "3 Mio"
- Payment terms and schedules

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": numeric_value_only,
  "raw_value": "original text",
  "currency": "detected currency code",
  "currency_symbol": "symbol used",
  "confidence": 0-100,
  "explanation": "why this confidence",
  "source_text": "exact quote",
  "is_total": true/false,
  "payment_type": "one-time|recurring|hourly|etc",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Parse numeric value
    if (typeof value === 'string') {
      value = this.parseAmountString(value);
    } else if (typeof value !== 'number') {
      value = null;
    }
    
    // Validate against min/max
    if (value !== null && context.min !== undefined && value < context.min) {
      value = null;
    }
    if (value !== null && context.max !== undefined && value > context.max) {
      value = null;
    }
    
    return {
      value,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).map((alt: any) => ({
        value: this.parseAmountString(alt.value),
        confidence: (alt.confidence || 50) / 100,
        source: alt.source || '',
      })),
    };
  }
  
  private parseAmountString(str: any): number | null {
    if (typeof str === 'number') return str;
    if (!str) return null;
    
    let cleaned = String(str)
      .replace(/[^0-9.,KMBkmb]/g, '')
      .replace(/,/g, '');
    
    let multiplier = 1;
    if (/[Kk]$/.test(cleaned)) {
      multiplier = 1000;
      cleaned = cleaned.slice(0, -1);
    } else if (/[Mm]$/.test(cleaned)) {
      multiplier = 1000000;
      cleaned = cleaned.slice(0, -1);
    } else if (/[Bb]$/.test(cleaned)) {
      multiplier = 1000000000;
      cleaned = cleaned.slice(0, -1);
    }
    
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : value * multiplier;
  }
}

// ============================================================================
// Select Field Extractor
// ============================================================================

export class SelectFieldExtractor extends BaseFieldExtractor {
  fieldType = 'select';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    const optionsList = context.options?.map(o => `- ${o.value}: ${o.label}`).join('\n') || '';
    
    return `Extract the "${context.fieldLabel}" from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

VALID OPTIONS (you MUST return one of these values):
${optionsList}

Analyze the document and determine which option best matches.
Consider synonyms, abbreviations, and implied meanings.

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": "exact value from options list",
  "raw_value": "original text found in document",
  "matched_option": "label of matched option",
  "confidence": 0-100,
  "explanation": "why this option was selected",
  "source_text": "relevant quote from document",
  "alternatives": [{"value": "other option", "confidence": 50, "reason": "why this could also match"}]
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Validate against options
    if (value && context.options) {
      const validValues = context.options.map(o => o.value.toLowerCase());
      if (!validValues.includes(String(value).toLowerCase())) {
        // Try to find closest match
        const closest = this.findClosestOption(value, context.options);
        if (closest) {
          value = closest.value;
        } else {
          value = null;
        }
      } else {
        // Normalize case
        const matched = context.options.find(o => 
          o.value.toLowerCase() === String(value).toLowerCase()
        );
        value = matched?.value || value;
      }
    }
    
    return {
      value,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).filter((alt: any) => {
        if (!context.options) return true;
        return context.options.some(o => 
          o.value.toLowerCase() === String(alt.value).toLowerCase()
        );
      }).map((alt: any) => ({
        value: alt.value,
        confidence: (alt.confidence || 50) / 100,
        source: alt.reason || '',
      })),
    };
  }
  
  private findClosestOption(
    value: string,
    options: Array<{ value: string; label: string }>
  ): { value: string; label: string } | null {
    const searchValue = String(value).toLowerCase();
    
    // Try label match
    const labelMatch = options.find(o => 
      o.label.toLowerCase().includes(searchValue) ||
      searchValue.includes(o.label.toLowerCase())
    );
    if (labelMatch) return labelMatch;
    
    // Try partial value match
    const partialMatch = options.find(o =>
      o.value.toLowerCase().includes(searchValue) ||
      searchValue.includes(o.value.toLowerCase())
    );
    if (partialMatch) return partialMatch;
    
    return null;
  }
}

// ============================================================================
// Party/Entity Name Extractor
// ============================================================================

export class PartyFieldExtractor extends BaseFieldExtractor {
  fieldType = 'party';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    return `Extract the "${context.fieldLabel}" (party/entity name) from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

Look for:
- Party names in the preamble ("This Agreement is between...")
- Company names with legal suffixes (Inc., LLC, Ltd., SA, GmbH, AG)
- "hereinafter referred to as" clauses
- Signature blocks
- Contact information headers

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": "full legal entity name",
  "raw_value": "exactly as written",
  "short_name": "abbreviated name if used",
  "entity_type": "company|individual|government|nonprofit",
  "role": "client|vendor|partner|etc",
  "confidence": 0-100,
  "explanation": "why this is the correct party",
  "source_text": "quote from document",
  "address": "if found nearby",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Clean up common issues
    if (value) {
      value = String(value)
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/\s+/g, ' ')         // Normalize whitespace
        .trim();
    }
    
    return {
      value: value || null,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).map((alt: any) => ({
        value: alt.value,
        confidence: (alt.confidence || 50) / 100,
        source: alt.source || '',
      })),
    };
  }
}

// ============================================================================
// Duration Extractor
// ============================================================================

export class DurationFieldExtractor extends BaseFieldExtractor {
  fieldType = 'duration';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    return `Extract the "${context.fieldLabel}" (duration/term length) from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

Look for:
- Contract term length ("for a period of 2 years")
- Renewal terms
- Notice periods
- Payment terms ("Net 30", "within 60 days")

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": number_of_days,
  "raw_value": "original text",
  "unit": "days|weeks|months|years",
  "original_value": numeric_value_in_original_unit,
  "is_renewable": true/false,
  "renewal_type": "auto|manual|none",
  "confidence": 0-100,
  "explanation": "why this duration",
  "source_text": "quote from document",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Convert to days if needed
    if (typeof value !== 'number' && response.original_value && response.unit) {
      const num = parseFloat(response.original_value);
      switch (response.unit?.toLowerCase()) {
        case 'days': value = num; break;
        case 'weeks': value = num * 7; break;
        case 'months': value = num * 30; break;
        case 'years': value = num * 365; break;
        default: value = num;
      }
    }
    
    return {
      value: typeof value === 'number' ? Math.round(value) : null,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).map((alt: any) => ({
        value: alt.value,
        confidence: (alt.confidence || 50) / 100,
        source: alt.source || '',
      })),
    };
  }
}

// ============================================================================
// Email Extractor
// ============================================================================

export class EmailFieldExtractor extends BaseFieldExtractor {
  fieldType = 'email';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    return `Extract the "${context.fieldLabel}" email address from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

Look for:
- Email addresses in contact sections
- Notice provisions ("notices shall be sent to...")
- Signature blocks
- Party information sections

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": "email@example.com",
  "raw_value": "as written in document",
  "associated_name": "name of person/entity",
  "purpose": "primary|billing|legal|technical",
  "confidence": 0-100,
  "explanation": "context of this email",
  "source_text": "quote from document",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Validate email format
    if (value) {
      value = String(value).toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        // Try to extract email from text
        const match = value.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
        value = match ? match[0] : null;
      }
    }
    
    return {
      value: value || null,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || [])
        .filter((alt: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alt.value))
        .map((alt: any) => ({
          value: alt.value?.toLowerCase(),
          confidence: (alt.confidence || 50) / 100,
          source: alt.source || '',
        })),
    };
  }
}

// ============================================================================
// Percentage Extractor
// ============================================================================

export class PercentageFieldExtractor extends BaseFieldExtractor {
  fieldType = 'percentage';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    return `Extract the "${context.fieldLabel}" percentage from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

Look for:
- Percentages with % symbol or written out
- Rates, fees, discounts
- Service levels (e.g., "99.9% uptime")
- Penalty/bonus thresholds

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": numeric_percentage,
  "raw_value": "as written",
  "context": "what this percentage refers to",
  "is_rate": true/false,
  "confidence": 0-100,
  "explanation": "why this value",
  "source_text": "quote from document",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    // Parse percentage
    if (typeof value === 'string') {
      value = parseFloat(value.replace(/%/g, ''));
    }
    
    // Validate range
    if (typeof value === 'number') {
      if (value < 0) value = null;
      if (value > 100 && context.max === undefined) {
        // Might be basis points or wrong
        value = null;
      }
    } else {
      value = null;
    }
    
    return {
      value,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).map((alt: any) => ({
        value: parseFloat(String(alt.value).replace(/%/g, '')),
        confidence: (alt.confidence || 50) / 100,
        source: alt.source || '',
      })),
    };
  }
}

// ============================================================================
// Generic Text Extractor
// ============================================================================

export class TextFieldExtractor extends BaseFieldExtractor {
  fieldType = 'text';
  
  getExtractionPrompt(context: FieldExtractionContext, documentText: string): string {
    return `Extract the "${context.fieldLabel}" text value from this document.
${context.aiHint ? `Hint: ${context.aiHint}` : ''}

Provide the exact text as found in the document, cleaned up for readability.

Document:
${documentText.slice(0, 8000)}

Return JSON:
{
  "value": "extracted text",
  "raw_value": "exactly as found",
  "confidence": 0-100,
  "explanation": "why this is the correct value",
  "source_text": "surrounding context",
  "alternatives": []
}`;
  }
  
  parseResponse(response: any, context: FieldExtractionContext): ExtractionResponse {
    let value = response.value;
    
    if (value) {
      value = String(value).trim();
      if (value === '' || value.toLowerCase() === 'null' || value.toLowerCase() === 'n/a') {
        value = null;
      }
    }
    
    return {
      value,
      rawValue: response.raw_value || '',
      confidence: (response.confidence || 0) / 100,
      explanation: response.explanation || '',
      sourceText: response.source_text || '',
      alternatives: (response.alternatives || []).map((alt: any) => ({
        value: alt.value,
        confidence: (alt.confidence || 50) / 100,
        source: alt.source || '',
      })),
    };
  }
}

// ============================================================================
// Extractor Factory
// ============================================================================

const extractorRegistry: Record<string, BaseFieldExtractor> = {
  date: new DateFieldExtractor(),
  datetime: new DateFieldExtractor(),
  currency: new CurrencyFieldExtractor(),
  select: new SelectFieldExtractor(),
  multiselect: new SelectFieldExtractor(),
  party: new PartyFieldExtractor(),
  duration: new DurationFieldExtractor(),
  email: new EmailFieldExtractor(),
  percentage: new PercentageFieldExtractor(),
  text: new TextFieldExtractor(),
  textarea: new TextFieldExtractor(),
  number: new CurrencyFieldExtractor(), // Reuse currency extractor for numbers
  url: new TextFieldExtractor(),
  phone: new TextFieldExtractor(),
  boolean: new TextFieldExtractor(),
};

export function getExtractorForFieldType(fieldType: string): BaseFieldExtractor {
  const extractor = extractorRegistry[fieldType] || extractorRegistry.text;
  return extractor ?? new TextFieldExtractor();
}

export async function extractField(
  fieldType: string,
  context: FieldExtractionContext,
  documentText: string
): Promise<ExtractionResponse> {
  const extractor = getExtractorForFieldType(fieldType);
  return extractor.extract(context, documentText);
}

// ============================================================================
// Batch Extraction with Parallel Processing
// ============================================================================

export interface BatchExtractionRequest {
  fieldType: string;
  context: FieldExtractionContext;
}

export interface BatchExtractionResult {
  fieldName: string;
  fieldType: string;
  result: ExtractionResponse;
  processingTimeMs: number;
  success: boolean;
  error?: string;
}

/**
 * Extract multiple fields in parallel with intelligent batching
 */
export async function extractFieldsBatch(
  requests: BatchExtractionRequest[],
  documentText: string,
  options: {
    concurrency?: number;
    timeout?: number;
    retryFailed?: boolean;
  } = {}
): Promise<BatchExtractionResult[]> {
  const {
    concurrency = 5,
    timeout = 30000,
    retryFailed = true,
  } = options;

  const results: BatchExtractionResult[] = [];
  const startTime = Date.now();

  // Process in batches with concurrency limit
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (req) => {
      const fieldStartTime = Date.now();
      
      try {
        const result = await Promise.race([
          extractField(req.fieldType, req.context, documentText),
          new Promise<ExtractionResponse>((_, reject) => 
            setTimeout(() => reject(new Error('Extraction timeout')), timeout)
          ),
        ]);

        return {
          fieldName: req.context.fieldName,
          fieldType: req.fieldType,
          result,
          processingTimeMs: Date.now() - fieldStartTime,
          success: true,
        } as BatchExtractionResult;
      } catch (error) {
        return {
          fieldName: req.context.fieldName,
          fieldType: req.fieldType,
          result: {
            value: null,
            rawValue: '',
            confidence: 0,
            explanation: `Extraction failed: ${(error as Error).message}`,
            sourceText: '',
            alternatives: [],
          },
          processingTimeMs: Date.now() - fieldStartTime,
          success: false,
          error: (error as Error).message,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Brief pause between batches to respect rate limits
    if (i + concurrency < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Retry failed extractions if enabled
  if (retryFailed) {
    const failed = results.filter(r => !r.success);
    
    if (failed.length > 0 && failed.length <= 3) {
      console.log(`🔄 Retrying ${failed.length} failed extractions...`);
      
      for (const failedResult of failed) {
        const request = requests.find(r => r.context.fieldName === failedResult.fieldName);
        if (!request) continue;

        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          
          const retryResult = await extractField(
            request.fieldType,
            request.context,
            documentText
          );

          // Update the result in place
          const resultIndex = results.findIndex(r => r.fieldName === failedResult.fieldName);
          if (resultIndex >= 0) {
            const existingResult = results[resultIndex]!;
            results[resultIndex] = {
              ...existingResult,
              result: retryResult,
              success: true,
            };
          }
        } catch (error) {
          console.log(`⚠️ Retry failed for ${failedResult.fieldName}`);
        }
      }
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`📊 Batch extraction completed: ${results.length} fields in ${totalTime}ms`);

  return results;
}

// ============================================================================
// Smart Field Prioritization
// ============================================================================

export interface PrioritizedField {
  request: BatchExtractionRequest;
  priority: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

/**
 * Prioritize fields for extraction based on type and importance
 */
export function prioritizeFields(requests: BatchExtractionRequest[]): PrioritizedField[] {
  const priorityMap: Record<string, number> = {
    // High priority - core contract info
    party: 100,
    date: 95,
    currency: 90,
    duration: 85,
    // Medium priority
    select: 70,
    multiselect: 65,
    percentage: 60,
    email: 55,
    // Lower priority
    text: 40,
    textarea: 30,
    url: 25,
    phone: 20,
    boolean: 15,
  };

  const complexityMap: Record<string, 'low' | 'medium' | 'high'> = {
    boolean: 'low',
    percentage: 'low',
    email: 'low',
    phone: 'low',
    url: 'low',
    date: 'medium',
    currency: 'medium',
    select: 'medium',
    duration: 'medium',
    text: 'medium',
    party: 'high',
    textarea: 'high',
    multiselect: 'high',
  };

  return requests
    .map(request => ({
      request,
      priority: priorityMap[request.fieldType] || 50,
      estimatedComplexity: complexityMap[request.fieldType] || 'medium',
    }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Extract fields with smart prioritization and early termination for critical fields
 */
export async function extractFieldsSmart(
  requests: BatchExtractionRequest[],
  documentText: string,
  options: {
    concurrency?: number;
    criticalFields?: string[];
    stopOnCriticalFailure?: boolean;
  } = {}
): Promise<{
  results: BatchExtractionResult[];
  criticalFieldsSuccess: boolean;
  totalProcessingTimeMs: number;
}> {
  const {
    concurrency = 5,
    criticalFields = [],
    stopOnCriticalFailure = false,
  } = options;

  const startTime = Date.now();
  const prioritized = prioritizeFields(requests);
  
  // Extract critical fields first
  const criticalRequests = prioritized
    .filter(p => criticalFields.includes(p.request.context.fieldName))
    .map(p => p.request);
  
  const nonCriticalRequests = prioritized
    .filter(p => !criticalFields.includes(p.request.context.fieldName))
    .map(p => p.request);

  const allResults: BatchExtractionResult[] = [];
  let criticalFieldsSuccess = true;

  // Process critical fields first
  if (criticalRequests.length > 0) {
    const criticalResults = await extractFieldsBatch(
      criticalRequests,
      documentText,
      { concurrency, retryFailed: true }
    );

    allResults.push(...criticalResults);
    criticalFieldsSuccess = criticalResults.every(r => r.success && r.result.confidence > 0.5);

    if (stopOnCriticalFailure && !criticalFieldsSuccess) {
      console.log('⚠️ Critical fields failed, stopping extraction');
      return {
        results: allResults,
        criticalFieldsSuccess: false,
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }
  }

  // Process remaining fields
  if (nonCriticalRequests.length > 0) {
    const nonCriticalResults = await extractFieldsBatch(
      nonCriticalRequests,
      documentText,
      { concurrency, retryFailed: false }
    );

    allResults.push(...nonCriticalResults);
  }

  return {
    results: allResults,
    criticalFieldsSuccess,
    totalProcessingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Field Extraction with Context Enhancement
// ============================================================================

/**
 * Enhance extraction context with document analysis
 */
export async function analyzeDocumentForExtraction(
  documentText: string
): Promise<{
  documentType: string;
  language: string;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  suggestedFields: string[];
  keyTermsFound: string[];
}> {
  try {
    const sampleText = documentText.substring(0, 2000);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Analyze this document and provide extraction guidance. Respond in JSON.',
        },
        {
          role: 'user',
          content: `Analyze this document excerpt:

${sampleText}

Respond with:
{
  "documentType": "contract type (e.g., NDA, MSA, SOW)",
  "language": "detected language",
  "estimatedComplexity": "simple|moderate|complex",
  "suggestedFields": ["fields likely to be found"],
  "keyTermsFound": ["important terms/entities detected"]
}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch (error) {
    console.error('Document analysis failed:', error);
    return {
      documentType: 'unknown',
      language: 'en',
      estimatedComplexity: 'moderate',
      suggestedFields: [],
      keyTermsFound: [],
    };
  }
}

// ============================================================================
// Export All Extractors
// ============================================================================

// All extractors are already exported at their definition above
