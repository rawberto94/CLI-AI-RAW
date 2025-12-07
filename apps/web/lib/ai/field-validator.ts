/**
 * Intelligent Field Value Validator
 * 
 * Uses AI to cross-validate extracted metadata values for:
 * - Internal consistency (dates make sense together)
 * - Cross-field validation (party names match signatures)
 * - Format validation (currency, dates, etc.)
 * - Semantic validation (values make sense in context)
 */

import OpenAI from "openai";
import type { MetadataFieldType } from "@/lib/services/metadata-schema.service";

// Local type aliases
type FieldType = MetadataFieldType;

interface ExtractedField {
  fieldKey: string;
  value: any;
  confidence: number;
  fieldType?: FieldType;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  suggestions: FieldSuggestion[];
  crossValidation: CrossValidationResult[];
}

export interface ValidationIssue {
  fieldKey: string;
  severity: "error" | "warning" | "info";
  type: ValidationIssueType;
  message: string;
  suggestedFix?: string;
}

export type ValidationIssueType = 
  | "format"           // Value doesn't match expected format
  | "range"            // Value outside expected range
  | "consistency"      // Inconsistent with other fields
  | "logic"            // Logically impossible
  | "missing"          // Required field missing
  | "duplicate"        // Same value in related fields
  | "semantic"         // Value doesn't make sense in context
  | "completeness";    // Field partially filled

export interface FieldSuggestion {
  fieldKey: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
}

export interface CrossValidationResult {
  fields: string[];
  relationship: string;
  isConsistent: boolean;
  details: string;
}

export interface ValidationRules {
  dateConsistency?: DateConsistencyRule[];
  partyConsistency?: PartyConsistencyRule[];
  currencyConsistency?: CurrencyConsistencyRule[];
  customRules?: CustomValidationRule[];
}

export interface DateConsistencyRule {
  earlierField: string;
  laterField: string;
  description: string;
  allowEqual?: boolean;
  maxGapDays?: number;
}

export interface PartyConsistencyRule {
  partyField: string;
  relatedFields: string[];
  description: string;
}

export interface CurrencyConsistencyRule {
  fields: string[];
  sameCurrency?: boolean;
  description: string;
}

export interface CustomValidationRule {
  fields: string[];
  validate: (values: Record<string, any>) => ValidationIssue | null;
  description: string;
}

// ============================================================================
// FIELD VALUE VALIDATOR
// ============================================================================

export class FieldValueValidator {
  private openai: OpenAI;
  private rules: ValidationRules;

  constructor(rules?: ValidationRules) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.rules = rules ?? this.getDefaultRules();
  }

  /**
   * Validate all extracted fields
   */
  async validateFields(
    fields: ExtractedField[],
    contractText?: string
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const suggestions: FieldSuggestion[] = [];
    const crossValidation: CrossValidationResult[] = [];

    // Build field map for easy lookup
    const fieldMap = new Map<string, ExtractedField>();
    for (const field of fields) {
      fieldMap.set(field.fieldKey, field);
    }

    // 1. Format validation for each field
    for (const field of fields) {
      const formatIssues = this.validateFieldFormat(field);
      issues.push(...formatIssues);
    }

    // 2. Cross-field validation
    const crossIssues = await this.validateCrossFields(fields);
    issues.push(...crossIssues.issues);
    crossValidation.push(...crossIssues.results);

    // 3. Semantic validation with AI (if contract text available)
    if (contractText) {
      const semanticResult = await this.validateSemantics(fields, contractText);
      issues.push(...semanticResult.issues);
      suggestions.push(...semanticResult.suggestions);
    }

    // 4. Low confidence warnings
    for (const field of fields) {
      if (field.confidence !== null && field.confidence < 0.5 && field.value !== null) {
        issues.push({
          fieldKey: field.fieldKey,
          severity: "warning",
          type: "completeness",
          message: `Low confidence (${Math.round(field.confidence * 100)}%) - please verify`,
        });
      }
    }

    // Calculate overall validity
    const hasErrors = issues.some(i => i.severity === "error");
    const hasWarnings = issues.some(i => i.severity === "warning");
    
    const confidence = hasErrors 
      ? 0.3 
      : hasWarnings 
        ? 0.7 
        : 0.95;

    return {
      isValid: !hasErrors,
      confidence,
      issues,
      suggestions,
      crossValidation,
    };
  }

  /**
   * Validate individual field format
   */
  private validateFieldFormat(field: ExtractedField): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (field.value === null || field.value === undefined) {
      return issues; // Skip null values
    }

    switch (field.fieldType) {
      case "date":
        if (!this.isValidDate(field.value)) {
          issues.push({
            fieldKey: field.fieldKey,
            severity: "error",
            type: "format",
            message: `Invalid date format: "${field.value}"`,
            suggestedFix: "Use ISO date format (YYYY-MM-DD)",
          });
        }
        break;

      case "currency":
        if (!this.isValidCurrency(field.value)) {
          issues.push({
            fieldKey: field.fieldKey,
            severity: "error",
            type: "format",
            message: `Invalid currency format: "${JSON.stringify(field.value)}"`,
            suggestedFix: "Use format { amount: number, currency: string }",
          });
        }
        break;

      case "email":
        if (!this.isValidEmail(String(field.value))) {
          issues.push({
            fieldKey: field.fieldKey,
            severity: "error",
            type: "format",
            message: `Invalid email format: "${field.value}"`,
          });
        }
        break;

      case "phone":
        if (!this.isValidPhone(String(field.value))) {
          issues.push({
            fieldKey: field.fieldKey,
            severity: "warning",
            type: "format",
            message: `Unusual phone format: "${field.value}"`,
          });
        }
        break;

      case "url":
        if (!this.isValidUrl(String(field.value))) {
          issues.push({
            fieldKey: field.fieldKey,
            severity: "error",
            type: "format",
            message: `Invalid URL format: "${field.value}"`,
          });
        }
        break;

      case "percentage":
        const pctValue = Number(field.value);
        if (isNaN(pctValue) || pctValue < 0 || pctValue > 100) {
          issues.push({
            fieldKey: field.fieldKey,
            severity: "error",
            type: "range",
            message: `Invalid percentage: "${field.value}" (should be 0-100)`,
          });
        }
        break;
    }

    return issues;
  }

  /**
   * Validate cross-field relationships
   */
  private async validateCrossFields(
    fields: ExtractedField[]
  ): Promise<{ issues: ValidationIssue[]; results: CrossValidationResult[] }> {
    const issues: ValidationIssue[] = [];
    const results: CrossValidationResult[] = [];
    
    const fieldMap = new Map<string, any>();
    for (const field of fields) {
      fieldMap.set(field.fieldKey, field.value);
    }

    // Date consistency checks
    for (const rule of this.rules.dateConsistency ?? []) {
      const earlierDate = fieldMap.get(rule.earlierField);
      const laterDate = fieldMap.get(rule.laterField);

      if (earlierDate && laterDate) {
        const earlier = new Date(earlierDate);
        const later = new Date(laterDate);

        let isConsistent = true;
        let details = "";

        if (rule.allowEqual) {
          isConsistent = earlier <= later;
        } else {
          isConsistent = earlier < later;
        }

        if (!isConsistent) {
          issues.push({
            fieldKey: rule.laterField,
            severity: "error",
            type: "consistency",
            message: `${rule.description}: ${rule.laterField} (${laterDate}) should be after ${rule.earlierField} (${earlierDate})`,
          });
          details = "Date order is incorrect";
        } else if (rule.maxGapDays) {
          const gapDays = (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
          if (gapDays > rule.maxGapDays) {
            issues.push({
              fieldKey: rule.laterField,
              severity: "warning",
              type: "logic",
              message: `Gap between ${rule.earlierField} and ${rule.laterField} is ${Math.round(gapDays)} days (expected max ${rule.maxGapDays})`,
            });
            details = "Date gap exceeds expected range";
            isConsistent = false;
          } else {
            details = `Valid gap of ${Math.round(gapDays)} days`;
          }
        } else {
          details = "Date order is correct";
        }

        results.push({
          fields: [rule.earlierField, rule.laterField],
          relationship: rule.description,
          isConsistent,
          details,
        });
      }
    }

    // Currency consistency checks
    for (const rule of this.rules.currencyConsistency ?? []) {
      const currencies = new Set<string>();
      
      for (const fieldKey of rule.fields) {
        const value = fieldMap.get(fieldKey);
        if (value && typeof value === "object" && value.currency) {
          currencies.add(value.currency);
        }
      }

      if (rule.sameCurrency && currencies.size > 1) {
        const firstField = rule.fields[0] ?? '';
        issues.push({
          fieldKey: firstField,
          severity: "warning",
          type: "consistency",
          message: `${rule.description}: Multiple currencies found (${Array.from(currencies).join(", ")})`,
        });
        
        results.push({
          fields: rule.fields,
          relationship: rule.description,
          isConsistent: false,
          details: `Found ${currencies.size} different currencies: ${Array.from(currencies).join(", ")}`,
        });
      } else if (currencies.size <= 1) {
        results.push({
          fields: rule.fields,
          relationship: rule.description,
          isConsistent: true,
          details: currencies.size === 1 ? `All values use ${Array.from(currencies)[0]}` : "No currency values",
        });
      }
    }

    return { issues, results };
  }

  /**
   * Use AI to validate semantic consistency
   */
  private async validateSemantics(
    fields: ExtractedField[],
    contractText: string
  ): Promise<{ issues: ValidationIssue[]; suggestions: FieldSuggestion[] }> {
    const issues: ValidationIssue[] = [];
    const suggestions: FieldSuggestion[] = [];

    // Only validate fields with values
    const fieldsWithValues = fields.filter(f => f.value !== null);
    if (fieldsWithValues.length === 0) {
      return { issues, suggestions };
    }

    const fieldSummary = fieldsWithValues
      .map(f => `- ${f.fieldKey} (${f.fieldType}): ${JSON.stringify(f.value)}`)
      .join("\n");

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a contract validation expert. Analyze the extracted field values against the original contract text and identify any issues.

For each issue found, provide:
- fieldKey: The field with the issue
- severity: "error" for definite mistakes, "warning" for suspicious values, "info" for suggestions
- type: One of "semantic", "consistency", "logic", "completeness"
- message: Clear explanation of the issue
- suggestedFix: If applicable, the correct value

Also provide suggestions for fields that might have better values.

Return JSON in this format:
{
  "issues": [...],
  "suggestions": [
    {
      "fieldKey": "string",
      "currentValue": any,
      "suggestedValue": any,
      "reason": "string",
      "confidence": 0.0-1.0
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Contract text (first 3000 chars):
${contractText.substring(0, 3000)}

Extracted field values:
${fieldSummary}

Validate these extracted values against the contract text. Check for:
1. Values that contradict the contract text
2. Values that don't match the context
3. Potentially better or more complete values
4. Missing important information that was in the text but not extracted`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        
        // Map issues
        for (const issue of result.issues ?? []) {
          issues.push({
            fieldKey: issue.fieldKey,
            severity: issue.severity || "warning",
            type: issue.type || "semantic",
            message: issue.message,
            suggestedFix: issue.suggestedFix,
          });
        }

        // Map suggestions
        for (const suggestion of result.suggestions ?? []) {
          suggestions.push({
            fieldKey: suggestion.fieldKey,
            currentValue: suggestion.currentValue,
            suggestedValue: suggestion.suggestedValue,
            reason: suggestion.reason,
            confidence: suggestion.confidence ?? 0.7,
          });
        }
      }
    } catch (error) {
      console.error("Semantic validation error:", error);
      // Don't throw - semantic validation is optional enhancement
    }

    return { issues, suggestions };
  }

  // --------------------------------------------------------------------------
  // Format Validators
  // --------------------------------------------------------------------------

  private isValidDate(value: any): boolean {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private isValidCurrency(value: any): boolean {
    if (!value) return false;
    if (typeof value === "object") {
      return (
        typeof value.amount === "number" &&
        typeof value.currency === "string" &&
        value.currency.length === 3
      );
    }
    return typeof value === "number";
  }

  private isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private isValidPhone(value: string): boolean {
    // Basic phone validation - at least 10 digits
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10;
  }

  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Default Rules
  // --------------------------------------------------------------------------

  private getDefaultRules(): ValidationRules {
    return {
      dateConsistency: [
        {
          earlierField: "effective_date",
          laterField: "expiration_date",
          description: "Contract duration",
          allowEqual: false,
        },
        {
          earlierField: "effective_date",
          laterField: "termination_date",
          description: "Termination must be after start",
          allowEqual: false,
        },
        {
          earlierField: "signature_date",
          laterField: "effective_date",
          description: "Effective date after signature",
          allowEqual: true,
          maxGapDays: 90,
        },
      ],
      currencyConsistency: [
        {
          fields: ["contract_value", "annual_value", "payment_amount"],
          sameCurrency: true,
          description: "Payment currency consistency",
        },
      ],
    };
  }
}

// ============================================================================
// QUICK VALIDATION FUNCTIONS
// ============================================================================

/**
 * Quick validation of a single field
 */
export function validateField(
  value: any,
  fieldType: FieldType
): { valid: boolean; message?: string } {
  const validator = new FieldValueValidator();
  const mockField: ExtractedField = {
    fieldKey: "test",
    fieldType,
    value,
    confidence: 1,
  };

  const issues = (validator as any).validateFieldFormat(mockField);
  
  return {
    valid: issues.length === 0,
    message: issues[0]?.message,
  };
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: string,
  endDate: string
): { valid: boolean; message?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { valid: false, message: "Invalid start date" };
  }
  if (isNaN(end.getTime())) {
    return { valid: false, message: "Invalid end date" };
  }
  if (start >= end) {
    return { valid: false, message: "End date must be after start date" };
  }

  return { valid: true };
}

/**
 * Validate currency consistency
 */
export function validateCurrencyMatch(
  values: Array<{ amount: number; currency: string }>
): { consistent: boolean; currencies: string[] } {
  const currencies = [...new Set(values.map(v => v.currency))];
  return {
    consistent: currencies.length <= 1,
    currencies,
  };
}
