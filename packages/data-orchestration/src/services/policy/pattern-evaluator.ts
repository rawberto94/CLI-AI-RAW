/**
 * PATTERN rule evaluator — regex/phrase match over raw text with offsets.
 */

import type { FindingDraft, PolicyEvidence, PolicyRuleDef } from './types';

function normalizeSeverity(s: string): FindingDraft['severity'] {
  const u = String(s || 'MEDIUM').toUpperCase();
  if (u === 'BLOCKER' || u === 'CRITICAL' || u === 'HIGH' || u === 'MEDIUM' || u === 'LOW') return u;
  return 'MEDIUM';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatches(
  text: string,
  pattern: string,
  isRegex: boolean,
  caseSensitive: boolean,
): PolicyEvidence[] {
  const flags = caseSensitive ? 'g' : 'gi';
  let re: RegExp;
  try {
    re = new RegExp(isRegex ? pattern : escapeRegex(pattern), flags);
  } catch {
    return [];
  }
  const evidence: PolicyEvidence[] = [];
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(text)) !== null && guard < 20) {
    guard += 1;
    const quote = m[0];
    evidence.push({
      quote,
      startOffset: m.index,
      endOffset: m.index + quote.length,
    });
    if (!re.global) break;
    if (m[0].length === 0) {
      re.lastIndex += 1;
    }
  }
  return evidence;
}

export function evaluatePatternRules(args: {
  rules: PolicyRuleDef[];
  rawText: string;
}): FindingDraft[] {
  const { rules, rawText } = args;
  const text = rawText || '';
  const findings: FindingDraft[] = [];

  for (const rule of rules) {
    if (rule.kind !== 'PATTERN' || !rule.match) continue;
    const severity = normalizeSeverity(rule.severity);
    const { mode, patterns, isRegex = false, caseSensitive = false } = rule.match;

    const allEvidence: PolicyEvidence[] = [];
    for (const p of patterns) {
      allEvidence.push(...findMatches(text, p, isRegex, caseSensitive));
    }

    const hasMatch = allEvidence.length > 0;

    if (mode === 'must_match') {
      if (hasMatch) {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: 'PASS',
          severity,
          category: rule.category,
          title: rule.title,
          detail: `Required pattern found (${allEvidence.length} match(es))`,
          evidence: allEvidence.slice(0, 5),
          confidence: 1,
          method: 'pattern',
          observedValue: allEvidence[0]?.quote,
          expectedValue: patterns,
          remediation: rule.remediation,
        });
      } else {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: 'MISSING',
          severity,
          category: rule.category,
          title: rule.title,
          detail: `Required pattern(s) not found: ${patterns.join(' | ')}`,
          evidence: [],
          confidence: 1,
          method: 'pattern',
          observedValue: null,
          expectedValue: patterns,
          remediation: rule.remediation,
        });
      }
    } else {
      // must_not_match
      if (hasMatch) {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: 'VIOLATION',
          severity,
          category: rule.category,
          title: rule.title,
          detail: `Forbidden pattern found: "${allEvidence[0]?.quote}"`,
          evidence: allEvidence.slice(0, 5),
          confidence: 1,
          method: 'pattern',
          observedValue: allEvidence[0]?.quote,
          expectedValue: { must_not_match: patterns },
          remediation: rule.remediation,
        });
      } else {
        findings.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          status: 'PASS',
          severity,
          category: rule.category,
          title: rule.title,
          detail: 'Forbidden pattern not present',
          evidence: [],
          confidence: 1,
          method: 'pattern',
          observedValue: null,
          expectedValue: { must_not_match: patterns },
          remediation: rule.remediation,
        });
      }
    }
  }

  return findings;
}

/**
 * Locate a quote in raw text with whitespace normalization; returns offsets or null.
 */
export function locateQuote(rawText: string, quote: string): { startOffset: number; endOffset: number; quote: string } | null {
  if (!quote || !rawText) return null;
  const direct = rawText.indexOf(quote);
  if (direct >= 0) {
    return { startOffset: direct, endOffset: direct + quote.length, quote };
  }
  // Whitespace-normalized search
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const nText = norm(rawText);
  const nQuote = norm(quote);
  if (!nQuote) return null;
  const idx = nText.toLowerCase().indexOf(nQuote.toLowerCase());
  if (idx < 0) return null;
  // Approximate offsets back onto original by scanning
  // Fall back to storing normalized quote without precise offsets
  const rough = rawText.toLowerCase().indexOf(quote.trim().toLowerCase().slice(0, Math.min(40, quote.length)));
  if (rough >= 0) {
    return { startOffset: rough, endOffset: rough + quote.trim().length, quote: quote.trim() };
  }
  return { startOffset: 0, endOffset: 0, quote: nQuote };
}
