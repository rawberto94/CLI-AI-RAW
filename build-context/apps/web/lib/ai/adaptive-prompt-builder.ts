/**
 * Adaptive Prompt Builder
 * 
 * Builds optimized extraction prompts based on:
 * - Contract type and structure
 * - Field complexity
 * - Historical extraction patterns
 * - Document characteristics
 */

import type { MetadataFieldDefinition, MetadataFieldType } from "@/lib/services/metadata-schema.service";
import { detectContractType, getExtractionHintsForType } from "./contract-templates";
import { getCalibrationService } from "./confidence-calibration";
import { getLearnedHints } from "./self-improving-prompt-loop";

// ============================================================================
// TYPES
// ============================================================================

export interface PromptContext {
  contractText: string;
  contractType?: string;
  fields: MetadataFieldDefinition[];
  previousResults?: Map<string, { value: any; confidence: number }>;
  documentCharacteristics?: DocumentCharacteristics;
  targetConfidence?: number; // Minimum confidence we're aiming for
}

export interface DocumentCharacteristics {
  length: number;
  hasHeaders: boolean;
  hasTables: boolean;
  hasSignatures: boolean;
  language: string;
  complexity: "simple" | "moderate" | "complex";
  ocrQuality?: "high" | "medium" | "low";
}

export interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
  modelRecommendation: string;
  expectedTokens: number;
  chunkStrategy?: "single" | "chunked" | "hierarchical";
}

export interface FieldPrompt {
  fieldKey: string;
  extractionPrompt: string;
  validationHints: string[];
  examples: string[];
  fallbackPatterns: string[];
}

// ============================================================================
// ADAPTIVE PROMPT BUILDER
// ============================================================================

export class AdaptivePromptBuilder {
  private calibrationService = getCalibrationService();

  /**
   * Build an optimized extraction prompt for all fields
   */
  buildExtractionPrompt(context: PromptContext): GeneratedPrompt {
    const {
      contractText,
      fields,
      previousResults,
      documentCharacteristics,
      targetConfidence = 0.8,
    } = context;

    // Detect contract type if not provided
    const detectedType = context.contractType ?? detectContractType(contractText);
    const contractTypeId = typeof detectedType === 'string' ? detectedType : detectedType?.id;
    
    // Analyze document
    const docChars = documentCharacteristics ?? this.analyzeDocument(contractText);

    // Get hints for this contract type
    const typeHintsMap = contractTypeId ? getExtractionHintsForType(contractTypeId) : {};
    const typeHints = Object.entries(typeHintsMap).map(([k, v]) => `${k}: ${v}`);

    // Group fields by extraction strategy
    const { simple, complex, lowConfidence } = this.categorizeFields(
      fields,
      previousResults,
      targetConfidence
    );

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(
      contractTypeId ?? null,
      docChars,
      typeHints
    );

    // Build user prompt based on complexity
    const userPrompt = this.buildUserPrompt(
      contractText,
      simple,
      complex,
      lowConfidence,
      docChars
    );

    // Recommend model based on complexity
    const modelRecommendation = this.recommendModel(
      fields.length,
      docChars.complexity,
      lowConfidence.length > 0
    );

    // Estimate tokens
    const expectedTokens = this.estimateTokens(
      systemPrompt,
      userPrompt,
      contractText
    );

    // Determine chunking strategy
    const chunkStrategy = this.determineChunkStrategy(
      contractText.length,
      fields.length,
      docChars.complexity
    );

    return {
      systemPrompt,
      userPrompt,
      modelRecommendation,
      expectedTokens,
      chunkStrategy,
    };
  }

  /**
   * Async variant that injects self-improving learned hints into the prompt.
   * Use this when you have an async call-site (e.g. API routes, workers).
   */
  async buildEnhancedExtractionPrompt(context: PromptContext): Promise<GeneratedPrompt> {
    const base = this.buildExtractionPrompt(context);

    // Fetch learned patterns and append to system prompt
    const detectedType = context.contractType ?? detectContractType(context.contractText);
    const contractTypeId = typeof detectedType === 'string' ? detectedType : (detectedType as any)?.id;
    const learnedBlock = await getLearnedHints(contractTypeId);

    if (learnedBlock) {
      base.systemPrompt += learnedBlock;
      // Re-estimate tokens with the added content
      base.expectedTokens = this.estimateTokens(base.systemPrompt, base.userPrompt, context.contractText);
    }

    return base;
  }

  /**
   * Build a focused prompt for re-extracting specific fields
   */
  buildReExtractionPrompt(
    contractText: string,
    fields: MetadataFieldDefinition[],
    previousValues: Map<string, { value: any; confidence: number }>
  ): GeneratedPrompt {
    const contractType = detectContractType(contractText);

    const systemPrompt = `You are a contract metadata extraction specialist. You're being asked to re-examine specific fields where initial extraction was uncertain.

Key principles:
1. Look more carefully at the context around likely locations
2. Consider alternative interpretations
3. If a value seems partially correct, try to complete it
4. If you find multiple possible values, list them as alternatives
5. Explain your confidence level and reasoning

Contract type: ${contractType || "Unknown"}`;

    const fieldInstructions = fields.map(field => {
      const previous = previousValues.get(field.id);
      const prevStr = previous 
        ? `Previous extraction: "${JSON.stringify(previous.value)}" (${Math.round(previous.confidence * 100)}% confidence)`
        : "No previous value";

      return `
### ${field.label} (${field.id})
Type: ${field.type}
Description: ${field.description || "No description"}
${prevStr}

Look for: ${this.getFieldSearchHints(field)}`;
    }).join("\n");

    const userPrompt = `Re-examine this contract and extract the following fields with higher accuracy:

${fieldInstructions}

Contract text:
"""
${contractText.substring(0, 15000)}
"""

For each field, provide:
- value: The extracted value (or null if not found)
- confidence: Your confidence (0.0-1.0)
- reasoning: Brief explanation of where/how you found it
- alternatives: Other possible values if uncertain

Return as JSON object with field keys as properties.`;

    return {
      systemPrompt,
      userPrompt,
      modelRecommendation: "gpt-4o", // Use stronger model for re-extraction
      expectedTokens: this.estimateTokens(systemPrompt, userPrompt, contractText),
      chunkStrategy: "single",
    };
  }

  /**
   * Build a field-specific extraction prompt
   */
  buildFieldPrompt(
    field: MetadataFieldDefinition,
    contractText: string,
    contractType?: string
  ): FieldPrompt {
    const hints = this.getFieldSearchHints(field);
    const examples = this.getFieldExamples(field);
    const patterns = this.getFallbackPatterns(field);
    const validation = this.getValidationHints(field);

    const extractionPrompt = `
Extract the "${field.label}" from the contract.

Field type: ${field.type}
Description: ${field.description || "Standard " + field.type + " field"}
${field.required ? "This is a REQUIRED field." : "This is an optional field."}

What to look for:
${hints}

Expected format:
${this.getFormatDescription(field)}

${examples.length > 0 ? `Examples of valid values:\n${examples.map(e => `- ${e}`).join("\n")}` : ""}

Scan the contract text and extract this value. If not found, return null.`;

    return {
      fieldKey: field.id,
      extractionPrompt,
      validationHints: validation,
      examples,
      fallbackPatterns: patterns,
    };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private buildSystemPrompt(
    contractType: string | null,
    docChars: DocumentCharacteristics,
    typeHints: string[]
  ): string {
    let prompt = `You are an expert contract metadata extraction system. Your task is to accurately extract structured data from contracts.

Key principles:
1. Extract values EXACTLY as they appear (don't paraphrase)
2. Use null for fields you cannot find with confidence
3. Provide confidence scores (0.0-1.0) for each extraction
4. For dates, normalize to ISO format (YYYY-MM-DD)
5. For currencies, extract both amount and currency code
6. For parties, capture full legal names`;

    if (contractType) {
      prompt += `\n\nContract Type: ${contractType}`;
      if (typeHints.length > 0) {
        prompt += `\nType-specific hints:\n${typeHints.map(h => `- ${h}`).join("\n")}`;
      }
    }

    if (docChars.complexity === "complex") {
      prompt += `\n\nThis is a COMPLEX document. Take extra care to:
- Look for values in tables and appendices
- Check for amendments that may override original values
- Consider defined terms that may affect interpretation`;
    }

    if (docChars.ocrQuality === "low") {
      prompt += `\n\nNote: This document appears to be from OCR with potential quality issues.
- Be tolerant of minor spelling variations
- Look for patterns rather than exact matches
- Flag values that seem corrupted`;
    }

    return prompt;
  }

  private buildUserPrompt(
    contractText: string,
    simpleFields: MetadataFieldDefinition[],
    complexFields: MetadataFieldDefinition[],
    lowConfidenceFields: MetadataFieldDefinition[],
    docChars: DocumentCharacteristics
  ): string {
    // Truncate text based on complexity
    const maxLength = docChars.complexity === "complex" ? 20000 : 15000;
    const truncatedText = contractText.length > maxLength 
      ? contractText.substring(0, maxLength) + "\n[... document truncated ...]"
      : contractText;

    let fieldInstructions = "";

    if (simpleFields.length > 0) {
      fieldInstructions += `
## Standard Fields (extract directly)
${simpleFields.map(f => `- ${f.id}: ${f.label} (${f.type})`).join("\n")}`;
    }

    if (complexFields.length > 0) {
      fieldInstructions += `

## Complex Fields (require careful analysis)
${complexFields.map(f => `- ${f.id}: ${f.label} (${f.type}) - ${f.description || "Look carefully"}`).join("\n")}`;
    }

    if (lowConfidenceFields.length > 0) {
      fieldInstructions += `

## Fields Needing Re-examination (previous extraction uncertain)
${lowConfidenceFields.map(f => `- ${f.id}: ${f.label} - Search more thoroughly`).join("\n")}`;
    }

    return `Extract the following fields from the contract:

${fieldInstructions}

CONTRACT TEXT:
"""
${truncatedText}
"""

Return a JSON object where each key is the field key, containing:
{
  "fieldKey": {
    "value": <extracted value or null>,
    "confidence": <0.0-1.0>,
    "source": "<brief location hint>"
  }
}`;
  }

  private categorizeFields(
    fields: MetadataFieldDefinition[],
    previousResults?: Map<string, { value: any; confidence: number }>,
    targetConfidence: number = 0.8
  ): {
    simple: MetadataFieldDefinition[];
    complex: MetadataFieldDefinition[];
    lowConfidence: MetadataFieldDefinition[];
  } {
    const simple: MetadataFieldDefinition[] = [];
    const complex: MetadataFieldDefinition[] = [];
    const lowConfidence: MetadataFieldDefinition[] = [];

    const simpleTypes: MetadataFieldType[] = ["text", "email", "phone", "url"];
    const complexTypes: MetadataFieldType[] = ["currency", "duration", "multiselect"];

    for (const field of fields) {
      // Check if this field had low confidence before
      const previous = previousResults?.get(field.id);
      if (previous && previous.confidence < targetConfidence) {
        lowConfidence.push(field);
        continue;
      }

      // Categorize by type
      if (simpleTypes.includes(field.type as MetadataFieldType)) {
        simple.push(field);
      } else if (complexTypes.includes(field.type as MetadataFieldType)) {
        complex.push(field);
      } else {
        // Default to simple for other types
        simple.push(field);
      }
    }

    return { simple, complex, lowConfidence };
  }

  private analyzeDocument(text: string): DocumentCharacteristics {
    const length = text.length;
    
    // Simple heuristics
    const hasHeaders = /^#+\s|\n#{1,6}\s/m.test(text) || /^[A-Z][A-Z\s]+$/m.test(text);
    const hasTables = text.includes("|") || /\t.*\t/m.test(text);
    const hasSignatures = /signature|sign:|signed|executed/i.test(text);
    
    // Language detection (very basic)
    const language = /[áéíóúñ]/i.test(text) ? "es" : 
                    /[àâêîôûç]/i.test(text) ? "fr" :
                    /[äöüß]/i.test(text) ? "de" : "en";

    // Complexity based on length and structure
    const complexity = length > 50000 ? "complex" :
                       length > 15000 ? "moderate" : "simple";

    // OCR quality detection
    const ocrQuality = this.detectOCRQuality(text);

    return {
      length,
      hasHeaders,
      hasTables,
      hasSignatures,
      language,
      complexity,
      ocrQuality,
    };
  }

  private detectOCRQuality(text: string): "high" | "medium" | "low" {
    // Look for common OCR artifacts
    const artifacts = [
      /[|l1!]{3,}/g,  // Confused characters
      /[oO0]{3,}/g,   // Confused zeros/Os
      /\s{3,}/g,      // Extra whitespace
      /[^\w\s]{4,}/g, // Long runs of punctuation
    ];

    let artifactCount = 0;
    for (const pattern of artifacts) {
      const matches = text.match(pattern);
      if (matches) artifactCount += matches.length;
    }

    const artifactRate = artifactCount / (text.length / 1000);

    if (artifactRate < 0.5) return "high";
    if (artifactRate < 2) return "medium";
    return "low";
  }

  private recommendModel(
    fieldCount: number,
    complexity: "simple" | "moderate" | "complex",
    hasLowConfidence: boolean
  ): string {
    // Use stronger model for:
    // - Complex documents
    // - Re-extraction of low confidence fields
    // - Large number of fields
    
    if (hasLowConfidence || complexity === "complex") {
      return "gpt-4o";
    }
    
    if (fieldCount > 20 || complexity === "moderate") {
      return "gpt-4o-mini"; // Good balance
    }

    return "gpt-4o-mini"; // Fast for simple cases
  }

  private estimateTokens(
    systemPrompt: string,
    userPrompt: string,
    contractText: string
  ): number {
    // Rough estimation: ~4 chars per token
    const inputTokens = (systemPrompt.length + userPrompt.length + Math.min(contractText.length, 20000)) / 4;
    const outputTokens = 2000; // Estimated output
    return Math.round(inputTokens + outputTokens);
  }

  private determineChunkStrategy(
    textLength: number,
    fieldCount: number,
    complexity: "simple" | "moderate" | "complex"
  ): "single" | "chunked" | "hierarchical" {
    // Chunking thresholds
    if (textLength < 15000 && fieldCount < 15) {
      return "single";
    }

    if (textLength > 50000 || complexity === "complex") {
      return "hierarchical"; // Extract section by section
    }

    return "chunked"; // Split into overlapping chunks
  }

  private getFieldSearchHints(field: MetadataFieldDefinition): string {
    const typeHints: Record<string, string> = {
      date: "Look near keywords: effective, commencing, dated, expires, termination, execution",
      currency: "Look for dollar signs ($), currency codes (USD, EUR), or written amounts",
      email: "Look for @ symbols and domain patterns",
      phone: "Look for number patterns with area codes, parentheses, or country codes",
      url: "Look for http://, https://, or www.",
      percentage: "Look for % symbols or 'percent' keywords",
      duration: "Look for time periods: days, months, years, weeks",
      select: field.options?.length 
        ? `Look for: ${field.options.map(o => o.value).join(", ")}`
        : "Look for values that match a category or classification",
    };

    return typeHints[field.type] || "Look for relevant text near headings and in key sections";
  }

  private getFieldExamples(field: MetadataFieldDefinition): string[] {
    const typeExamples: Record<string, string[]> = {
      date: ["2024-01-15", "January 15, 2024", "15/01/2024"],
      currency: ["$50,000.00", "USD 50000", "Fifty Thousand Dollars"],
      email: ["john.doe@company.com"],
      phone: ["+1 (555) 123-4567", "555-123-4567"],
      percentage: ["15%", "0.15", "fifteen percent"],
    };

    if (field.options?.length) {
      return field.options.slice(0, 5).map(o => o.label);
    }

    return typeExamples[field.type] || [];
  }

  private getFallbackPatterns(field: MetadataFieldDefinition): string[] {
    const typePatterns: Record<string, string[]> = {
      date: [
        "\\d{4}-\\d{2}-\\d{2}",
        "\\d{1,2}/\\d{1,2}/\\d{2,4}",
        "(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},?\\s+\\d{4}",
      ],
      currency: [
        "\\$[\\d,]+(\\.\\d{2})?",
        "(USD|EUR|GBP|CAD)\\s*[\\d,]+",
      ],
      email: ["[\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,}"],
      phone: ["\\+?\\d{1,3}[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}"],
      percentage: ["\\d+(\\.\\d+)?\\s*%", "\\d+(\\.\\d+)?\\s*percent"],
    };

    return typePatterns[field.type] || [];
  }

  private getValidationHints(field: MetadataFieldDefinition): string[] {
    const hints: string[] = [];

    if (field.required) {
      hints.push("This field is required - search thoroughly");
    }

    switch (field.type) {
      case "date":
        hints.push("Ensure date is in valid format and makes logical sense");
        break;
      case "currency":
        hints.push("Verify currency code matches the context");
        break;
      case "email":
        hints.push("Validate email format (user@domain.tld)");
        break;
    }

    return hints;
  }

  private getFormatDescription(field: MetadataFieldDefinition): string {
    const formats: Record<string, string> = {
      date: "ISO date string (YYYY-MM-DD)",
      currency: '{ "amount": number, "currency": "USD|EUR|etc" }',
      email: "valid email address string",
      phone: "phone number string with optional formatting",
      url: "full URL including protocol",
      percentage: "number between 0-100",
      duration: '{ "value": number, "unit": "days|months|years" }',
      text: "plain text string",
      number: "numeric value",
      boolean: "true or false",
      select: `one of: ${field.options?.map(o => o.value).join(", ") || "predefined options"}`,
      multiselect: `array of: ${field.options?.map(o => o.value).join(", ") || "predefined options"}`,
    };

    return formats[field.type] || "appropriate value for field type";
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const promptBuilder = new AdaptivePromptBuilder();

export function buildExtractionPrompt(context: PromptContext): GeneratedPrompt {
  return promptBuilder.buildExtractionPrompt(context);
}

export async function buildEnhancedExtractionPrompt(context: PromptContext): Promise<GeneratedPrompt> {
  return promptBuilder.buildEnhancedExtractionPrompt(context);
}

export function buildReExtractionPrompt(
  contractText: string,
  fields: MetadataFieldDefinition[],
  previousValues: Map<string, { value: any; confidence: number }>
): GeneratedPrompt {
  return promptBuilder.buildReExtractionPrompt(contractText, fields, previousValues);
}

export function buildFieldPrompt(
  field: MetadataFieldDefinition,
  contractText: string,
  contractType?: string
): FieldPrompt {
  return promptBuilder.buildFieldPrompt(field, contractText, contractType);
}
