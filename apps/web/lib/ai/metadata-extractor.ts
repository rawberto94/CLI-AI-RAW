/**
 * Enhanced AI Metadata Extractor
 * 
 * Schema-aware metadata extraction that uses the tenant's custom field definitions.
 * Features:
 * - Uses tenant's MetadataSchema for targeted extraction
 * - Field-type-specific extraction strategies
 * - AI extraction hints from field definitions
 * - Multi-pass extraction for better accuracy
 * - Confidence scoring with explanation
 * - Handles complex field types (currency, dates, select options)
 * - Continuous learning from user corrections (adaptive extraction)
 */

import OpenAI from 'openai';
import { 
  MetadataFieldDefinition, 
  MetadataSchema,
  MetadataFieldType 
} from '@/lib/services/metadata-schema.service';
import { adaptiveExtractionEngine, type PromptEnhancement } from './adaptive-extraction-engine';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionResult {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: MetadataFieldType;
  category: string;
  value: any;
  rawValue: string;
  confidence: number;
  confidenceExplanation: string;
  source: {
    text: string;
    location?: string;
    pageNumber?: number;
  };
  alternatives: Array<{
    value: any;
    confidence: number;
    source: string;
  }>;
  validationStatus: 'valid' | 'invalid' | 'needs_review';
  validationMessages: string[];
  suggestions: string[];
  requiresHumanReview: boolean;
}

export interface ExtractionSummary {
  totalFields: number;
  extractedFields: number;
  highConfidenceFields: number;
  lowConfidenceFields: number;
  failedFields: number;
  averageConfidence: number;
  extractionTime: number;
  passesCompleted: number;
}

export interface MetadataExtractionResult {
  contractId?: string;
  schemaId: string;
  schemaVersion: number;
  extractedAt: Date;
  results: ExtractionResult[];
  summary: ExtractionSummary;
  rawExtractions: Record<string, any>;
  warnings: string[];
  processingNotes: string[];
}

export interface ExtractionOptions {
  maxPasses?: number;
  confidenceThreshold?: number;
  enableMultiPass?: boolean;
  priorityFields?: string[];
  skipFields?: string[];
  includeAlternatives?: boolean;
  maxTokens?: number;
  temperature?: number;
  // Learning options
  tenantId?: string;
  contractType?: string;
  enableAdaptiveLearning?: boolean;
}

// ============================================================================
// Metadata Extractor Class
// ============================================================================

export class SchemaAwareMetadataExtractor {
  private openai: OpenAI;
  private adaptiveEnhancements: PromptEnhancement | null = null;
  private defaultOptions: Required<ExtractionOptions> = {
    maxPasses: 2,
    confidenceThreshold: 0.7,
    enableMultiPass: true,
    priorityFields: [],
    skipFields: [],
    includeAlternatives: true,
    maxTokens: 4000,
    temperature: 0.1,
    tenantId: 'demo',
    contractType: '',
    enableAdaptiveLearning: true,
  };

  constructor(apiKey?: string) {
    const key = apiKey || (process.env.OPENAI_API_KEY || '').trim();
    if (!key) {
      throw new Error('OPENAI_API_KEY is not configured. Pass apiKey or set the env var.');
    }
    this.openai = new OpenAI({ apiKey: key });
  }

  // --------------------------------------------------------------------------
  // Main Extraction Method
  // --------------------------------------------------------------------------

  async extractMetadata(
    documentText: string,
    schema: MetadataSchema,
    options: ExtractionOptions = {}
  ): Promise<MetadataExtractionResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    
    // Load adaptive learning enhancements if enabled
    if (opts.enableAdaptiveLearning && opts.tenantId) {
      try {
        const fieldNames = schema.fields.map(f => f.name);
        this.adaptiveEnhancements = await adaptiveExtractionEngine.buildAdaptivePrompt(
          opts.tenantId,
          opts.contractType || '',
          fieldNames
        );
      } catch {
        this.adaptiveEnhancements = null;
      }
    }
    
    // Filter fields to extract
    const fieldsToExtract = schema.fields.filter(field => {
      if (opts.skipFields.some(token => this.fieldMatchesToken(field, token))) return false;
      if (field.hidden) return false;
      if (!field.aiExtractionEnabled) return false;
      return true;
    });

    // Sort by priority
    const sortedFields = this.sortFieldsByPriority(fieldsToExtract, opts.priorityFields);

    // Group fields by category for better context
    const fieldsByCategory = this.groupFieldsByCategory(sortedFields);

    // First pass: Extract all fields
    let results = await this.firstPassExtraction(
      documentText,
      fieldsByCategory,
      schema,
      opts
    );

    // Second pass: Re-extract low-confidence fields with more context
    if (opts.enableMultiPass && opts.maxPasses >= 2) {
      const lowConfidenceResults = results.filter(
        r => r.confidence < opts.confidenceThreshold && r.validationStatus !== 'valid'
      );
      
      if (lowConfidenceResults.length > 0) {
        const reExtracted = await this.secondPassExtraction(
          documentText,
          lowConfidenceResults,
          results,
          opts
        );
        
        // Merge improved results
        results = this.mergeExtractionResults(results, reExtracted);
      }
    }

    // Validate extracted values against field definitions
    results = results.map(result => this.validateExtraction(result, 
      sortedFields.find(f => f.id === result.fieldId)!
    ));

    // Calculate summary
    const summary = this.calculateSummary(results, startTime, opts.enableMultiPass ? 2 : 1);

    // Generate processing notes
    const warnings: string[] = [];
    const processingNotes: string[] = [];

    if (summary.failedFields > 0) {
      warnings.push(`${summary.failedFields} fields could not be extracted`);
    }
    if (summary.lowConfidenceFields > 0) {
      warnings.push(`${summary.lowConfidenceFields} fields have low confidence and require review`);
    }
    if (documentText.length < 500) {
      processingNotes.push('Document is relatively short, some fields may not be present');
    }

    return {
      schemaId: schema.id,
      schemaVersion: schema.version,
      extractedAt: new Date(),
      results,
      summary,
      rawExtractions: this.buildRawExtractions(results),
      warnings,
      processingNotes,
    };
  }

  // --------------------------------------------------------------------------
  // First Pass Extraction
  // --------------------------------------------------------------------------

  private async firstPassExtraction(
    documentText: string,
    fieldsByCategory: Map<string, MetadataFieldDefinition[]>,
    schema: MetadataSchema,
    opts: Required<ExtractionOptions>
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    const documentPreview = documentText.slice(0, 12000);

    // Build the extraction prompt with schema awareness
    const prompt = this.buildExtractionPrompt(fieldsByCategory, schema, documentPreview);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          { role: 'user', content: prompt },
        ],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0]?.message?.content || '{}');
      
      // Process each extracted field
      for (const [categoryId, fields] of fieldsByCategory) {
        for (const field of fields) {
          const extraction = response.extractions?.[field.name] || response.extractions?.[field.id];
          results.push(this.processExtractionResult(field, extraction, opts));
        }
      }
    } catch {
      // Return empty results for all fields
      for (const [_, fields] of fieldsByCategory) {
        for (const field of fields) {
          results.push(this.createEmptyResult(field, 'Extraction failed'));
        }
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Second Pass Extraction (for low-confidence fields)
  // --------------------------------------------------------------------------

  private async secondPassExtraction(
    documentText: string,
    lowConfidenceResults: ExtractionResult[],
    allResults: ExtractionResult[],
    opts: Required<ExtractionOptions>
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];

    // Build context from high-confidence extractions
    const contextFields = allResults
      .filter(r => r.confidence >= opts.confidenceThreshold)
      .map(r => `${r.fieldLabel}: ${r.value}`)
      .join('\n');

    const prompt = this.buildSecondPassPrompt(
      lowConfidenceResults,
      documentText.slice(0, 15000),
      contextFields
    );

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a precision metadata extraction specialist. Focus on extracting specific fields with high accuracy. Use the context from already-extracted fields to improve your extraction.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.05, // Lower temperature for more precision
        max_tokens: opts.maxTokens,
        response_format: { type: 'json_object' },
      });

      const response = JSON.parse(completion.choices[0]?.message?.content || '{}');

      for (const result of lowConfidenceResults) {
        const reExtraction = response.extractions?.[result.fieldName] || response.extractions?.[result.fieldId];
        if (reExtraction && reExtraction.confidence > result.confidence) {
          results.push({
            ...result,
            value: this.parseValue(reExtraction.value, result.fieldType),
            rawValue: String(reExtraction.value || ''),
            confidence: Math.min(reExtraction.confidence / 100, 1),
            confidenceExplanation: reExtraction.explanation || 'Improved in second pass',
            source: {
              text: reExtraction.source_text || result.source.text,
              location: reExtraction.location,
            },
            alternatives: reExtraction.alternatives || result.alternatives,
            requiresHumanReview: (reExtraction.confidence / 100) < opts.confidenceThreshold,
          });
        } else {
          results.push(result);
        }
      }
    } catch {
      return lowConfidenceResults;
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Prompt Building
  // --------------------------------------------------------------------------

  private getSystemPrompt(): string {
    let basePrompt = `You are an expert contract metadata extractor. Your task is to extract specific metadata fields from contract documents.

Guidelines:
1. Extract values EXACTLY as they appear in the document when possible
2. For dates, convert to ISO 8601 format (YYYY-MM-DD)
3. For currency amounts, extract both the number and currency code
4. For select fields, match to the closest valid option
5. Provide confidence scores based on how clearly the value appears in the document
6. If a field cannot be found, mark it with confidence 0 and explain why
7. Always include the source text where you found the value

Document Classification Guidelines:
CRITICAL: First determine if this is actually a binding contract or a different document type.
- "contract": A legally binding agreement between parties with mutual obligations
- "purchase_order": One-sided order document (look for "PO#", "Purchase Order", no mutual obligations)
- "invoice": Billing document requesting payment (look for "Invoice", "Amount Due", "Bill To")
- "quote": Price estimate (look for "Quote", "Estimate", "Valid for X days", "Subject to change")
- "proposal": Business proposal (look for "Proposal", "We propose", non-binding language)
- "work_order": Task assignment (look for "Work Order", "Task", may or may not be binding)
- "letter_of_intent": LOI (look for "Letter of Intent", "non-binding", "subject to definitive agreement")
- "memorandum": Internal memo or MoU (look for "Memorandum", "Internal", "Understanding")
- "amendment": Modification to existing contract (references an original agreement)
- "addendum": Addition to existing contract (supplements an original agreement)
- "unknown": Cannot determine document type

Key indicators that a document is NOT a binding contract:
- No signature blocks or requirement for signatures
- No mutual obligations (only one party has duties)
- Language like "estimate", "quote", "subject to", "non-binding"
- Reference numbers like "PO#", "Invoice#", "Quote#"
- Missing essential contract elements (parties, consideration, terms)

Signature Status Detection Guidelines:
- Look for signature blocks at the end of the document
- Check for actual handwritten signatures, typed names with dates, or electronic signature indicators
- "IN WITNESS WHEREOF" or "duly executed" language suggests execution intent
- Empty signature lines (___________) indicate unsigned
- If all parties have signatures with dates: "signed"
- If some but not all parties have signed: "partially_signed"
- If no signatures found or all lines empty: "unsigned"
- If unclear or cannot determine: "unknown"
- Flag as requiring attention if unsigned, partially signed, or missing execution date

Confidence Scoring Guidelines:
- 95-100: Value is explicitly stated in a clear, unambiguous way
- 80-94: Value is clearly present but may require minor interpretation
- 60-79: Value is implied or requires significant interpretation
- 40-59: Value is a reasonable guess based on context
- 0-39: Value could not be reliably determined`;

    // Add adaptive learning enhancements
    if (this.adaptiveEnhancements) {
      // Add warning patterns from past errors
      if (this.adaptiveEnhancements.warningPatterns.length > 0) {
        basePrompt += `\n\n⚠️ IMPORTANT - Learn from past corrections:\n`;
        for (const warning of this.adaptiveEnhancements.warningPatterns.slice(0, 5)) {
          basePrompt += `- ${warning}\n`;
        }
      }

      // Add contract type hints
      if (this.adaptiveEnhancements.contractTypeHints.length > 0) {
        basePrompt += `\n\n📋 Contract type guidance:\n`;
        for (const hint of this.adaptiveEnhancements.contractTypeHints) {
          basePrompt += `- ${hint}\n`;
        }
      }

      // Add few-shot examples
      if (this.adaptiveEnhancements.fewShotExamples.length > 0) {
        basePrompt += `\n\n✅ Successful extraction examples:\n`;
        for (const example of this.adaptiveEnhancements.fewShotExamples.slice(0, 3)) {
          basePrompt += `Field: ${example.field}\nInput: "${example.input.slice(0, 200)}..."\nOutput: "${example.output}"\n\n`;
        }
      }
    }

    return basePrompt;
  }

  private buildExtractionPrompt(
    fieldsByCategory: Map<string, MetadataFieldDefinition[]>,
    schema: MetadataSchema,
    documentText: string
  ): string {
    let fieldsDescription = '';
    
    for (const [categoryId, fields] of fieldsByCategory) {
      const category = schema.categories.find(c => c.id === categoryId);
      fieldsDescription += `\n## ${category?.label || categoryId}\n`;
      
      for (const field of fields) {
        fieldsDescription += this.buildFieldDescription(field);
      }
    }

    return `Extract the following metadata fields from this contract document.

${fieldsDescription}

---

DOCUMENT TEXT:
${documentText}

---

Respond with a JSON object in this format:
{
  "extractions": {
    "<field_name>": {
      "value": "<extracted value>",
      "confidence": <0-100>,
      "explanation": "<why this confidence level>",
      "source_text": "<exact text from document>",
      "location": "<where in document, if known>",
      "alternatives": [
        { "value": "<alternative value>", "confidence": <0-100>, "source": "<source text>" }
      ]
    }
  },
  "document_summary": "<brief summary of the contract>",
  "extraction_notes": "<any issues or observations>"
}`;
  }

  private buildFieldDescription(field: MetadataFieldDefinition): string {
    let desc = `\n### ${field.label} (${field.name})\n`;
    desc += `- Type: ${field.type}\n`;
    desc += `- Required: ${field.required ? 'Yes' : 'No'}\n`;
    
    if (field.aiExtractionHint) {
      desc += `- Hint: ${field.aiExtractionHint}\n`;
    }
    
    if (field.description) {
      desc += `- Description: ${field.description}\n`;
    }
    
    if (field.options && field.options.length > 0) {
      desc += `- Valid options: ${field.options.map(o => o.label).join(', ')}\n`;
    }
    
    if (field.type === 'currency' && field.currency) {
      desc += `- Expected currency: ${field.currency}\n`;
    }
    
    if (field.type === 'date' && field.dateFormat) {
      desc += `- Date format: ${field.dateFormat}\n`;
    }

    return desc;
  }

  private buildSecondPassPrompt(
    lowConfidenceResults: ExtractionResult[],
    documentText: string,
    contextFields: string
  ): string {
    let fieldsToReExtract = '';
    
    for (const result of lowConfidenceResults) {
      fieldsToReExtract += `\n### ${result.fieldLabel} (${result.fieldName})
- Type: ${result.fieldType}
- Previous extraction: "${result.rawValue}"
- Previous confidence: ${Math.round(result.confidence * 100)}%
- Issue: ${result.confidenceExplanation}

`;
    }

    return `I need you to re-extract these specific fields with higher precision. 
The first extraction had low confidence - please search more carefully.

CONTEXT FROM ALREADY-EXTRACTED FIELDS:
${contextFields}

---

FIELDS TO RE-EXTRACT:
${fieldsToReExtract}

---

DOCUMENT TEXT:
${documentText}

---

Search more thoroughly for these specific fields. Look for:
- Variations in phrasing
- Values in headers, footers, or tables
- Abbreviated forms
- Values split across multiple lines

Respond with a JSON object:
{
  "extractions": {
    "<field_name>": {
      "value": "<extracted value>",
      "confidence": <0-100>,
      "explanation": "<detailed explanation>",
      "source_text": "<exact text from document>",
      "location": "<specific location>",
      "alternatives": []
    }
  }
}`;
  }

  // --------------------------------------------------------------------------
  // Result Processing
  // --------------------------------------------------------------------------

  private processExtractionResult(
    field: MetadataFieldDefinition,
    extraction: any,
    opts: Required<ExtractionOptions>
  ): ExtractionResult {
    if (!extraction) {
      return this.createEmptyResult(field, 'No extraction returned by AI');
    }

    let confidence = Math.min((extraction.confidence || 0) / 100, 1);
    const value = this.parseValue(extraction.value, field.type);

    // Apply confidence calibration from adaptive learning
    if (this.adaptiveEnhancements?.confidenceModifiers?.[field.name] !== undefined) {
      const modifier = this.adaptiveEnhancements.confidenceModifiers[field.name]!;
      // Calibrate: blend raw confidence with historical accuracy
      confidence = confidence * 0.6 + (confidence * modifier * 0.4);
      confidence = Math.round(confidence * 100) / 100;
    }

    const confidenceThreshold = field.aiConfidenceThreshold ?? opts.confidenceThreshold;

    return {
      fieldId: field.id,
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.type,
      category: field.category,
      value,
      rawValue: String(extraction.value || ''),
      confidence,
      confidenceExplanation: extraction.explanation || 'No explanation provided',
      source: {
        text: extraction.source_text || '',
        location: extraction.location,
      },
      alternatives: opts.includeAlternatives ? (extraction.alternatives || []).map((alt: any) => ({
        value: this.parseValue(alt.value, field.type),
        confidence: Math.min((alt.confidence || 0) / 100, 1),
        source: alt.source || '',
      })) : [],
      validationStatus: confidence >= confidenceThreshold ? 'valid' : 'needs_review',
      validationMessages: [],
      suggestions: [],
      requiresHumanReview: confidence < confidenceThreshold,
    };
  }

  private createEmptyResult(
    field: MetadataFieldDefinition,
    reason: string
  ): ExtractionResult {
    return {
      fieldId: field.id,
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.type,
      category: field.category,
      value: null,
      rawValue: '',
      confidence: 0,
      confidenceExplanation: reason,
      source: { text: '' },
      alternatives: [],
      validationStatus: 'invalid',
      validationMessages: [reason],
      suggestions: field.aiExtractionHint 
        ? [`Try searching for: ${field.aiExtractionHint}`]
        : [],
      requiresHumanReview: true,
    };
  }

  private parseValue(value: any, fieldType: MetadataFieldType): any {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    switch (fieldType) {
      case 'number':
      case 'percentage':
        const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;

      case 'currency':
        // Try to extract number from currency string
        const currencyMatch = String(value).match(/[\d,]+\.?\d*/);
        if (currencyMatch) {
          return parseFloat(currencyMatch[0].replace(/,/g, ''));
        }
        return value;

      case 'date':
      case 'datetime':
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return fieldType === 'date' 
            ? date.toISOString().split('T')[0]
            : date.toISOString();
        }
        return value;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        const strVal = String(value).toLowerCase();
        if (['true', 'yes', '1', 'on'].includes(strVal)) return true;
        if (['false', 'no', '0', 'off'].includes(strVal)) return false;
        return null;

      case 'multiselect':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          return value.split(/[,;]/).map(v => v.trim()).filter(Boolean);
        }
        return [value];

      case 'duration':
        // Duration in days or a duration string
        if (typeof value === 'number') return value;
        // Try to parse "X months", "X years", "X days"
        const durationMatch = String(value).match(/(\d+)\s*(day|month|year|week)s?/i);
        if (durationMatch && durationMatch[1] && durationMatch[2]) {
          const num = parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          switch (unit) {
            case 'day': return num;
            case 'week': return num * 7;
            case 'month': return num * 30;
            case 'year': return num * 365;
          }
        }
        return value;

      default:
        return value;
    }
  }

  private validateExtraction(
    result: ExtractionResult,
    field: MetadataFieldDefinition
  ): ExtractionResult {
    const messages: string[] = [];
    const suggestions: string[] = [];
    let status = result.validationStatus;

    // Required field check
    if (field.required && (result.value === null || result.value === '')) {
      messages.push('This is a required field');
      status = 'invalid';
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (result.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.value)) {
          messages.push('Invalid email format');
          status = 'invalid';
        }
        break;

      case 'url':
        if (result.value && !/^https?:\/\/.+/.test(result.value)) {
          messages.push('Invalid URL format');
          suggestions.push('URL should start with http:// or https://');
        }
        break;

      case 'phone':
        if (result.value && !/^[+]?[\d\s()-]{7,}$/.test(result.value)) {
          messages.push('Phone number format may be incorrect');
        }
        break;

      case 'select':
        if (result.value && field.options) {
          const validOptions = field.options.map(o => o.value.toLowerCase());
          if (!validOptions.includes(String(result.value).toLowerCase())) {
            messages.push(`Value "${result.value}" is not a valid option`);
            suggestions.push(`Valid options: ${field.options.map(o => o.label).join(', ')}`);
            
            // Try to find closest match
            const closest = this.findClosestOption(result.value, field.options);
            if (closest) {
              suggestions.push(`Did you mean: ${closest.label}?`);
              result.alternatives.push({
                value: closest.value,
                confidence: 0.6,
                source: 'Option matching'
              });
            }
          }
        }
        break;

      case 'number':
      case 'currency':
        if (field.min !== undefined && result.value < field.min) {
          messages.push(`Value is below minimum (${field.min})`);
        }
        if (field.max !== undefined && result.value > field.max) {
          messages.push(`Value exceeds maximum (${field.max})`);
        }
        break;

      case 'date':
      case 'datetime':
        if (result.value) {
          const date = new Date(result.value);
          if (isNaN(date.getTime())) {
            messages.push('Invalid date format');
            status = 'invalid';
          }
        }
        break;
    }

    // Check custom validations
    for (const rule of field.validations || []) {
      const valid = this.checkValidationRule(result.value, rule);
      if (!valid) {
        messages.push(rule.message);
        status = 'invalid';
      }
    }

    return {
      ...result,
      validationStatus: status,
      validationMessages: [...result.validationMessages, ...messages],
      suggestions: [...result.suggestions, ...suggestions],
      requiresHumanReview: result.requiresHumanReview || status !== 'valid' || messages.length > 0,
    };
  }

  private checkValidationRule(value: any, rule: any): boolean {
    switch (rule.type) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      case 'min':
        return typeof value === 'number' ? value >= rule.value : true;
      case 'max':
        return typeof value === 'number' ? value <= rule.value : true;
      case 'minLength':
        return typeof value === 'string' ? value.length >= rule.value : true;
      case 'maxLength':
        return typeof value === 'string' ? value.length <= rule.value : true;
      case 'pattern':
        return typeof value === 'string' ? new RegExp(rule.value).test(value) : true;
      default:
        return true;
    }
  }

  private findClosestOption(
    value: any,
    options: Array<{ value: string; label: string }>
  ): { value: string; label: string } | null {
    if (!value) return null;
    
    const searchValue = String(value).toLowerCase();
    
    // First try exact match on label
    const exactMatch = options.find(o => o.label.toLowerCase() === searchValue);
    if (exactMatch) return exactMatch;
    
    // Try partial match
    const partialMatch = options.find(o => 
      o.label.toLowerCase().includes(searchValue) ||
      searchValue.includes(o.label.toLowerCase())
    );
    if (partialMatch) return partialMatch;

    // Calculate simple similarity
    let bestMatch: { value: string; label: string } | null = null;
    let bestScore = 0;

    for (const option of options) {
      const score = this.calculateSimilarity(searchValue, option.label.toLowerCase());
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = option;
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    const longerLength = longer.length;
    const editDistance = this.levenshteinDistance(longer, shorter);
    
    return (longerLength - editDistance) / longerLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      const row = matrix[0];
      if (row) {
        row[j] = j;
      }
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        if (!currentRow || !prevRow) continue;
        
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          currentRow[j] = prevRow[j - 1] ?? 0;
        } else {
          currentRow[j] = Math.min(
            (prevRow[j - 1] ?? 0) + 1,
            (currentRow[j - 1] ?? 0) + 1,
            (prevRow[j] ?? 0) + 1
          );
        }
      }
    }

    const lastRow = matrix[str2.length];
    return lastRow ? (lastRow[str1.length] ?? 0) : 0;
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private sortFieldsByPriority(
    fields: MetadataFieldDefinition[],
    priorityFields: string[]
  ): MetadataFieldDefinition[] {
    return [...fields].sort((a, b) => {
      const aPriority = priorityFields.findIndex(token => this.fieldMatchesToken(a, token));
      const bPriority = priorityFields.findIndex(token => this.fieldMatchesToken(b, token));
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // Required fields come first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      
      return a.sortOrder - b.sortOrder;
    });
  }

  private fieldMatchesToken(field: MetadataFieldDefinition, token: string): boolean {
    if (!token) return false;
    const normalized = String(token).trim().toLowerCase();
    return field.id.toLowerCase() === normalized || field.name.toLowerCase() === normalized;
  }

  private groupFieldsByCategory(
    fields: MetadataFieldDefinition[]
  ): Map<string, MetadataFieldDefinition[]> {
    const grouped = new Map<string, MetadataFieldDefinition[]>();
    
    for (const field of fields) {
      const category = field.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(field);
    }
    
    return grouped;
  }

  private mergeExtractionResults(
    original: ExtractionResult[],
    updated: ExtractionResult[]
  ): ExtractionResult[] {
    const resultMap = new Map<string, ExtractionResult>();
    
    for (const result of original) {
      resultMap.set(result.fieldId, result);
    }
    
    for (const result of updated) {
      const existing = resultMap.get(result.fieldId);
      if (!existing || result.confidence > existing.confidence) {
        resultMap.set(result.fieldId, result);
      }
    }
    
    return Array.from(resultMap.values());
  }

  private buildRawExtractions(results: ExtractionResult[]): Record<string, any> {
    const raw: Record<string, any> = {};
    
    for (const result of results) {
      raw[result.fieldName] = result.value;
    }
    
    return raw;
  }

  private calculateSummary(
    results: ExtractionResult[],
    startTime: number,
    passesCompleted: number
  ): ExtractionSummary {
    const extracted = results.filter(r => r.value !== null);
    const highConfidence = results.filter(r => r.confidence >= 0.8);
    const lowConfidence = results.filter(r => r.confidence > 0 && r.confidence < 0.6);
    const failed = results.filter(r => r.value === null);

    const avgConfidence = extracted.length > 0
      ? extracted.reduce((sum, r) => sum + r.confidence, 0) / extracted.length
      : 0;

    return {
      totalFields: results.length,
      extractedFields: extracted.length,
      highConfidenceFields: highConfidence.length,
      lowConfidenceFields: lowConfidence.length,
      failedFields: failed.length,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      extractionTime: Date.now() - startTime,
      passesCompleted,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Extract metadata from a document using the tenant's schema
 */
export async function extractMetadataWithSchema(
  documentText: string,
  schema: MetadataSchema,
  options?: ExtractionOptions
): Promise<MetadataExtractionResult> {
  const extractor = new SchemaAwareMetadataExtractor();
  return extractor.extractMetadata(documentText, schema, options);
}

/**
 * Extract metadata for specific fields only
 */
export async function extractSpecificFields(
  documentText: string,
  schema: MetadataSchema,
  fieldIds: string[]
): Promise<MetadataExtractionResult> {
  const filteredSchema = {
    ...schema,
    fields: schema.fields.filter(f => fieldIds.includes(f.id))
  };
  
  const extractor = new SchemaAwareMetadataExtractor();
  return extractor.extractMetadata(documentText, filteredSchema, {
    maxPasses: 2,
    enableMultiPass: true,
  });
}

/**
 * Re-extract low-confidence fields
 */
export async function reExtractLowConfidenceFields(
  documentText: string,
  schema: MetadataSchema,
  previousResults: MetadataExtractionResult,
  confidenceThreshold = 0.7
): Promise<MetadataExtractionResult> {
  const lowConfidenceFieldIds = previousResults.results
    .filter(r => r.confidence < confidenceThreshold)
    .map(r => r.fieldId);

  if (lowConfidenceFieldIds.length === 0) {
    return previousResults;
  }

  const newResults = await extractSpecificFields(
    documentText,
    schema,
    lowConfidenceFieldIds
  );

  // Merge with previous results
  const mergedResults = previousResults.results.map(r => {
    const newResult = newResults.results.find(nr => nr.fieldId === r.fieldId);
    if (newResult && newResult.confidence > r.confidence) {
      return newResult;
    }
    return r;
  });

  return {
    ...previousResults,
    results: mergedResults,
    summary: {
      ...previousResults.summary,
      passesCompleted: previousResults.summary.passesCompleted + 1,
    },
    processingNotes: [
      ...previousResults.processingNotes,
      `Re-extracted ${lowConfidenceFieldIds.length} low-confidence fields`,
    ],
  };
}

// Export types
export type { MetadataFieldDefinition, MetadataSchema };
