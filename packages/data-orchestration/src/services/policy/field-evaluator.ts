/**
 * FIELD rule evaluator — assertions over ContractFacts.
 */

import type { ContractFacts } from './facts';
import { evaluateOp, getByPath } from './operators';
import type { FindingDraft, PolicyRuleDef } from './types';

function normalizeSeverity(s: string): FindingDraft['severity'] {
  const u = String(s || 'MEDIUM').toUpperCase();
  if (u === 'BLOCKER' || u === 'CRITICAL' || u === 'HIGH' || u === 'MEDIUM' || u === 'LOW') return u;
  return 'MEDIUM';
}

function isResolved(facts: ContractFacts, path: string): boolean {
  if (facts._resolved[path] !== undefined) return true;
  // parent path may still resolve a value
  const v = getByPath(facts, path);
  return v !== undefined && v !== null && v !== '';
}

export function evaluateFieldRules(args: {
  rules: PolicyRuleDef[];
  facts: ContractFacts;
}): FindingDraft[] {
  const { rules, facts } = args;
  const findings: FindingDraft[] = [];

  for (const rule of rules) {
    if (rule.kind !== 'FIELD' || !rule.assert) continue;
    const severity = normalizeSeverity(rule.severity);
    const { path, op, value, pathB, onMissing = 'flag' } = rule.assert;
    const left = getByPath(facts, path);
    const pathBValue = pathB ? getByPath(facts, pathB) : undefined;
    const leftMissing = !isResolved(facts, path) && (left === undefined || left === null || left === '');
    const rightMissing = pathB
      ? !isResolved(facts, pathB) && (pathBValue === undefined || pathBValue === null || pathBValue === '')
      : false;

    if (leftMissing || rightMissing) {
      if (onMissing === 'pass') {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: 'PASS',
          severity,
          category: rule.category,
          title: rule.title,
          detail: `Path ${leftMissing ? path : pathB} missing; onMissing=pass`,
          evidence: [],
          confidence: 1,
          method: 'field',
          observedValue: left ?? null,
          expectedValue: pathB ? pathBValue : value,
          remediation: rule.remediation,
          unevaluated: true,
        });
        continue;
      }
      if (onMissing === 'escalate') {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: 'INSUFFICIENT_EVIDENCE',
          severity,
          category: rule.category,
          title: rule.title,
          detail: `Path missing; escalate to semantic`,
          evidence: [],
          confidence: 0,
          method: 'field',
          observedValue: left ?? null,
          expectedValue: pathB ? pathBValue : value,
          remediation: rule.remediation,
          escalate: true,
          unevaluated: true,
        });
        continue;
      }
      // flag
      findings.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        status: 'MISSING',
        severity,
        category: rule.category,
        title: rule.title,
        detail: `Required fact path missing: ${leftMissing ? path : pathB}`,
        evidence: [],
        confidence: 1,
        method: 'field',
        observedValue: null,
        expectedValue: pathB ? { pathB, value: pathBValue } : value,
        remediation: rule.remediation,
        unevaluated: true,
      });
      continue;
    }

    const result = evaluateOp(op, left, value, { pathBValue });
    if (!result.ok) {
      if ('missing' in result && result.missing) {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: onMissing === 'pass' ? 'PASS' : 'MISSING',
          severity,
          category: rule.category,
          title: rule.title,
          detail: result.detail || 'Value missing for comparison',
          evidence: [],
          confidence: 1,
          method: 'field',
          observedValue: left,
          expectedValue: pathB ? pathBValue : value,
          remediation: rule.remediation,
          escalate: onMissing === 'escalate',
          unevaluated: true,
        });
        continue;
      }
      findings.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        status: 'INSUFFICIENT_EVIDENCE',
        severity,
        category: rule.category,
        title: rule.title,
        detail: ('error' in result && result.error) || 'Operator error',
        evidence: [],
        confidence: 0,
        method: 'field',
        observedValue: left,
        expectedValue: pathB ? pathBValue : value,
        remediation: rule.remediation,
        unevaluated: true,
      });
      continue;
    }

    if (result.pass) {
      findings.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        status: 'PASS',
        severity,
        category: rule.category,
        title: rule.title,
        detail: `Assertion ${path} ${op} passed`,
        evidence: [],
        confidence: 1,
        method: 'field',
        observedValue: left,
        expectedValue: pathB ? pathBValue : value,
        remediation: rule.remediation,
      });
    } else {
      const isConsistency = Boolean(pathB);
      findings.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        status: isConsistency ? 'INCONSISTENCY' : 'VIOLATION',
        severity,
        category: rule.category,
        title: rule.title,
        detail: isConsistency
          ? `Inconsistency: ${path}=${JSON.stringify(left)} ${op} ${pathB}=${JSON.stringify(pathBValue)}`
          : `Violation: ${path}=${JSON.stringify(left)} expected ${op} ${JSON.stringify(value)}`,
        evidence: [],
        confidence: 1,
        method: 'field',
        observedValue: left,
        expectedValue: pathB ? pathBValue : value,
        remediation: rule.remediation,
      });
    }
  }

  return findings;
}
