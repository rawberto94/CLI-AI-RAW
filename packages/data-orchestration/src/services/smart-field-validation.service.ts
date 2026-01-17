/**
 * Smart Field Validation Service
 * 
 * AI-powered validation of extracted contract fields:
 * - Cross-field consistency checking
 * - Business logic validation
 * - Format standardization
 * - Auto-correction suggestions
 * - Confidence-based validation thresholds
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';

// Types
export type FieldType = 
  | 'date' 
  | 'currency' 
  | 'percentage' 
  | 'duration' 
  | 'party' 
  | 'address' 
  | 'email' 
  | 'phone' 
  | 'number' 
  | 'text' 
  | 'boolean';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required: boolean;
  format?: string; // regex or format string
  min?: number;
  max?: number;
  allowedValues?: string[];
  relatedFields?: string[]; // Fields this depends on
  businessRules?: string[]; // Rule IDs
}

export interface ValidationIssue {
  field: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  currentValue: unknown;
  suggestedValue?: unknown;
  suggestedAction?: 'correct' | 'review' | 'confirm' | 'delete';
  confidence: number;
}

export interface CrossFieldValidation {
  fields: string[];
  rule: string;
  description: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  correctedFields: Record<string, unknown>;
  validatedFields: Record<string, { value: unknown; confidence: number }>;
  crossFieldIssues: ValidationIssue[];
  summary: {
    totalFields: number;
    validFields: number;
    issuesByLevel: Record<ValidationSeverity, number>;
    autoCorrectedCount: number;
    requiresReviewCount: number;
  };
}

export interface ValidationConfig {
  strictMode: boolean; // Fail on warnings
  autoCorrect: boolean; // Auto-apply high-confidence corrections
  autoCorrectThreshold: number; // Min confidence for auto-correct
  aiValidation: boolean; // Use AI for semantic validation
  crossFieldValidation: boolean;
  customRules?: CrossFieldValidation[];
}

// Default field definitions for common contract fields
const DEFAULT_FIELD_DEFINITIONS: FieldDefinition[] = [
  { name: 'effectiveDate', type: 'date', required: true, relatedFields: ['expirationDate', 'signatureDate'] },
  { name: 'expirationDate', type: 'date', required: true, relatedFields: ['effectiveDate', 'renewalDate'] },
  { name: 'signatureDate', type: 'date', required: false, relatedFields: ['effectiveDate'] },
  { name: 'totalValue', type: 'currency', required: true, min: 0 },
  { name: 'paymentTerms', type: 'text', required: true },
  { name: 'noticePeriod', type: 'duration', required: false },
  { name: 'renewalTerms', type: 'text', required: false },
  { name: 'terminationClause', type: 'text', required: false },
  { name: 'clientName', type: 'party', required: true },
  { name: 'vendorName', type: 'party', required: true },
  { name: 'billingAddress', type: 'address', required: false },
  { name: 'contactEmail', type: 'email', required: false },
  { name: 'contactPhone', type: 'phone', required: false },
  { name: 'autoRenewal', type: 'boolean', required: false },
  { name: 'liabilityLimit', type: 'currency', required: false, min: 0 },
  { name: 'discountPercentage', type: 'percentage', required: false, min: 0, max: 100 },
];

// Default cross-field validation rules
const DEFAULT_CROSS_FIELD_RULES: CrossFieldValidation[] = [
  {
    fields: ['effectiveDate', 'expirationDate'],
    rule: 'effectiveDate < expirationDate',
    description: 'Effective date must be before expiration date',
    severity: 'error',
  },
  {
    fields: ['signatureDate', 'effectiveDate'],
    rule: 'signatureDate <= effectiveDate',
    description: 'Signature date should be on or before effective date',
    severity: 'warning',
  },
  {
    fields: ['totalValue', 'liabilityLimit'],
    rule: 'liabilityLimit >= totalValue * 0.1',
    description: 'Liability limit should be at least 10% of total value',
    severity: 'warning',
  },
  {
    fields: ['autoRenewal', 'renewalTerms'],
    rule: 'autoRenewal === true implies renewalTerms is not empty',
    description: 'Auto-renewal requires renewal terms to be specified',
    severity: 'warning',
  },
];

class SmartFieldValidationService {
  private openai: OpenAI | null = null;
  private fieldDefinitions: Map<string, FieldDefinition> = new Map();
  private crossFieldRules: CrossFieldValidation[] = [];
  private validationHistory: Map<string, ValidationResult[]> = new Map();

  constructor() {
    // Load default definitions
    DEFAULT_FIELD_DEFINITIONS.forEach(def => {
      this.fieldDefinitions.set(def.name, def);
    });
    this.crossFieldRules = [...DEFAULT_CROSS_FIELD_RULES];
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  /**
   * Validate extracted fields
   */
  async validateFields(
    extractedFields: Record<string, unknown>,
    config: Partial<ValidationConfig> = {},
    contractContext?: { text?: string; type?: string }
  ): Promise<ValidationResult> {
    const fullConfig: ValidationConfig = {
      strictMode: false,
      autoCorrect: true,
      autoCorrectThreshold: 0.9,
      aiValidation: true,
      crossFieldValidation: true,
      ...config,
    };

    const issues: ValidationIssue[] = [];
    const correctedFields: Record<string, unknown> = {};
    const validatedFields: Record<string, { value: unknown; confidence: number }> = {};

    // Step 1: Type-based validation
    for (const [fieldName, value] of Object.entries(extractedFields)) {
      const definition = this.fieldDefinitions.get(fieldName);
      const fieldIssues = this.validateField(fieldName, value, definition);
      
      if (fieldIssues.length > 0) {
        issues.push(...fieldIssues);
        
        // Attempt auto-correction
        for (const issue of fieldIssues) {
          if (
            fullConfig.autoCorrect &&
            issue.suggestedValue !== undefined &&
            issue.confidence >= fullConfig.autoCorrectThreshold
          ) {
            correctedFields[fieldName] = issue.suggestedValue;
          }
        }
      } else {
        validatedFields[fieldName] = { value, confidence: 1.0 };
      }
    }

    // Step 2: Cross-field validation
    let crossFieldIssues: ValidationIssue[] = [];
    if (fullConfig.crossFieldValidation) {
      const allRules = [...this.crossFieldRules, ...(fullConfig.customRules || [])];
      crossFieldIssues = this.validateCrossFields(extractedFields, allRules);
      issues.push(...crossFieldIssues);
    }

    // Step 3: AI-powered semantic validation
    if (fullConfig.aiValidation && contractContext?.text) {
      const aiIssues = await this.aiSemanticValidation(
        extractedFields,
        contractContext.text,
        contractContext.type
      );
      issues.push(...aiIssues);

      // AI can provide high-confidence corrections
      for (const issue of aiIssues) {
        if (
          fullConfig.autoCorrect &&
          issue.suggestedValue !== undefined &&
          issue.confidence >= fullConfig.autoCorrectThreshold
        ) {
          correctedFields[issue.field] = issue.suggestedValue;
        }
      }
    }

    // Build result
    const totalFields = Object.keys(extractedFields).length;
    const issuesByLevel: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
    issues.forEach(i => issuesByLevel[i.severity]++);

    const result: ValidationResult = {
      isValid: fullConfig.strictMode 
        ? issues.length === 0 
        : issuesByLevel.error === 0,
      issues,
      correctedFields,
      validatedFields,
      crossFieldIssues,
      summary: {
        totalFields,
        validFields: totalFields - new Set(issues.map(i => i.field)).size,
        issuesByLevel,
        autoCorrectedCount: Object.keys(correctedFields).length,
        requiresReviewCount: issues.filter(i => i.suggestedAction === 'review').length,
      },
    };

    return result;
  }

  /**
   * Validate a single field
   */
  private validateField(
    fieldName: string,
    value: unknown,
    definition?: FieldDefinition
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check required
    if (definition?.required && (value === null || value === undefined || value === '')) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'REQUIRED_FIELD_MISSING',
        message: `Required field "${fieldName}" is missing or empty`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 1.0,
      });
      return issues; // No point validating further
    }

    if (value === null || value === undefined || value === '') {
      return issues; // Skip validation for empty optional fields
    }

    // Type-specific validation
    const type = definition?.type || this.inferType(fieldName);
    
    switch (type) {
      case 'date':
        this.validateDate(fieldName, value, issues);
        break;
      case 'currency':
        this.validateCurrency(fieldName, value, definition, issues);
        break;
      case 'percentage':
        this.validatePercentage(fieldName, value, definition, issues);
        break;
      case 'email':
        this.validateEmail(fieldName, value, issues);
        break;
      case 'phone':
        this.validatePhone(fieldName, value, issues);
        break;
      case 'number':
        this.validateNumber(fieldName, value, definition, issues);
        break;
    }

    // Check allowed values
    if (definition?.allowedValues && definition.allowedValues.length > 0) {
      const stringValue = String(value).toLowerCase();
      const allowed = definition.allowedValues.map(v => v.toLowerCase());
      if (!allowed.includes(stringValue)) {
        const closest = this.findClosestMatch(stringValue, definition.allowedValues);
        issues.push({
          field: fieldName,
          severity: 'warning',
          code: 'VALUE_NOT_IN_ALLOWED_LIST',
          message: `Value "${value}" is not in allowed list`,
          currentValue: value,
          suggestedValue: closest,
          suggestedAction: 'correct',
          confidence: 0.8,
        });
      }
    }

    return issues;
  }

  private validateDate(fieldName: string, value: unknown, issues: ValidationIssue[]): void {
    const strValue = String(value);
    const parsed = this.parseDate(strValue);

    if (!parsed) {
      const normalized = this.normalizeDate(strValue);
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'INVALID_DATE_FORMAT',
        message: `Invalid date format: "${value}"`,
        currentValue: value,
        suggestedValue: normalized,
        suggestedAction: normalized ? 'correct' : 'review',
        confidence: normalized ? 0.85 : 0.5,
      });
      return;
    }

    // Check if date is reasonable (not too far in past or future)
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());

    if (parsed < tenYearsAgo || parsed > tenYearsFromNow) {
      issues.push({
        field: fieldName,
        severity: 'warning',
        code: 'DATE_OUTSIDE_EXPECTED_RANGE',
        message: `Date "${value}" seems unusually far from current date`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.7,
      });
    }
  }

  private validateCurrency(
    fieldName: string,
    value: unknown,
    definition: FieldDefinition | undefined,
    issues: ValidationIssue[]
  ): void {
    const numValue = this.extractNumber(String(value));

    if (numValue === null) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'INVALID_CURRENCY_FORMAT',
        message: `Cannot parse currency value: "${value}"`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.5,
      });
      return;
    }

    if (definition?.min !== undefined && numValue < definition.min) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'VALUE_BELOW_MINIMUM',
        message: `Value ${numValue} is below minimum ${definition.min}`,
        currentValue: value,
        suggestedValue: definition.min,
        suggestedAction: 'review',
        confidence: 0.6,
      });
    }

    if (definition?.max !== undefined && numValue > definition.max) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'VALUE_ABOVE_MAXIMUM',
        message: `Value ${numValue} is above maximum ${definition.max}`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.6,
      });
    }
  }

  private validatePercentage(
    fieldName: string,
    value: unknown,
    definition: FieldDefinition | undefined,
    issues: ValidationIssue[]
  ): void {
    const numValue = this.extractNumber(String(value));

    if (numValue === null) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'INVALID_PERCENTAGE_FORMAT',
        message: `Cannot parse percentage: "${value}"`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.5,
      });
      return;
    }

    const min = definition?.min ?? 0;
    const max = definition?.max ?? 100;

    if (numValue < min || numValue > max) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'PERCENTAGE_OUT_OF_RANGE',
        message: `Percentage ${numValue}% is outside valid range (${min}%-${max}%)`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.7,
      });
    }
  }

  private validateEmail(fieldName: string, value: unknown, issues: ValidationIssue[]): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const strValue = String(value).trim();

    if (!emailRegex.test(strValue)) {
      const corrected = this.attemptEmailCorrection(strValue);
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'INVALID_EMAIL_FORMAT',
        message: `Invalid email format: "${value}"`,
        currentValue: value,
        suggestedValue: corrected !== strValue ? corrected : undefined,
        suggestedAction: corrected !== strValue ? 'correct' : 'review',
        confidence: corrected !== strValue ? 0.8 : 0.5,
      });
    }
  }

  private validatePhone(fieldName: string, value: unknown, issues: ValidationIssue[]): void {
    const strValue = String(value).replace(/[\s\-\(\)\.]/g, '');
    
    if (!/^\+?[\d]{7,15}$/.test(strValue)) {
      issues.push({
        field: fieldName,
        severity: 'warning',
        code: 'INVALID_PHONE_FORMAT',
        message: `Phone number may be invalid: "${value}"`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.6,
      });
    }
  }

  private validateNumber(
    fieldName: string,
    value: unknown,
    definition: FieldDefinition | undefined,
    issues: ValidationIssue[]
  ): void {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(numValue)) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'INVALID_NUMBER',
        message: `Cannot parse number: "${value}"`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.5,
      });
      return;
    }

    if (definition?.min !== undefined && numValue < definition.min) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'VALUE_BELOW_MINIMUM',
        message: `Value ${numValue} is below minimum ${definition.min}`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.7,
      });
    }

    if (definition?.max !== undefined && numValue > definition.max) {
      issues.push({
        field: fieldName,
        severity: 'error',
        code: 'VALUE_ABOVE_MAXIMUM',
        message: `Value ${numValue} is above maximum ${definition.max}`,
        currentValue: value,
        suggestedAction: 'review',
        confidence: 0.7,
      });
    }
  }

  /**
   * Validate cross-field relationships
   */
  private validateCrossFields(
    fields: Record<string, unknown>,
    rules: CrossFieldValidation[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const rule of rules) {
      // Check if all required fields exist
      const hasAllFields = rule.fields.every(f => fields[f] !== undefined && fields[f] !== null);
      if (!hasAllFields) continue;

      // Evaluate the rule
      const isValid = this.evaluateCrossFieldRule(rule, fields);
      
      if (!isValid) {
        issues.push({
          field: rule.fields.join(', '),
          severity: rule.severity,
          code: 'CROSS_FIELD_VALIDATION_FAILED',
          message: rule.description,
          currentValue: rule.fields.map(f => `${f}=${fields[f]}`).join(', '),
          suggestedAction: 'review',
          confidence: 0.9,
        });
      }
    }

    return issues;
  }

  private evaluateCrossFieldRule(
    rule: CrossFieldValidation,
    fields: Record<string, unknown>
  ): boolean {
    try {
      // Parse dates for comparison
      const values: Record<string, unknown> = {};
      for (const fieldName of rule.fields) {
        const value = fields[fieldName];
        const def = this.fieldDefinitions.get(fieldName);
        
        if (def?.type === 'date') {
          values[fieldName] = this.parseDate(String(value))?.getTime() || 0;
        } else if (def?.type === 'currency' || def?.type === 'number' || def?.type === 'percentage') {
          values[fieldName] = this.extractNumber(String(value)) || 0;
        } else if (def?.type === 'boolean') {
          values[fieldName] = value === true || value === 'true' || value === 'yes';
        } else {
          values[fieldName] = value;
        }
      }

      // Simple rule evaluation
      if (rule.rule.includes('<')) {
        const [left, right] = rule.rule.split('<').map(s => s.trim());
        const leftVal = values[left];
        const rightVal = values[right];
        if (typeof leftVal === 'number' && typeof rightVal === 'number') {
          return leftVal < rightVal;
        }
      }

      if (rule.rule.includes('<=')) {
        const [left, right] = rule.rule.split('<=').map(s => s.trim());
        const leftVal = values[left];
        const rightVal = values[right];
        if (typeof leftVal === 'number' && typeof rightVal === 'number') {
          return leftVal <= rightVal;
        }
      }

      if (rule.rule.includes('>=')) {
        const [left, right] = rule.rule.split('>=').map(s => s.trim());
        const leftVal = values[left];
        const rightVal = values[right];
        if (typeof leftVal === 'number' && typeof rightVal === 'number') {
          return leftVal >= rightVal;
        }
      }

      if (rule.rule.includes('implies')) {
        // X implies Y
        const [condition, consequence] = rule.rule.split('implies').map(s => s.trim());
        const conditionTrue = this.evaluateCondition(condition, values);
        const consequenceTrue = this.evaluateCondition(consequence, values);
        return !conditionTrue || consequenceTrue;
      }

      return true; // Default to valid if we can't parse
    } catch {
      return true; // Don't fail on evaluation errors
    }
  }

  private evaluateCondition(condition: string, values: Record<string, unknown>): boolean {
    if (condition.includes('=== true')) {
      const fieldName = condition.replace('=== true', '').trim();
      return values[fieldName] === true;
    }
    if (condition.includes('is not empty')) {
      const fieldName = condition.replace('is not empty', '').trim();
      const val = values[fieldName];
      return val !== null && val !== undefined && val !== '';
    }
    return false;
  }

  /**
   * AI-powered semantic validation
   */
  private async aiSemanticValidation(
    fields: Record<string, unknown>,
    contractText: string,
    contractType?: string
  ): Promise<ValidationIssue[]> {
    const openai = this.getOpenAI();

    const prompt = `You are validating extracted contract data against the original contract text.

EXTRACTED FIELDS:
${JSON.stringify(fields, null, 2)}

CONTRACT TEXT (excerpt):
${contractText.substring(0, 8000)}

CONTRACT TYPE: ${contractType || 'Unknown'}

For each field, verify if the extracted value matches what's in the contract.
Identify any:
1. Incorrect extractions (value doesn't match contract)
2. Partial extractions (value is incomplete)
3. Swapped fields (values in wrong fields)
4. Format issues (correct data but wrong format)

Return JSON with "issues" array, each containing:
- field: field name
- severity: "error", "warning", or "info"
- code: issue code
- message: explanation
- currentValue: the extracted value
- suggestedValue: the correct value if applicable
- suggestedAction: "correct", "review", "confirm", or "delete"
- confidence: 0-1

Only include actual issues found. Empty array if all is correct.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return (parsed.issues || []).map((issue: any) => ({
        ...issue,
        code: issue.code || 'AI_VALIDATION_ISSUE',
      }));
    } catch {
      return [];
    }
  }

  // Helper methods
  private inferType(fieldName: string): FieldType {
    const lower = fieldName.toLowerCase();
    if (lower.includes('date') || lower.includes('time')) return 'date';
    if (lower.includes('email')) return 'email';
    if (lower.includes('phone') || lower.includes('tel')) return 'phone';
    if (lower.includes('price') || lower.includes('cost') || lower.includes('value') || lower.includes('amount')) return 'currency';
    if (lower.includes('percent') || lower.includes('rate')) return 'percentage';
    if (lower.includes('address')) return 'address';
    if (lower.includes('name') || lower.includes('party') || lower.includes('company')) return 'party';
    return 'text';
  }

  private parseDate(value: string): Date | null {
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
      /^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/, // Month DD, YYYY
    ];

    // Try native parsing first
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try specific formats
    for (const format of formats) {
      if (format.test(value)) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    return null;
  }

  private normalizeDate(value: string): string | undefined {
    const parsed = this.parseDate(value);
    if (parsed) {
      return parsed.toISOString().split('T')[0];
    }

    // Try to extract date-like patterns
    const match = value.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (match) {
      const [, a, b, c] = match;
      // Assume MM/DD/YYYY or DD/MM/YYYY based on values
      const year = c.length === 2 ? `20${c}` : c;
      return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }

    return undefined;
  }

  private extractNumber(value: string): number | null {
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[$€£¥,\s]/g, '').replace(/[kK]$/, '000').replace(/[mM]$/, '000000');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private findClosestMatch(value: string, options: string[]): string | undefined {
    let bestMatch: string | undefined;
    let bestScore = 0;

    for (const option of options) {
      const score = this.similarity(value.toLowerCase(), option.toLowerCase());
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = option;
      }
    }

    return bestMatch;
  }

  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.includes(shorter)) return shorter.length / longer.length;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
  }

  private attemptEmailCorrection(email: string): string {
    // Common typo fixes
    let corrected = email
      .replace(/\s/g, '')
      .replace(/,/g, '.')
      .replace(/\.\.+/g, '.')
      .replace(/@+/g, '@');

    // Common domain typos
    const domainFixes: Record<string, string> = {
      'gmial.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'gamil.com': 'gmail.com',
      'outlok.com': 'outlook.com',
      'hotmal.com': 'hotmail.com',
      'yaho.com': 'yahoo.com',
    };

    for (const [typo, correct] of Object.entries(domainFixes)) {
      if (corrected.endsWith(typo)) {
        corrected = corrected.replace(typo, correct);
      }
    }

    return corrected;
  }

  /**
   * Add custom field definition
   */
  addFieldDefinition(definition: FieldDefinition): void {
    this.fieldDefinitions.set(definition.name, definition);
  }

  /**
   * Add cross-field validation rule
   */
  addCrossFieldRule(rule: CrossFieldValidation): void {
    this.crossFieldRules.push(rule);
  }

  /**
   * Get all field definitions
   */
  getFieldDefinitions(): FieldDefinition[] {
    return Array.from(this.fieldDefinitions.values());
  }

  /**
   * Get validation history for a contract
   */
  getValidationHistory(contractId: string): ValidationResult[] {
    return this.validationHistory.get(contractId) || [];
  }
}

// Export singleton
export const smartFieldValidationService = new SmartFieldValidationService();
export { SmartFieldValidationService };
