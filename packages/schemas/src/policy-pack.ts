/**
 * Policy Pack Zod schemas — machine-checkable governance rules for contracts.
 * Validated on authoring (API) and evaluation (engine).
 */

import { z } from 'zod';

export const PolicySeveritySchema = z.enum([
  'BLOCKER',
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  // accept lowercase aliases from authoring UIs
  'blocker',
  'critical',
  'high',
  'medium',
  'low',
]);

export const PolicyRuleKindSchema = z.enum(['FIELD', 'PATTERN', 'SEMANTIC']);

export const PolicyAssertOpSchema = z.enum([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'nin',
  'exists',
  'absent',
  'matches',
  'contains',
  'between',
  'older_than',
  'newer_than',
]);

export const PolicyOnMissingSchema = z.enum(['flag', 'pass', 'escalate']);

export const PolicyAppliesToSchema = z
  .object({
    contractTypes: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    currency: z.string().optional(),
    jurisdictions: z.array(z.string()).optional(),
  })
  .default({});

export const PolicyAssertSchema = z.object({
  path: z.string().min(1),
  op: PolicyAssertOpSchema,
  value: z.unknown().optional(),
  pathB: z.string().optional(),
  onMissing: PolicyOnMissingSchema.default('flag'),
});

export const PolicyMatchSchema = z.object({
  mode: z.enum(['must_match', 'must_not_match']),
  patterns: z.array(z.string().min(1)).min(1),
  isRegex: z.boolean().default(false),
  caseSensitive: z.boolean().default(false),
});

export const PolicySemanticSchema = z.object({
  question: z.string().min(1),
  expected: z.enum(['yes', 'no']).default('yes'),
});

export const PolicyRuleSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'code must be alphanumeric with ._-'),
    title: z.string().min(1).max(500),
    kind: PolicyRuleKindSchema,
    severity: PolicySeveritySchema.default('MEDIUM'),
    category: z.string().min(1),
    appliesTo: PolicyAppliesToSchema.optional(),
    assert: PolicyAssertSchema.optional(),
    match: PolicyMatchSchema.optional(),
    semantic: PolicySemanticSchema.optional(),
    escalateToSemantic: z.boolean().default(false),
    remediation: z.string().optional(),
    playbookClauseId: z.string().optional().nullable(),
    reference: z.string().optional().nullable(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((rule, ctx) => {
    if (rule.kind === 'FIELD' && !rule.assert) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FIELD rules require assert', path: ['assert'] });
    }
    if (rule.kind === 'PATTERN' && !rule.match) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'PATTERN rules require match', path: ['match'] });
    }
    if (rule.kind === 'SEMANTIC' && !rule.semantic) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SEMANTIC rules require semantic', path: ['semantic'] });
    }
  });

export const PolicyPackScoringSchema = z
  .object({
    severityPenalty: z
      .object({
        BLOCKER: z.number().optional(),
        CRITICAL: z.number().optional(),
        HIGH: z.number().optional(),
        MEDIUM: z.number().optional(),
        LOW: z.number().optional(),
      })
      .optional(),
  })
  .default({});

export const PolicyPackCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  mode: z.enum(['advisory', 'gate']).default('advisory'),
  playbookId: z.string().optional().nullable(),
  scope: PolicyAppliesToSchema.optional(),
  scoring: PolicyPackScoringSchema.optional(),
  isDefault: z.boolean().default(false),
  rules: z.array(PolicyRuleSchema).default([]),
});

export const PolicyPackUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  mode: z.enum(['advisory', 'gate']).optional(),
  scope: PolicyAppliesToSchema.optional(),
  scoring: PolicyPackScoringSchema.optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export const PolicyEvidenceSchema = z.object({
  quote: z.string(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  page: z.number().int().optional(),
  artifactType: z.string().optional(),
});

export const PolicyFindingStatusSchema = z.enum([
  'VIOLATION',
  'INCONSISTENCY',
  'MISSING',
  'INSUFFICIENT_EVIDENCE',
  'PASS',
]);

export const PolicyEvaluationStatusSchema = z.enum([
  'PASS',
  'PASS_WITH_NOTES',
  'REVIEW',
  'FAIL',
  'INDETERMINATE',
]);

export type PolicyRuleInput = z.infer<typeof PolicyRuleSchema>;
export type PolicyPackCreateInput = z.infer<typeof PolicyPackCreateSchema>;
export type PolicyPackUpdateInput = z.infer<typeof PolicyPackUpdateSchema>;
export type PolicyAppliesTo = z.infer<typeof PolicyAppliesToSchema>;
export type PolicyAssert = z.infer<typeof PolicyAssertSchema>;
export type PolicyMatch = z.infer<typeof PolicyMatchSchema>;
export type PolicySemantic = z.infer<typeof PolicySemanticSchema>;
export type PolicyEvidence = z.infer<typeof PolicyEvidenceSchema>;
export type PolicyFindingStatus = z.infer<typeof PolicyFindingStatusSchema>;
export type PolicyEvaluationStatus = z.infer<typeof PolicyEvaluationStatusSchema>;

export function normalizeSeverity(severity: string): 'BLOCKER' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const upper = String(severity || 'MEDIUM').toUpperCase();
  if (upper === 'BLOCKER' || upper === 'CRITICAL' || upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper;
  }
  return 'MEDIUM';
}
