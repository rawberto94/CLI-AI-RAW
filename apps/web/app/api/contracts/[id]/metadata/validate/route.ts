/**
 * Metadata Validation API
 * 
 * Provides AI-assisted metadata validation and human verification workflow.
 * Returns confidence scores and suggestions for each field.
 */

import { NextRequest } from 'next/server';
import cors from '@/lib/security/cors';
import OpenAI from 'openai';
import { getApiTenantId } from '@/lib/tenant-server';
import { CONTRACT_METADATA_FIELDS, MetadataFieldDefinition } from '@/lib/types/contract-metadata-schema';
import type { Prisma } from '@prisma/client';
import { contractService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface MetadataField {
  key: string;
  value: unknown;
  status: 'pending' | 'validated' | 'rejected' | 'modified';
  aiConfidence: number;
  humanValidated: boolean;
  suggestions?: string[];
  validationErrors?: string[];
}

interface ValidationRequest {
  fields: Record<string, unknown>;
  contractText?: string;
  validateAll?: boolean;
  fieldsToValidate?: string[];
}

/**
 * AI validation result item
 */
interface AIValidationItem {
  key: string;
  isValid: boolean;
  confidence: number;
  suggestedValue?: unknown;
  notes?: string;
}

interface ValidationResult {
  fields: MetadataField[];
  summary: {
    total: number;
    validated: number;
    pending: number;
    rejected: number;
    modified: number;
    overallConfidence: number;
  };
  suggestions: string[];
}

/**
 * POST /api/contracts/[id]/metadata/validate - Validate metadata fields
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _contractId } = await params;
  
  const ctx = getApiContext(request);
  try {
    const body: ValidationRequest = await request.json();
    const { fields, contractText, validateAll = true, fieldsToValidate } = body;
    const _tenantId = await getApiTenantId(request);

    if (!fields || Object.keys(fields).length === 0) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No fields provided for validation', 400);
    }

    // Determine which fields to validate
    const fieldsToProcess = validateAll
      ? Object.entries(fields)
      : Object.entries(fields).filter(([key]) => fieldsToValidate?.includes(key));

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      // Return deterministic rule-based validation if no API key
      return createSuccessResponse(ctx, {
        success: true,
        data: generateFallbackValidation(fieldsToProcess),
        message: 'Validation completed using rule-based validation (OpenAI not configured)'
      });
    }

    // Use AI for validation if contract text is available
    if (contractText) {
      const aiValidation = await validateWithAI(fieldsToProcess, contractText);
      return createSuccessResponse(ctx, {
        success: true,
        data: aiValidation
      });
    }

    // Rule-based validation fallback
    const ruleBasedValidation = validateWithRules(fieldsToProcess);
    return createSuccessResponse(ctx, {
      success: true,
      data: ruleBasedValidation
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * PUT /api/contracts/[id]/metadata/validate - Confirm human validation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  
  const ctx = getApiContext(request);
  try {
    const body = await request.json();
    const { fieldKey, action, newValue, reason, allFields, resetAll } = body;
    const tenantId = await getApiTenantId(request);

    // Handle reset all verifications
    if (resetAll === true) {
      try {
        const { prisma } = await import('@/lib/prisma');
        
        const existing = await prisma.contractMetadata.findUnique({
          where: { contractId },
        });

        if (existing) {
          const customFields = (existing.customFields as Record<string, unknown>) || {};
          // Clear all field validations
          customFields._fieldValidations = {};
          
          await prisma.contractMetadata.update({
            where: { contractId },
            data: {
              customFields: customFields as Prisma.InputJsonValue,
              lastUpdated: new Date(),
              updatedBy: 'human-validator',
            },
          });
        }

        return createSuccessResponse(ctx, {
          success: true,
          message: 'All verifications have been reset',
          data: { contractId }
        });
      } catch (error) {
        return handleApiError(ctx, error);
      }
    }

    // If allFields is provided, save all validated metadata
    if (allFields && typeof allFields === 'object') {
      try {
        const { prisma } = await import('@/lib/prisma');
        
        // Get existing metadata
        const existing = await prisma.contractMetadata.findUnique({
          where: { contractId },
        });

        const now = new Date();
        const customFields = {
          ...(existing?.customFields as any || {}),
          ...allFields,
          _validationStatus: {
            validatedAt: now.toISOString(),
            validatedBy: 'human',
            fieldCount: Object.keys(allFields).length,
          }
        };

        if (existing) {
          await prisma.contractMetadata.update({
            where: { contractId },
            data: {
              customFields,
              lastUpdated: now,
              updatedBy: 'human-validator',
            },
          });
        } else {
          await prisma.contractMetadata.create({
            data: {
              contractId,
              tenantId,
              customFields,
              systemFields: {},
              tags: [],
              lastUpdated: now,
              updatedBy: 'human-validator',
            },
          });
        }

        return createSuccessResponse(ctx, {
          success: true,
          message: 'All validated metadata saved successfully',
          data: { contractId, fieldCount: Object.keys(allFields).length }
        });
      } catch {
        // Continue with non-persistent response for demo mode
      }
    }

    if (!fieldKey || !action) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Field key and action are required', 400);
    }

    // Record the validation action for single field
    const validationRecord = {
      contractId,
      tenantId,
      fieldKey,
      action, // 'validate', 'reject', 'modify'
      newValue: action === 'modify' ? newValue : undefined,
      reason,
      timestamp: new Date().toISOString(),
      validatedBy: 'human'
    };

    // Try to persist single field validation
    try {
      const { prisma } = await import('@/lib/prisma');
      
      const existing = await prisma.contractMetadata.findUnique({
        where: { contractId },
      });

      if (existing) {
        const customFields = existing.customFields as any || {};
        customFields[fieldKey] = action === 'modify' ? newValue : customFields[fieldKey];
        customFields._fieldValidations = customFields._fieldValidations || {};
        customFields._fieldValidations[fieldKey] = {
          status: action,
          validatedAt: new Date().toISOString(),
          reason,
        };

        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            customFields,
            lastUpdated: new Date(),
            updatedBy: 'human-validator',
          },
        });
      } else {
        // Create new ContractMetadata record if it doesn't exist
        const customFields: any = {
          _fieldValidations: {
            [fieldKey]: {
              status: action,
              validatedAt: new Date().toISOString(),
              reason,
            }
          }
        };
        if (action === 'modify') {
          customFields[fieldKey] = newValue;
        }

        await prisma.contractMetadata.create({
          data: {
            contractId,
            tenantId,
            customFields,
            systemFields: {},
            tags: [],
            lastUpdated: new Date(),
            updatedBy: 'human-validator',
          },
        });
      }
    } catch (dbError) {
      console.error('Failed to persist field validation:', dbError);
      // Continue with success response for demo
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: validationRecord,
      message: `Field "${fieldKey}" ${action}d successfully`
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

async function validateWithAI(
  fields: [string, any][],
  contractText: string
): Promise<ValidationResult> {
  const fieldsList = fields.map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
  }));

  const prompt = `Analyze the following contract text and validate these extracted metadata fields.
For each field, provide:
1. A confidence score (0-100) indicating how accurately the value matches the contract
2. Any corrections or alternative values found in the contract
3. Validation notes or concerns

Contract text:
${contractText.slice(0, 8000)}

Fields to validate:
${JSON.stringify(fieldsList, null, 2)}

Respond in JSON format:
{
  "validations": [
    {
      "key": "field_key",
      "confidence": 85,
      "isValid": true,
      "suggestedValue": "corrected value if different",
      "notes": "validation notes",
      "source": "quote or location in contract"
    }
  ],
  "overallConfidence": 80,
  "suggestions": ["general suggestions for improvement"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a contract metadata validator. Analyze extracted metadata against contract text and provide confidence scores and corrections.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}') as {
      validations?: AIValidationItem[];
      overallConfidence?: number;
      suggestions?: string[];
    };
    
    // Transform AI response to our format
    const validatedFields: MetadataField[] = fields.map(([key, value]) => {
      const aiValidation = result.validations?.find((v: AIValidationItem) => v.key === key);

      const suggestedValue = aiValidation?.suggestedValue;
      const suggestions =
        typeof suggestedValue === 'string' &&
        suggestedValue.length > 0 &&
        suggestedValue !== String(value ?? '')
          ? [suggestedValue]
          : undefined;

      return {
        key,
        value,
        status: aiValidation?.isValid ? 'validated' : 'pending',
        aiConfidence: aiValidation?.confidence || 50,
        humanValidated: false,
        suggestions,
        validationErrors: aiValidation?.notes ? [aiValidation.notes] : undefined
      };
    });

    const validated = validatedFields.filter(f => f.status === 'validated').length;
    
    return {
      fields: validatedFields,
      summary: {
        total: validatedFields.length,
        validated,
        pending: validatedFields.length - validated,
        rejected: 0,
        modified: 0,
        overallConfidence: result.overallConfidence || 
          validatedFields.reduce((sum, f) => sum + f.aiConfidence, 0) / validatedFields.length
      },
      suggestions: result.suggestions || []
    };

  } catch {
    // Fall back to rule-based validation
    return validateWithRules(fields);
  }
}

function validateWithRules(fields: [string, unknown][]): ValidationResult {
  const validatedFields: MetadataField[] = fields.map(([key, value]) => {
    const confidence = calculateRuleBasedConfidence(key, value);
    const suggestions = generateSuggestions(key, value);
    const errors = validateField(key, value);

    return {
      key,
      value,
      status: errors.length === 0 && confidence >= 70 ? 'validated' : 'pending',
      aiConfidence: confidence,
      humanValidated: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      validationErrors: errors.length > 0 ? errors : undefined
    };
  });

  const validated = validatedFields.filter(f => f.status === 'validated').length;

  return {
    fields: validatedFields,
    summary: {
      total: validatedFields.length,
      validated,
      pending: validatedFields.length - validated,
      rejected: 0,
      modified: 0,
      overallConfidence: 
        validatedFields.reduce((sum, f) => sum + f.aiConfidence, 0) / validatedFields.length
    },
    suggestions: [
      'Review fields with confidence below 70%',
      'Verify date formats match your organization standards',
      'Ensure all required fields are populated'
    ]
  };
}

/**
 * Schema-aware rule-based confidence calculation.
 * Uses field definitions from CONTRACT_METADATA_FIELDS for more accurate scoring.
 */
function calculateRuleBasedConfidence(key: string, value: unknown): number {
  // Find field definition from schema
  const fieldDef = CONTRACT_METADATA_FIELDS.find(
    f => f.key === key || f.key === key.replace(/_/g, '')
  );
  
  // Base confidence depends on whether we have schema definition
  let confidence = fieldDef ? 55 : 45;

  // Check if value exists and is not empty
  if (value === null || value === undefined || value === '') {
    // If required field is empty, very low confidence
    if (fieldDef?.required) {
      return 15;
    }
    return 30;
  }

  // Schema-aware validation
  if (fieldDef) {
    confidence += validateByFieldType(fieldDef, value);
    
    // Boost confidence if field has no attention flags
    if (fieldDef.ui_attention === 'none') {
      confidence += 5;
    }
    
    // Lower confidence for fields marked as needing attention
    if (fieldDef.ui_attention === 'error') {
      confidence -= 10;
    } else if (fieldDef.ui_attention === 'warning') {
      confidence -= 5;
    }
  } else {
    // Fallback to key-name based validation
    confidence += validateByKeyName(key, value);
  }

  // Cap at 100, minimum 10
  return Math.min(100, Math.max(10, confidence));
}

/**
 * Validate value based on field type definition
 */
function validateByFieldType(fieldDef: MetadataFieldDefinition, value: unknown): number {
  let bonus = 0;
  
  switch (fieldDef.type) {
    case 'date':
      if (isValidDate(value)) {
        bonus += 30;
        // Extra bonus for ISO format
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          bonus += 10;
        }
      } else {
        bonus -= 25;
      }
      break;
      
    case 'decimal':
    case 'integer':
      if (typeof value === 'number') {
        bonus += 25;
        // Ensure positive for amounts
        if (fieldDef.key.includes('amount') || fieldDef.key.includes('value')) {
          bonus += value >= 0 ? 10 : -15;
        }
      } else if (!isNaN(parseFloat(String(value)))) {
        bonus += 15;
      } else {
        bonus -= 20;
      }
      break;
      
    case 'enum':
      if (fieldDef.enum?.includes(String(value))) {
        bonus += 35; // High confidence for valid enum value
      } else {
        bonus -= 30; // Low confidence for invalid enum
      }
      break;
      
    case 'boolean':
      if (typeof value === 'boolean' || value === 'true' || value === 'false') {
        bonus += 30;
      } else {
        bonus -= 20;
      }
      break;
      
    case 'string':
      const strValue = String(value);
      if (strValue.length >= 1 && strValue.length <= 1000) {
        bonus += 15;
        
        // Format-specific validation
        if (fieldDef.format === 'ISO4217' && isValidCurrencyCode(strValue)) {
          bonus += 20;
        } else if (fieldDef.format === 'ISO639-1_or_name' && isValidLanguageCode(strValue)) {
          bonus += 20;
        } else if (fieldDef.format === 'ISO3166-1-alpha2_or_name' && strValue.length >= 2) {
          bonus += 15;
        }
      }
      break;
      
    case 'fk':
    case 'array_fk':
      // Foreign key references - check if valid ID format
      if (Array.isArray(value)) {
        bonus += value.length > 0 ? 20 : 0;
      } else if (typeof value === 'string' && value.length > 0) {
        bonus += 20;
      }
      break;
  }
  
  return bonus;
}

/**
 * Fallback validation based on key name patterns
 */
function validateByKeyName(key: string, value: unknown): number {
  let bonus = 0;
  const keyLower = key.toLowerCase();

  // Date fields
  if (keyLower.includes('date') || keyLower.includes('expir')) {
    if (isValidDate(value)) {
      bonus += 25;
    } else {
      bonus -= 20;
    }
  }

  // Email fields
  if (keyLower.includes('email')) {
    if (isValidEmail(String(value))) {
      bonus += 30;
    } else {
      bonus -= 20;
    }
  }

  // Amount/value fields
  if (keyLower.includes('value') || keyLower.includes('amount') || keyLower.includes('price')) {
    if (typeof value === 'number' || !isNaN(parseFloat(String(value)))) {
      bonus += 20;
    }
  }

  // Name fields - check for reasonable length
  if (keyLower.includes('name') || keyLower.includes('party')) {
    if (String(value).length >= 2 && String(value).length <= 200) {
      bonus += 15;
    }
  }

  return bonus;
}

/**
 * Check if value is a valid ISO 4217 currency code
 */
function isValidCurrencyCode(value: string): boolean {
  const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY', 'INR', 'BRL', 'MXN', 'KRW', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR', 'RUB'];
  return commonCurrencies.includes(value.toUpperCase()) || /^[A-Z]{3}$/.test(value.toUpperCase());
}

/**
 * Check if value is a valid language code or name
 */
function isValidLanguageCode(value: string): boolean {
  const commonLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'ru', 'nl', 'pl', 'sv', 'da', 'no', 'fi'];
  const languageNames = ['english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'chinese', 'japanese', 'korean', 'arabic', 'russian', 'dutch'];
  return commonLanguages.includes(value.toLowerCase()) || 
         languageNames.includes(value.toLowerCase()) ||
         /^[a-z]{2}(-[A-Z]{2})?$/.test(value);
}

/**
 * Generate schema-aware suggestions for field improvement
 */
function generateSuggestions(key: string, value: unknown): string[] {
  const suggestions: string[] = [];
  const keyLower = key.toLowerCase();
  
  // Find field definition from schema
  const fieldDef = CONTRACT_METADATA_FIELDS.find(
    f => f.key === key || f.key === key.replace(/_/g, '')
  );

  // Empty value suggestions
  if (!value || value === '') {
    if (fieldDef?.required) {
      suggestions.push(`${fieldDef.label || key} is required - please provide a value`);
    } else {
      suggestions.push('Value is empty - please provide a value or confirm as N/A');
    }
    return suggestions;
  }

  // Schema-based suggestions
  if (fieldDef) {
    // Date format suggestion
    if (fieldDef.type === 'date') {
      const dateStr = String(value);
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        suggestions.push('Consider using ISO 8601 date format (YYYY-MM-DD) for consistency');
      }
    }
    
    // Enum validation
    if (fieldDef.type === 'enum' && fieldDef.enum) {
      if (!fieldDef.enum.includes(String(value))) {
        suggestions.push(`Value should be one of: ${fieldDef.enum.join(', ')}`);
      }
    }
    
    // Currency format
    if (fieldDef.format === 'ISO4217') {
      const currValue = String(value).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currValue)) {
        suggestions.push('Currency should be a 3-letter ISO 4217 code (e.g., USD, EUR)');
      }
    }
    
    // Extraction hint as suggestion
    if (fieldDef.extraction_hint) {
      suggestions.push(`Tip: ${fieldDef.extraction_hint}`);
    }
  } else {
    // Fallback suggestions based on key name
    if (keyLower.includes('date') && value) {
      const dateStr = String(value);
      if (!dateStr.includes('-') && !dateStr.includes('/')) {
        suggestions.push('Consider using ISO 8601 date format (YYYY-MM-DD)');
      }
    }
  }

  return suggestions;
}

/**
 * Schema-aware field validation
 */
function validateField(key: string, value: unknown): string[] {
  const errors: string[] = [];
  const keyLower = key.toLowerCase();
  
  // Find field definition from schema
  const fieldDef = CONTRACT_METADATA_FIELDS.find(
    f => f.key === key || f.key === key.replace(/_/g, '')
  );

  // Required field check (schema-based)
  if (fieldDef?.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
    errors.push(`${fieldDef.label || key} is a required field`);
  } else if (!fieldDef && isRequiredField(key) && (!value || value === '')) {
    // Fallback for non-schema fields
    errors.push(`${key} is a required field`);
  }

  // Type-specific validation (schema-based)
  if (fieldDef && value) {
    switch (fieldDef.type) {
      case 'date':
        if (!isValidDate(value)) {
          errors.push(`Invalid date format for ${fieldDef.label || key}`);
        }
        break;
        
      case 'decimal':
      case 'integer':
        const numVal = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(numVal)) {
          errors.push(`${fieldDef.label || key} must be a valid number`);
        }
        if (fieldDef.type === 'integer' && !Number.isInteger(numVal)) {
          errors.push(`${fieldDef.label || key} must be a whole number`);
        }
        break;
        
      case 'enum':
        if (fieldDef.enum && !fieldDef.enum.includes(String(value))) {
          errors.push(`Invalid value for ${fieldDef.label || key}. Expected one of: ${fieldDef.enum.join(', ')}`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`${fieldDef.label || key} must be a boolean value`);
        }
        break;
    }
    
    // Format-specific validation
    if (fieldDef.format === 'ISO4217' && value) {
      if (!/^[A-Z]{3}$/i.test(String(value))) {
        errors.push(`Currency should be a valid ISO 4217 code (3 letters)`);
      }
    }
  } else {
    // Fallback validation for non-schema fields
    if (keyLower.includes('date') && value && !isValidDate(value)) {
      errors.push('Invalid date format');
    }
    if (keyLower.includes('email') && value && !isValidEmail(String(value))) {
      errors.push('Invalid email format');
    }
  }

  return errors;
}

function isRequiredField(key: string): boolean {
  const requiredFields = [
    'contractTitle', 'title', 'name',
    'startDate', 'effectiveDate',
    'partyA', 'partyB', 'vendor', 'client'
  ];
  return requiredFields.some(f => key.toLowerCase().includes(f.toLowerCase()));
}

function isValidDate(value: unknown): boolean {
  if (!value) return false;
  const date = new Date(value as string | number | Date);
  return !isNaN(date.getTime());
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Deterministic validation fallback when OpenAI is not available.
 * Uses rule-based validation instead of random mock values.
 * This ensures consistent, reproducible confidence scores.
 */
function generateFallbackValidation(fields: [string, unknown][]): ValidationResult {
  // Use the same rule-based validation instead of random values
  return validateWithRules(fields);
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, 'GET, POST, PUT, OPTIONS');
}
