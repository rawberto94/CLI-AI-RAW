"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */
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
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaAwareMetadataExtractor = void 0;
exports.extractMetadataWithSchema = extractMetadataWithSchema;
exports.extractSpecificFields = extractSpecificFields;
exports.reExtractLowConfidenceFields = reExtractLowConfidenceFields;
const openai_1 = __importDefault(require("openai"));
// ============================================================================
// Metadata Extractor Class
// ============================================================================
class SchemaAwareMetadataExtractor {
    openai;
    defaultOptions = {
        maxPasses: 2,
        confidenceThreshold: 0.7,
        enableMultiPass: true,
        priorityFields: [],
        skipFields: [],
        includeAlternatives: true,
        maxTokens: 4000,
        temperature: 0.1,
    };
    constructor(apiKey) {
        this.openai = new openai_1.default({
            apiKey: apiKey || process.env.OPENAI_API_KEY || '',
        });
    }
    // --------------------------------------------------------------------------
    // Main Extraction Method
    // --------------------------------------------------------------------------
    async extractMetadata(documentText, schema, options = {}) {
        const startTime = Date.now();
        const opts = { ...this.defaultOptions, ...options };
        // Filter fields to extract
        const fieldsToExtract = schema.fields.filter(field => {
            if (opts.skipFields.some(token => this.fieldMatchesToken(field, token)))
                return false;
            if (field.hidden)
                return false;
            if (!field.aiExtractionEnabled)
                return false;
            return true;
        });
        // Sort by priority
        const sortedFields = this.sortFieldsByPriority(fieldsToExtract, opts.priorityFields);
        // Group fields by category for better context
        const fieldsByCategory = this.groupFieldsByCategory(sortedFields);
        // First pass: Extract all fields
        console.log(`🔍 Starting metadata extraction with ${sortedFields.length} fields`);
        let results = await this.firstPassExtraction(documentText, fieldsByCategory, schema, opts);
        // Second pass: Re-extract low-confidence fields with more context
        if (opts.enableMultiPass && opts.maxPasses >= 2) {
            const lowConfidenceResults = results.filter(r => r.confidence < opts.confidenceThreshold && r.validationStatus !== 'valid');
            if (lowConfidenceResults.length > 0) {
                console.log(`🔄 Second pass: Re-extracting ${lowConfidenceResults.length} low-confidence fields`);
                const reExtracted = await this.secondPassExtraction(documentText, lowConfidenceResults, results, opts);
                // Merge improved results
                results = this.mergeExtractionResults(results, reExtracted);
            }
        }
        // Validate extracted values against field definitions
        results = results.map(result => this.validateExtraction(result, sortedFields.find(f => f.id === result.fieldId)));
        // Calculate summary
        const summary = this.calculateSummary(results, startTime, opts.enableMultiPass ? 2 : 1);
        // Generate processing notes
        const warnings = [];
        const processingNotes = [];
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
    async firstPassExtraction(documentText, fieldsByCategory, schema, opts) {
        const results = [];
        const documentPreview = documentText.slice(0, 12000);
        // Build the extraction prompt with schema awareness
        const prompt = this.buildExtractionPrompt(fieldsByCategory, schema, documentPreview);
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
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
        }
        catch (error) {
            console.error('First pass extraction error:', error);
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
    async secondPassExtraction(documentText, lowConfidenceResults, allResults, opts) {
        const results = [];
        // Build context from high-confidence extractions
        const contextFields = allResults
            .filter(r => r.confidence >= opts.confidenceThreshold)
            .map(r => `${r.fieldLabel}: ${r.value}`)
            .join('\n');
        const prompt = this.buildSecondPassPrompt(lowConfidenceResults, documentText.slice(0, 15000), contextFields);
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
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
                }
                else {
                    results.push(result);
                }
            }
        }
        catch (error) {
            console.error('Second pass extraction error:', error);
            return lowConfidenceResults;
        }
        return results;
    }
    // --------------------------------------------------------------------------
    // Prompt Building
    // --------------------------------------------------------------------------
    getSystemPrompt() {
        return `You are an expert contract metadata extractor. Your task is to extract specific metadata fields from contract documents.

Guidelines:
1. Extract values EXACTLY as they appear in the document when possible
2. For dates, convert to ISO 8601 format (YYYY-MM-DD)
3. For currency amounts, extract both the number and currency code
4. For select fields, match to the closest valid option
5. Provide confidence scores based on how clearly the value appears in the document
6. If a field cannot be found, mark it with confidence 0 and explain why
7. Always include the source text where you found the value

Confidence Scoring Guidelines:
- 95-100: Value is explicitly stated in a clear, unambiguous way
- 80-94: Value is clearly present but may require minor interpretation
- 60-79: Value is implied or requires significant interpretation
- 40-59: Value is a reasonable guess based on context
- 0-39: Value could not be reliably determined`;
    }
    buildExtractionPrompt(fieldsByCategory, schema, documentText) {
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
    buildFieldDescription(field) {
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
    buildSecondPassPrompt(lowConfidenceResults, documentText, contextFields) {
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
    processExtractionResult(field, extraction, opts) {
        if (!extraction) {
            return this.createEmptyResult(field, 'No extraction returned by AI');
        }
        const confidence = Math.min((extraction.confidence || 0) / 100, 1);
        const value = this.parseValue(extraction.value, field.type);
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
            alternatives: opts.includeAlternatives ? (extraction.alternatives || []).map((alt) => ({
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
    createEmptyResult(field, reason) {
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
    parseValue(value, fieldType) {
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
                if (typeof value === 'boolean')
                    return value;
                const strVal = String(value).toLowerCase();
                if (['true', 'yes', '1', 'on'].includes(strVal))
                    return true;
                if (['false', 'no', '0', 'off'].includes(strVal))
                    return false;
                return null;
            case 'multiselect':
                if (Array.isArray(value))
                    return value;
                if (typeof value === 'string') {
                    return value.split(/[,;]/).map(v => v.trim()).filter(Boolean);
                }
                return [value];
            case 'duration':
                // Duration in days or a duration string
                if (typeof value === 'number')
                    return value;
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
    validateExtraction(result, field) {
        const messages = [];
        const suggestions = [];
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
    checkValidationRule(value, rule) {
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
    findClosestOption(value, options) {
        if (!value)
            return null;
        const searchValue = String(value).toLowerCase();
        // First try exact match on label
        const exactMatch = options.find(o => o.label.toLowerCase() === searchValue);
        if (exactMatch)
            return exactMatch;
        // Try partial match
        const partialMatch = options.find(o => o.label.toLowerCase().includes(searchValue) ||
            searchValue.includes(o.label.toLowerCase()));
        if (partialMatch)
            return partialMatch;
        // Calculate simple similarity
        let bestMatch = null;
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
    calculateSimilarity(str1, str2) {
        if (str1 === str2)
            return 1;
        if (str1.length === 0 || str2.length === 0)
            return 0;
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        const longerLength = longer.length;
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longerLength - editDistance) / longerLength;
    }
    levenshteinDistance(str1, str2) {
        const matrix = [];
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
                if (!currentRow || !prevRow)
                    continue;
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    currentRow[j] = prevRow[j - 1] ?? 0;
                }
                else {
                    currentRow[j] = Math.min((prevRow[j - 1] ?? 0) + 1, (currentRow[j - 1] ?? 0) + 1, (prevRow[j] ?? 0) + 1);
                }
            }
        }
        const lastRow = matrix[str2.length];
        return lastRow ? (lastRow[str1.length] ?? 0) : 0;
    }
    // --------------------------------------------------------------------------
    // Utility Methods
    // --------------------------------------------------------------------------
    sortFieldsByPriority(fields, priorityFields) {
        return [...fields].sort((a, b) => {
            const aPriority = priorityFields.findIndex(token => this.fieldMatchesToken(a, token));
            const bPriority = priorityFields.findIndex(token => this.fieldMatchesToken(b, token));
            if (aPriority !== -1 && bPriority !== -1) {
                return aPriority - bPriority;
            }
            if (aPriority !== -1)
                return -1;
            if (bPriority !== -1)
                return 1;
            // Required fields come first
            if (a.required && !b.required)
                return -1;
            if (!a.required && b.required)
                return 1;
            return a.sortOrder - b.sortOrder;
        });
    }
    fieldMatchesToken(field, token) {
        if (!token)
            return false;
        const normalized = String(token).trim().toLowerCase();
        return field.id.toLowerCase() === normalized || field.name.toLowerCase() === normalized;
    }
    groupFieldsByCategory(fields) {
        const grouped = new Map();
        for (const field of fields) {
            const category = field.category || 'other';
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category).push(field);
        }
        return grouped;
    }
    mergeExtractionResults(original, updated) {
        const resultMap = new Map();
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
    buildRawExtractions(results) {
        const raw = {};
        for (const result of results) {
            raw[result.fieldName] = result.value;
        }
        return raw;
    }
    calculateSummary(results, startTime, passesCompleted) {
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
exports.SchemaAwareMetadataExtractor = SchemaAwareMetadataExtractor;
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Extract metadata from a document using the tenant's schema
 */
async function extractMetadataWithSchema(documentText, schema, options) {
    const extractor = new SchemaAwareMetadataExtractor();
    return extractor.extractMetadata(documentText, schema, options);
}
/**
 * Extract metadata for specific fields only
 */
async function extractSpecificFields(documentText, schema, fieldIds) {
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
async function reExtractLowConfidenceFields(documentText, schema, previousResults, confidenceThreshold = 0.7) {
    const lowConfidenceFieldIds = previousResults.results
        .filter(r => r.confidence < confidenceThreshold)
        .map(r => r.fieldId);
    if (lowConfidenceFieldIds.length === 0) {
        return previousResults;
    }
    const newResults = await extractSpecificFields(documentText, schema, lowConfidenceFieldIds);
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
