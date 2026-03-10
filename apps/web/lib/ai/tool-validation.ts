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
const CUID_REGEX = /^c[a-z0-9]{24,}$/;
const idString = z.string().refine(
  (val) => UUID_REGEX.test(val) || CUID_REGEX.test(val),
  { message: 'Must be a valid UUID or CUID' },
);

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
    contractId: idString.optional(),
    contractName: z.string().max(500).optional(),
    includeArtifacts: z.boolean().optional(),
  }).passthrough().refine(d => d.contractId || d.contractName, {
    message: 'Either contractId or contractName must be provided',
  }) as z.ZodType<Record<string, unknown>>,

  list_expiring_contracts: z.object({
    days: z.number().min(1).max(365).optional(),
    supplier: z.string().max(200).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  get_supplier_info: z.object({
    supplierName: z.string().min(1).max(200),
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
    contractId: idString,
    field: z.enum(ALLOWED_UPDATE_FIELDS),
    value: z.string().min(1).max(1000),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  navigate_to_page: z.object({
    page: z.string().min(1).max(100),
    contractId: idString.optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  start_workflow: z.object({
    contractId: idString,
    workflowType: z.string().max(100).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  get_workflow_status: z.object({
    executionId: idString.optional(),
    contractId: idString.optional(),
  }).passthrough().refine(d => d.executionId || d.contractId, {
    message: 'Either executionId or contractId must be provided',
  }) as z.ZodType<Record<string, unknown>>,

  create_workflow: z.object({
    name: z.string().min(1).max(200),
    type: z.string().max(100).optional(),
    steps: z.array(z.object({ name: z.string().min(1).max(200), type: z.string().max(100).optional() })).max(20).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  cancel_workflow: z.object({
    executionId: idString,
    reason: z.string().max(2000).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  assign_approver: z.object({
    executionId: idString,
    assignee: z.string().min(1).max(200),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  escalate_workflow: z.object({
    executionId: idString,
    reason: z.string().max(2000).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  suggest_workflow: z.object({
    contractId: idString,
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  approve_or_reject_step: z.object({
    executionId: idString,
    decision: z.enum(['approve', 'reject']),
    comment: z.string().max(2000).optional(),
  }).passthrough() as z.ZodType<Record<string, unknown>>,

  rate_response: z.object({
    rating: z.enum(['positive', 'negative']),
    reason: z.string().max(2000).optional(),
    messageId: z.string().optional(),
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
