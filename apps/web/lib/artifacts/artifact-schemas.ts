/**
 * Artifact Data Zod Schemas
 *
 * Type-safe runtime validation for all 10 primary artifact types.
 * Replaces untyped `data: Json` / `data: any` with discriminated unions.
 *
 * Usage:
 *   import { parseArtifactData, ArtifactData } from '@/lib/artifacts/artifact-schemas';
 *   const result = parseArtifactData('OVERVIEW', rawJson); // SafeParseReturnType
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// =============================================================================
// SHARED PRIMITIVES
// =============================================================================

const confidenceField = z.object({
  value: z.union([z.string(), z.number()]),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().optional(),
  reasoning: z.string().optional(),
}).passthrough();

const moneySchema = z.object({
  value: z.number(),
  currency: z.string().default('USD'),
  confidence: z.number().optional(),
  source: z.string().optional(),
  isEstimated: z.boolean().optional(),
}).passthrough();

const partySchema = z.object({
  name: z.string(),
  role: z.string(),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  organization: z.string().optional(),
  company: z.string().optional(),
  state: z.string().optional(),
}).passthrough();

const extractionMetadata = z.object({
  model: z.string().optional(),
  extractionTime: z.string().optional(),
  documentQuality: z.enum(['high', 'medium', 'low']).optional(),
  warningsOrGaps: z.array(z.string()).optional(),
}).passthrough();

// =============================================================================
// ARTIFACT TYPE SCHEMAS
// =============================================================================

/** OVERVIEW — contract summary, parties, dates, value */
export const overviewSchema = z.object({
  contractName: confidenceField.optional(),
  contractType: z.object({
    value: z.string(),
    subType: z.string().optional(),
    confidence: z.number().optional(),
  }).passthrough().optional(),
  parties: z.array(partySchema).optional(),
  effectiveDate: confidenceField.optional(),
  expirationDate: confidenceField.optional(),
  totalValue: moneySchema.optional(),
  executiveSummary: confidenceField.optional(),
  governingLaw: confidenceField.optional(),
  status: z.string().optional(),
  extractionMetadata: extractionMetadata.optional(),
  // Common alternative keys AI may produce
  summary: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

/** CLAUSES — extracted contract clauses */
export const clausesSchema = z.object({
  clauses: z.array(z.object({
    title: z.string().optional(),
    name: z.string().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    text: z.string().optional(),
    fullText: z.string().optional(),
    summary: z.string().optional(),
    section: z.string().optional(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    importance: z.string().optional(),
  }).passthrough()).optional(),
  items: z.array(z.any()).optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** FINANCIAL — payment terms, schedules, fees */
export const financialSchema = z.object({
  totalValue: moneySchema.optional(),
  contractValue: z.number().optional(),
  paymentTerms: z.any().optional(),
  paymentSchedule: z.any().optional(),
  fees: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    frequency: z.string().optional(),
    description: z.string().optional(),
  }).passthrough()).optional(),
  penalties: z.array(z.any()).optional(),
  lineItems: z.array(z.any()).optional(),
  rateCards: z.array(z.any()).optional(),
  financialTerms: z.array(z.any()).optional(),
  currency: z.string().optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** RISK — risk analysis with scoring */
export const riskSchema = z.object({
  overallRiskScore: z.object({
    value: z.number(),
    category: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    confidence: z.number().optional(),
  }).passthrough().optional(),
  risks: z.array(z.object({
    title: z.string().optional(),
    name: z.string().optional(),
    severity: z.string().optional(),
    level: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    mitigation: z.string().optional(),
    recommendation: z.string().optional(),
    likelihood: z.string().optional(),
    impact: z.string().optional(),
  }).passthrough()).optional(),
  items: z.array(z.any()).optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** COMPLIANCE — regulatory compliance analysis */
export const complianceSchema = z.object({
  overallScore: z.number().optional(),
  complianceScore: z.number().optional(),
  status: z.string().optional(),
  frameworks: z.array(z.object({
    name: z.string(),
    compliant: z.boolean().optional(),
    score: z.number().optional(),
    requirements: z.array(z.any()).optional(),
  }).passthrough()).optional(),
  requirements: z.array(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    met: z.boolean().optional(),
  }).passthrough()).optional(),
  gaps: z.array(z.any()).optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** OBLIGATIONS — buyer/seller/mutual obligations */
export const obligationsSchema = z.object({
  buyerObligations: z.array(z.object({
    description: z.string().optional(),
    text: z.string().optional(),
    obligation: z.string().optional(),
    deadline: z.string().optional(),
    dueDate: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
  }).passthrough()).optional(),
  sellerObligations: z.array(z.any()).optional(),
  mutualObligations: z.array(z.any()).optional(),
  obligations: z.array(z.any()).optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** RENEWAL — renewal terms, auto-renewal, notice periods */
export const renewalSchema = z.object({
  autoRenewal: z.boolean().optional(),
  renewalTerms: z.string().optional(),
  noticePeriod: z.string().optional(),
  noticePeriodDays: z.number().optional(),
  renewalDate: z.string().optional(),
  terminationOptions: z.array(z.any()).optional(),
  priceEscalation: z.any().optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** NEGOTIATION_POINTS — negotiation analysis */
export const negotiationPointsSchema = z.object({
  points: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.string().optional(),
    leverage: z.string().optional(),
    recommendation: z.string().optional(),
    currentTerms: z.string().optional(),
    suggestedTerms: z.string().optional(),
    potentialSavings: z.any().optional(),
  }).passthrough()).optional(),
  overallLeverage: z.string().optional(),
  strategy: z.string().optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** AMENDMENTS — contract amendments and modifications */
export const amendmentsSchema = z.object({
  amendments: z.array(z.object({
    title: z.string().optional(),
    date: z.string().optional(),
    description: z.string().optional(),
    effectiveDate: z.string().optional(),
    section: z.string().optional(),
    previousText: z.string().optional(),
    newText: z.string().optional(),
    approvedBy: z.string().optional(),
  }).passthrough()).optional(),
  totalAmendments: z.number().optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** CONTACTS — key contacts and parties */
export const contactsSchema = z.object({
  parties: z.array(partySchema).optional(),
  contacts: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    type: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    organization: z.string().optional(),
    company: z.string().optional(),
  }).passthrough()).optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

/** RATES — rate card / pricing table */
export const ratesSchema = z.object({
  rates: z.array(z.object({
    role: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    rate: z.number().optional(),
    amount: z.number().optional(),
    unit: z.string().optional(),
    period: z.string().optional(),
    currency: z.string().optional(),
  }).passthrough()).optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
  extractionMetadata: extractionMetadata.optional(),
}).passthrough();

// =============================================================================
// SCHEMA MAP & PARSE HELPER
// =============================================================================

const ARTIFACT_SCHEMA_MAP: Record<string, z.ZodType> = {
  OVERVIEW: overviewSchema,
  CLAUSES: clausesSchema,
  FINANCIAL: financialSchema,
  RISK: riskSchema,
  COMPLIANCE: complianceSchema,
  OBLIGATIONS: obligationsSchema,
  RENEWAL: renewalSchema,
  NEGOTIATION_POINTS: negotiationPointsSchema,
  AMENDMENTS: amendmentsSchema,
  CONTACTS: contactsSchema,
  PARTIES: contactsSchema,        // alias
  RATES: ratesSchema,
  PRICING: financialSchema,       // alias
  EXECUTIVE_SUMMARY: overviewSchema,
};

/**
 * Safely parse artifact data with the matching Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 * Unknown types pass-through without validation (so we never break).
 */
export function parseArtifactData(type: string, data: unknown) {
  const schema = ARTIFACT_SCHEMA_MAP[type];
  if (!schema) {
    // Unknown type — pass-through (we won't block new types)
    return { success: true as const, data: data as Record<string, unknown> };
  }
  return schema.safeParse(data);
}

/**
 * Validate artifact data and return typed result (throws on invalid).
 */
export function validateArtifactData<T extends keyof typeof ARTIFACT_SCHEMA_MAP>(
  type: T,
  data: unknown,
): z.infer<(typeof ARTIFACT_SCHEMA_MAP)[T]> {
  const schema = ARTIFACT_SCHEMA_MAP[type];
  if (!schema) return data as any;
  return schema.parse(data);
}

/**
 * Get the schema for a given artifact type (or undefined for unsupported).
 */
export function getArtifactSchema(type: string) {
  return ARTIFACT_SCHEMA_MAP[type];
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type OverviewArtifactData = z.infer<typeof overviewSchema>;
export type ClausesArtifactData = z.infer<typeof clausesSchema>;
export type FinancialArtifactData = z.infer<typeof financialSchema>;
export type RiskArtifactData = z.infer<typeof riskSchema>;
export type ComplianceArtifactData = z.infer<typeof complianceSchema>;
export type ObligationsArtifactData = z.infer<typeof obligationsSchema>;
export type RenewalArtifactData = z.infer<typeof renewalSchema>;
export type NegotiationPointsArtifactData = z.infer<typeof negotiationPointsSchema>;
export type AmendmentsArtifactData = z.infer<typeof amendmentsSchema>;
export type ContactsArtifactData = z.infer<typeof contactsSchema>;
export type RatesArtifactData = z.infer<typeof ratesSchema>;

/** Union of all known artifact data shapes */
export type ArtifactData =
  | OverviewArtifactData
  | ClausesArtifactData
  | FinancialArtifactData
  | RiskArtifactData
  | ComplianceArtifactData
  | ObligationsArtifactData
  | RenewalArtifactData
  | NegotiationPointsArtifactData
  | AmendmentsArtifactData
  | ContactsArtifactData
  | RatesArtifactData;
