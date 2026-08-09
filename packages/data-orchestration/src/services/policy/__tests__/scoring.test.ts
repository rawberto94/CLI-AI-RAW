import { describe, it, expect } from 'vitest';
import { scoreFindings, DEFAULT_SEVERITY_PENALTY } from '../scoring';
import type { FindingDraft } from '../types';

function finding(partial: Partial<FindingDraft> & Pick<FindingDraft, 'ruleCode' | 'status' | 'severity'>): FindingDraft {
  return {
    ruleId: partial.ruleId || 'r1',
    ruleCode: partial.ruleCode,
    status: partial.status,
    severity: partial.severity,
    category: partial.category || 'other',
    title: partial.title || partial.ruleCode,
    detail: partial.detail || '',
    evidence: partial.evidence || [],
    confidence: partial.confidence ?? 1,
    method: partial.method || 'field',
    waiverId: partial.waiverId,
    unevaluated: partial.unevaluated,
  };
}

describe('scoreFindings', () => {
  it('PASS when no violations and good coverage', () => {
    const r = scoreFindings({
      findings: [finding({ ruleCode: 'A', status: 'PASS', severity: 'LOW' })],
      applicableRules: 1,
      evaluatedRules: 1,
      rawTextLength: 5000,
    });
    expect(r.status).toBe('PASS');
    expect(r.policyScore).toBe(100);
  });

  it('FAIL on critical violation', () => {
    const r = scoreFindings({
      findings: [finding({ ruleCode: 'C', status: 'VIOLATION', severity: 'CRITICAL' })],
      applicableRules: 1,
      evaluatedRules: 1,
      rawTextLength: 5000,
    });
    expect(r.status).toBe('FAIL');
    expect(r.policyScore).toBe(100 - DEFAULT_SEVERITY_PENALTY.CRITICAL);
    expect(r.criticalCount).toBe(1);
  });

  it('INDETERMINATE on low coverage', () => {
    const r = scoreFindings({
      findings: [finding({ ruleCode: 'A', status: 'PASS', severity: 'LOW' })],
      applicableRules: 10,
      evaluatedRules: 2,
      rawTextLength: 5000,
    });
    expect(r.status).toBe('INDETERMINATE');
  });

  it('INDETERMINATE on short text', () => {
    const r = scoreFindings({
      findings: [finding({ ruleCode: 'A', status: 'PASS', severity: 'LOW' })],
      applicableRules: 1,
      evaluatedRules: 1,
      rawTextLength: 100,
    });
    expect(r.status).toBe('INDETERMINATE');
  });

  it('waivers zero contribution but record finding', () => {
    const r = scoreFindings({
      findings: [
        finding({
          ruleCode: 'C',
          status: 'VIOLATION',
          severity: 'CRITICAL',
          waiverId: 'w1',
        }),
      ],
      applicableRules: 1,
      evaluatedRules: 1,
      rawTextLength: 5000,
    });
    expect(r.waivedCount).toBe(1);
    expect(r.penalty).toBe(0);
    expect(r.criticalCount).toBe(0);
  });

  it('low-confidence semantic becomes needsReview', () => {
    const r = scoreFindings({
      findings: [
        finding({
          ruleCode: 'S',
          status: 'VIOLATION',
          severity: 'HIGH',
          method: 'semantic',
          confidence: 0.4,
        }),
      ],
      applicableRules: 1,
      evaluatedRules: 1,
      rawTextLength: 5000,
    });
    expect(r.needsReviewCount).toBe(1);
    expect(r.findings[0].status).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.penalty).toBe(0);
  });

  it('PASS_WITH_NOTES for only LOW findings and high score', () => {
    const r = scoreFindings({
      findings: [finding({ ruleCode: 'L', status: 'VIOLATION', severity: 'LOW' })],
      applicableRules: 1,
      evaluatedRules: 1,
      rawTextLength: 5000,
    });
    expect(r.status).toBe('PASS_WITH_NOTES');
    expect(r.policyScore).toBe(100 - DEFAULT_SEVERITY_PENALTY.LOW);
  });
});
