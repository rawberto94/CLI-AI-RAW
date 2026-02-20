/**
 * Tool Argument Validation Schemas
 *
 * Zod-based validation for AI tool arguments. Extracted into its own
 * module so it can be independently tested without triggering dynamic
 * imports in the heavier streaming-tools module.
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// =============================================================================
// SHARED PRIMITIVES
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidString = z.string().regex(UUID_REGEX, 'Must be a valid UUID');

export const ALLOWED_UPDATE_FIELDS = [
  'status', 'totalValue', 'effectiveDate', 'expirationDate',
  'supplierName', 'clientName', 'category', 'contractTitle',
] as const;

// =============================================================================
// PER-TOOL SCHEMAS
// =============================================================================

export const toolArgSchemas: Record<string, z.ZodType<Record<string, unknown>>> = {
  search_contracts: z.object({
    query: z.string().min(1).max(500),
    filters: z.record(z.unknown()).optional(),
    limit: z.number().min(1).max(50).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  get_contract_details: z.object({
    contractId: uuidString,
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  create_contract: z.object({
    title: z.string().min(1).max(500),
    supplierName: z.string().max(200).optional(),
    clientName: z.string().max(200).optional(),
    contractType: z.string().max(100).optional(),
    totalValue: z.number().nonnegative().optional(),
    effectiveDate: z.string().optional(),
    expirationDate: z.string().optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  update_contract: z.object({
    contractId: uuidString,
    field: z.enum(ALLOWED_UPDATE_FIELDS),
    value: z.string().min(1).max(1000),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  navigate_to_page: z.object({
    page: z.string().min(1).max(100),
    contractId: uuidString.optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  start_workflow: z.object({
    contractId: uuidString,
    workflowType: z.string().max(100).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  approve_or_reject_step: z.object({
    stepId: uuidString,
    action: z.enum(['approve', 'reject']),
    comment: z.string().max(2000).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  rate_response: z.object({
    messageId: z.string().min(1),
    rating: z.number().min(1).max(5),
    feedback: z.string().max(2000).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,
};

// =============================================================================
// VALIDATION FUNCTION
// =============================================================================

/**
 * Validate tool arguments against schema.
 * Returns sanitized args on success or a human-readable error string.
 */
export function validateToolArgs(
  toolName: string,
  args: Record<string, unknown>,
): { valid: true; args: Record<string, unknown> } | { valid: false; error: string } {
  const schema = toolArgSchemas[toolName];
  if (!schema) return { valid: true, args }; // No schema = passthrough

  const result = schema.safeParse(args);
  if (result.success) return { valid: true, args: result.data };

  const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { valid: false, error: `Invalid arguments: ${issues}` };
}
