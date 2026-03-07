/**
 * Contract API Response Schemas
 * 
 * Zod schemas for validating API responses on the client side.
 * Ensures type safety and catches API inconsistencies early.
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const _nullableDate = z.string().datetime().nullable().optional();

// ============================================================================
// PARTY SCHEMA
// ============================================================================

export const partySchema = z.object({
  legalName: z.string(),
  role: z.string().optional(),
  legalForm: z.string().optional(),
  jurisdiction: z.string().optional(),
  address: z.string().optional(),
  contact: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
});

export type Party = z.infer<typeof partySchema>;

// ============================================================================
// CATEGORY SCHEMA
// ============================================================================

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  path: z.string().optional(),
  parentId: z.string().nullable().optional(),
});

export type Category = z.infer<typeof categorySchema>;

// ============================================================================
// PROCESSING STATUS
// ============================================================================

export const processingSchema = z.object({
  progress: z.number().min(0).max(100),
  currentStage: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export type ProcessingStatus = z.infer<typeof processingSchema>;

// ============================================================================
// EXTRACTED DATA SCHEMAS
// ============================================================================

export const overviewDataSchema = z.object({
  summary: z.string().optional(),
  parties: z.array(partySchema).optional(),
  keyTerms: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  language: z.string().optional(),
  contractType: z.string().optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
}).passthrough();

export const financialDataSchema = z.object({
  totalValue: z.number().optional(),
  currency: z.string().optional(),
  paymentType: z.string().optional(),
  billingFrequency: z.string().optional(),
  periodicity: z.string().optional(),
  description: z.string().optional(),
  rateCards: z.array(z.object({
    role: z.string().optional(),
    rate: z.number().optional(),
    unit: z.string().optional(),
  })).optional(),
}).passthrough();

export const riskDataSchema = z.object({
  overallRisk: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  factors: z.array(z.object({
    name: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string().optional(),
    mitigations: z.array(z.string()).optional(),
  })).optional(),
}).passthrough();

export const complianceDataSchema = z.object({
  isCompliant: z.boolean().optional(),
  regulations: z.array(z.string()).optional(),
  issues: z.array(z.object({
    regulation: z.string(),
    issue: z.string(),
    severity: z.enum(['info', 'warning', 'error']),
  })).optional(),
}).passthrough();

export const extractedDataSchema = z.object({
  overview: overviewDataSchema.optional(),
  financial: financialDataSchema.optional(),
  risk: riskDataSchema.optional(),
  compliance: complianceDataSchema.optional(),
  clauses: z.array(z.object({
    id: z.string().optional(),
    title: z.string(),
    content: z.string(),
    type: z.string().optional(),
    importance: z.enum(['low', 'medium', 'high']).optional(),
  })).optional(),
}).passthrough();

export type ExtractedData = z.infer<typeof extractedDataSchema>;

// ============================================================================
// CONTRACT RESPONSE SCHEMA
// ============================================================================

export const contractResponseSchema = z.object({
  id: z.string(),
  filename: z.string(),
  status: z.string(),
  uploadDate: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  
  // Metadata fields
  document_number: nullableString,
  document_title: nullableString,
  contract_short_description: nullableString,
  jurisdiction: nullableString,
  contract_language: nullableString,
  
  // Parties
  external_parties: z.array(partySchema).nullable().optional(),
  clientName: nullableString,
  supplierName: nullableString,
  
  // Financials
  totalValue: z.union([z.string(), z.number()]).nullable().optional(),
  tcv_amount: nullableNumber,
  tcv_text: nullableString,
  currency: nullableString,
  payment_type: nullableString,
  billing_frequency_type: nullableString,
  periodicity: nullableString,
  
  // Dates
  effectiveDate: nullableString,
  expirationDate: nullableString,
  signature_date: nullableString,
  start_date: nullableString,
  end_date: nullableString,
  termination_date: nullableString,
  
  // Reminders
  reminder_enabled: z.boolean().nullable().optional(),
  reminder_days_before_end: z.number().nullable().optional(),
  notice_period: nullableString,
  
  // Relationships
  category: categorySchema.nullable().optional(),
  aiSuggestedCategory: categorySchema.nullable().optional(),
  parentContractId: nullableString,
  
  // Processing
  processing: processingSchema.optional(),
  
  // AI-extracted data
  extractedData: extractedDataSchema.optional(),
  artifacts: z.array(z.any()).optional(),
  artifactCount: z.number().optional(),
  summary: z.any().optional(),
  insights: z.array(z.any()).optional(),
  
  // Favorites & metadata
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  description: nullableString,
}).passthrough();

export type ContractResponse = z.infer<typeof contractResponseSchema>;

// ============================================================================
// RELATED CONTRACTS SCHEMA
// ============================================================================

export const relatedContractSchema = z.object({
  id: z.string(),
  filename: z.string(),
  status: z.string().optional(),
  category: z.string().optional(),
  clientName: z.string().optional(),
  totalValue: z.number().optional(),
  expirationDate: z.string().optional(),
  relationshipType: z.string().optional(),
});

export type RelatedContract = z.infer<typeof relatedContractSchema>;

export const relatedContractsResponseSchema = z.object({
  contracts: z.array(relatedContractSchema),
  total: z.number(),
});

// ============================================================================
// CONTRACT VERSION SCHEMA
// ============================================================================

export const contractVersionSchema = z.object({
  id: z.string(),
  versionNumber: z.number(),
  summary: z.string().optional(),
  uploadedAt: z.string(),
  uploadedBy: z.string().optional(),
  isActive: z.boolean(),
  fileSize: z.number().optional(),
});

export type ContractVersion = z.infer<typeof contractVersionSchema>;

export const versionsResponseSchema = z.object({
  versions: z.array(contractVersionSchema),
});

// ============================================================================
// SAFE PARSING UTILITIES
// ============================================================================

/**
 * Safely parse contract response with fallback
 */
export function parseContractResponse(data: unknown): ContractResponse | null {
  const result = contractResponseSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Return data as-is for backward compatibility
  return data as ContractResponse;
}

/**
 * Safely parse with strict mode (throws on invalid)
 */
export function parseContractResponseStrict(data: unknown): ContractResponse {
  return contractResponseSchema.parse(data);
}

/**
 * Validate partial contract data
 */
export function validatePartialContract(data: unknown): boolean {
  const result = contractResponseSchema.partial().safeParse(data);
  return result.success;
}
