/**
 * Pure policy scoring — deterministic, versioned as 'v1'.
 */

import type {
  FindingDraft,
  PolicyEvaluationStatus,
  PolicyPackDef,
  PolicySeverity,
  ScoringResult,
} from './types';

export const SCORING_VERSION = 'v1';

export const DEFAULT_SEVERITY_PENALTY: Record<PolicySeverity, number> = {
  BLOCKER: 100,
  CRITICAL: 30,
  HIGH: 15,
  MEDIUM: 6,
  LOW: 2,
};

export const COVERAGE_THRESHOLD = 0.6;
export const MIN_RAW_TEXT_LENGTH = 1000;
export const SEMANTIC_CONFIDENCE_FLOOR = 0.6;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeSeverity(s: string): PolicySeverity {
  const u = String(s || 'MEDIUM').toUpperCase() as PolicySeverity;
  if (u in DEFAULT_SEVERITY_PENALTY) return u;
  return 'MEDIUM';
}

/**
 * Score findings and compute evaluation status.
 * Mutates finding.penaltyContribution on scoring findings.
 */
export function scoreFindings(args: {
  findings: FindingDraft[];
  applicableRules: number;
  evaluatedRules: number;
  rawTextLength: number;
  pack?: Pick<PolicyPackDef, 'scoring'>;
}): ScoringResult {
  const { findings, applicableRules, evaluatedRules, rawTextLength, pack } = args;
  const coverage = applicableRules > 0 ? evaluatedRules / applicableRules : 0;
  const penalties = {
    ...DEFAULT_SEVERITY_PENALTY,
    ...(pack?.scoring?.severityPenalty || {}),
  };

  let penalty = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let waivedCount = 0;
  let needsReviewCount = 0;
  let hasBlockerOrCritical = false;
  let hasHigh = false;
  let onlyLowOrPass = true;

  const scored: FindingDraft[] = findings.map((f) => {
    const severity = normalizeSeverity(f.severity);
    const out: FindingDraft = { ...f, severity, penaltyContribution: 0 };

    if (f.waiverId) {
      waivedCount += 1;
      return out;
    }

    if (
      f.status === 'INSUFFICIENT_EVIDENCE' ||
      (f.method === 'semantic' && f.confidence < SEMANTIC_CONFIDENCE_FLOOR)
    ) {
      // Low-confidence semantic findings do not score
      if (f.method === 'semantic' && f.confidence < SEMANTIC_CONFIDENCE_FLOOR && f.status !== 'PASS') {
        out.status = 'INSUFFICIENT_EVIDENCE';
      }
      needsReviewCount += 1;
      onlyLowOrPass = false;
      return out;
    }

    if (f.status === 'PASS' || f.unevaluated) {
      return out;
    }

    // VIOLATION | INCONSISTENCY | MISSING
    if (['VIOLATION', 'INCONSISTENCY', 'MISSING'].includes(f.status)) {
      const weight = penalties[severity] ?? DEFAULT_SEVERITY_PENALTY[severity];
      const factor = f.method === 'semantic' ? clamp(f.confidence, 0, 1) : 1;
      const contribution = Math.round(weight * factor);
      out.penaltyContribution = contribution;
      penalty += contribution;

      if (severity === 'BLOCKER' || severity === 'CRITICAL') {
        criticalCount += 1;
        hasBlockerOrCritical = true;
        onlyLowOrPass = false;
      } else if (severity === 'HIGH') {
        highCount += 1;
        hasHigh = true;
        onlyLowOrPass = false;
      } else if (severity === 'MEDIUM') {
        mediumCount += 1;
        onlyLowOrPass = false;
      } else {
        lowCount += 1;
      }
    }

    return out;
  });

  const policyScore = clamp(100 - penalty, 0, 100);

  let status: PolicyEvaluationStatus;
  if (coverage < COVERAGE_THRESHOLD || rawTextLength < MIN_RAW_TEXT_LENGTH) {
    status = 'INDETERMINATE';
  } else if (hasBlockerOrCritical) {
    status = 'FAIL';
  } else if (hasHigh || needsReviewCount > 0) {
    status = 'REVIEW';
  } else if (policyScore >= 85 && onlyLowOrPass && (lowCount > 0 || mediumCount === 0)) {
    // PASS_WITH_NOTES when only LOW findings and high score
    status = lowCount > 0 ? 'PASS_WITH_NOTES' : 'PASS';
  } else if (mediumCount > 0) {
    status = 'REVIEW';
  } else {
    status = 'PASS';
  }

  // Refine PASS_WITH_NOTES: score >= 85 and only LOW findings
  if (
    status !== 'INDETERMINATE' &&
    !hasBlockerOrCritical &&
    !hasHigh &&
    needsReviewCount === 0 &&
    mediumCount === 0 &&
    lowCount > 0 &&
    policyScore >= 85
  ) {
    status = 'PASS_WITH_NOTES';
  }

  return {
    policyScore,
    penalty,
    status,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    waivedCount,
    needsReviewCount,
    findings: scored,
    scoringVersion: SCORING_VERSION,
  };
}
