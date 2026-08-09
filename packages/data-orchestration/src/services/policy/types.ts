/**
 * Policy engine internal types.
 */

export type PolicySeverity = 'BLOCKER' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type PolicyRuleKind = 'FIELD' | 'PATTERN' | 'SEMANTIC';
export type PolicyFindingStatus =
  | 'VIOLATION'
  | 'INCONSISTENCY'
  | 'MISSING'
  | 'INSUFFICIENT_EVIDENCE'
  | 'PASS';
export type PolicyEvaluationStatus =
  | 'PASS'
  | 'PASS_WITH_NOTES'
  | 'REVIEW'
  | 'FAIL'
  | 'INDETERMINATE';
export type PolicyTriggeredBy = 'pipeline' | 'manual' | 'rerun' | 'backfill' | 'dryrun';
export type PolicyMethod = 'field' | 'pattern' | 'semantic';

export interface PolicyEvidence {
  quote: string;
  startOffset?: number;
  endOffset?: number;
  page?: number;
  artifactType?: string;
}

export interface PolicyAppliesTo {
  contractTypes?: string[];
  categoryIds?: string[];
  minValue?: number;
  maxValue?: number;
  currency?: string;
  jurisdictions?: string[];
}

export interface PolicyAssert {
  path: string;
  op: string;
  value?: unknown;
  pathB?: string;
  onMissing?: 'flag' | 'pass' | 'escalate';
}

export interface PolicyMatch {
  mode: 'must_match' | 'must_not_match';
  patterns: string[];
  isRegex?: boolean;
  caseSensitive?: boolean;
}

export interface PolicySemantic {
  question: string;
  expected?: 'yes' | 'no';
}

export interface PolicyRuleDef {
  id: string;
  code: string;
  title: string;
  kind: PolicyRuleKind;
  severity: PolicySeverity;
  category: string;
  appliesTo?: PolicyAppliesTo;
  assert?: PolicyAssert | null;
  match?: PolicyMatch | null;
  semantic?: PolicySemantic | null;
  escalateToSemantic?: boolean;
  remediation?: string | null;
  playbookClauseId?: string | null;
  reference?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PolicyPackDef {
  id: string;
  tenantId: string;
  name: string;
  version: number;
  status: string;
  mode: 'advisory' | 'gate' | string;
  scope?: PolicyAppliesTo;
  scoring?: {
    severityPenalty?: Partial<Record<PolicySeverity, number>>;
  };
  isDefault?: boolean;
  rules: PolicyRuleDef[];
}

export interface FindingDraft {
  ruleId: string;
  ruleCode: string;
  status: PolicyFindingStatus;
  severity: PolicySeverity;
  category: string;
  title: string;
  detail: string;
  evidence: PolicyEvidence[];
  penaltyContribution?: number;
  confidence: number;
  method: PolicyMethod;
  observedValue?: unknown;
  expectedValue?: unknown;
  remediation?: string | null;
  aiDecisionId?: string | null;
  waiverId?: string | null;
  /** When true, field/pattern could not evaluate and may escalate */
  escalate?: boolean;
  /** When true, fact path was missing so this rule does not count as evaluated */
  unevaluated?: boolean;
}

export interface ScoringResult {
  policyScore: number;
  penalty: number;
  status: PolicyEvaluationStatus;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  waivedCount: number;
  needsReviewCount: number;
  findings: FindingDraft[];
  scoringVersion: string;
}

export interface PolicyEvaluationResult {
  evaluationId?: string;
  packId: string;
  packName?: string;
  packVersion: number;
  status: PolicyEvaluationStatus;
  policyScore: number;
  penalty: number;
  applicableRules: number;
  evaluatedRules: number;
  coverage: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  waivedCount: number;
  needsReviewCount: number;
  findings: FindingDraft[];
  inputsHash: string;
  cached?: boolean;
  llmCalls?: number;
  tokensUsed?: number;
  durationMs?: number;
  mode?: string;
  packResolution?: string;
}

export interface EvaluatePolicyPackArgs {
  tenantId: string;
  contractId: string;
  packId?: string;
  triggeredBy?: PolicyTriggeredBy;
  allowSemantic?: boolean;
  dryRun?: boolean;
  /** Injectable prisma client */
  prisma?: any;
  rawTextOverride?: string;
}
