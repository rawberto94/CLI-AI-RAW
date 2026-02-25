/**
 * Artifact Schema Validation
 * 
 * Validates generated artifact data against expected schemas before saving.
 * Prevents malformed or incomplete artifacts from being persisted.
 */

import { z } from 'zod';

// Base artifact schema — all artifacts must conform to this
const baseArtifactSchema = z.record(z.unknown()).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Artifact data cannot be empty' }
);

// Overview artifact schema
const overviewSchema = z.object({
  summary: z.string().min(10).optional(),
  title: z.string().optional(),
  parties: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
  })).optional(),
  contractType: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  keyTerms: z.array(z.string()).optional(),
}).passthrough();

// Financial artifact schema
const financialSchema = z.object({
  totalValue: z.union([z.number(), z.string(), z.null()]).optional(),
  currency: z.string().optional(),
  paymentTerms: z.union([z.string(), z.array(z.unknown())]).optional(),
  fees: z.array(z.unknown()).optional(),
  penalties: z.array(z.unknown()).optional(),
}).passthrough();

// Risk artifact schema
const riskSchema = z.object({
  overallScore: z.union([z.number(), z.string(), z.null()]).optional(),
  risks: z.array(z.object({
    category: z.string().optional(),
    description: z.string().optional(),
    severity: z.string().optional(),
    likelihood: z.string().optional(),
  }).passthrough()).optional(),
  recommendations: z.array(z.unknown()).optional(),
}).passthrough();

// Compliance artifact schema
const complianceSchema = z.object({
  status: z.string().optional(),
  regulations: z.array(z.unknown()).optional(),
  requirements: z.array(z.unknown()).optional(),
  gaps: z.array(z.unknown()).optional(),
}).passthrough();

// Clauses artifact schema
const clausesSchema = z.object({
  clauses: z.array(z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    type: z.string().optional(),
    section: z.string().optional(),
  }).passthrough()).optional(),
  totalClauses: z.number().optional(),
}).passthrough();

// Map artifact types to their schemas
const ARTIFACT_SCHEMAS: Record<string, z.ZodType> = {
  overview: overviewSchema,
  OVERVIEW: overviewSchema,
  financial: financialSchema,
  FINANCIAL: financialSchema,
  risk: riskSchema,
  RISK: riskSchema,
  compliance: complianceSchema,
  COMPLIANCE: complianceSchema,
  clauses: clausesSchema,
  CLAUSES: clausesSchema,
};

export interface ArtifactValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate artifact data against its expected schema.
 * Returns validation result. Does NOT throw — caller decides whether to reject.
 */
export function validateArtifactData(
  type: string,
  data: Record<string, unknown>
): ArtifactValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Base validation — data must be non-empty object
  const baseResult = baseArtifactSchema.safeParse(data);
  if (!baseResult.success) {
    return {
      valid: false,
      errors: baseResult.error.issues.map((i) => i.message),
      warnings: [],
    };
  }

  // 2. Check minimum data quality (at least some content)
  const jsonStr = JSON.stringify(data);
  if (jsonStr.length < 20) {
    errors.push(`Artifact data too small (${jsonStr.length} bytes)`);
    return { valid: false, errors, warnings };
  }

  // 3. Type-specific schema validation
  const schema = ARTIFACT_SCHEMAS[type];
  if (schema) {
    const result = schema.safeParse(data);
    if (!result.success) {
      // Type schema failures are warnings, not hard errors
      // (AI outputs vary in structure)
      for (const issue of result.error.issues) {
        warnings.push(`${issue.path.join('.')}: ${issue.message}`);
      }
    }
  } else {
    // Unknown artifact type — just pass base validation
    warnings.push(`No specific schema for artifact type '${type}'`);
  }

  // 4. Check for common AI failure patterns
  const stringified = JSON.stringify(data).toLowerCase();
  if (stringified.includes('i cannot') || stringified.includes("i'm unable") || stringified.includes('as an ai')) {
    warnings.push('Artifact may contain AI refusal/disclaimer text');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
