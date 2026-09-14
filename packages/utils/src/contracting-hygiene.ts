/**
 * Deterministic contracting-hygiene flags. The LLM COMPLIANCE artifact often
 * returns 100% when no named regulation (GDPR/HIPAA/…) applies. Dummy or
 * unenforceable clauses must still be flagged.
 */

export type HygieneIssue = {
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  quote: string;
  rule: string;
};

export type HygieneAssessment = {
  issues: HygieneIssue[];
  /** Upper bound for a compliance % when issues exist. */
  scoreCap: number | null;
  junkDocument: boolean;
};

const JUNK_RE =
  /\blorem ipsum\b|\bplaceholder\b|\[insert\b|\btbd\b|\bsample contract\b|\bdummy (?:text|contract)\b|\basdfg|\bqwerty/i;

const VAGUE_RULE_RE =
  /\b(?:not respecting|non[-\s]?respect(?:ing)? of|does not respect|failure to respect|any infraction|ne pas respecter)\s+(?:a |the |any |une |la )?rules?\b|\bne pas respecter (?:une |la )?règle|\bbei (?:jeder |jederlei )?pflichtverletzung/i;

const FORFEIT_QUOTES_RE =
  /\b(?:give|pay|forfeit|transfer|hand over|cede|donate|surrender|relinquish)\s+(?:up to\s+)?(?:(\d{1,3})\s*%|(\d{1,3})\s*percent|a fifth|one fifth|a quarter|half)\s+of\s+(?:its |the |their )?(?:total |entire |billable )?(?:quotes?|quotations?|revenue|turnover|sales|profits?|company|business|pipeline)\b|\b(?:donnera?|versera?)\s+\d{1,3}\s*%\s+de\s+(?:ses |son )?(?:devis|chiffre|ca)\b|\b\d{1,3}\s*%\s+(?:seiner|ihres)\s+(?:angebote|umsätze|umsatzes)\b/i;

const OVER_100_PCT_RE =
  /\b(1[0-9]{2}|[2-9][0-9]{2})\s*%\s+of\b/i;

const CONTRACT_SIGNAL_RE =
  /\b(?:agreement|vertrag|contrat|contratto|party|partie|parte|shall|haftet|obligation|kündigung|termination|supplier|client|contract|damages|liability)\b/i;

function snippet(text: string, index: number, length = 160): string {
  const start = Math.max(0, index - 20);
  return text.slice(start, start + length).replace(/\s+/g, ' ').trim();
}

export function assessContractingHygiene(text: string): HygieneAssessment {
  const source = text || '';
  const issues: HygieneIssue[] = [];
  const trimmed = source.trim();

  if (trimmed.length > 0 && trimmed.length < 280 && !CONTRACT_SIGNAL_RE.test(trimmed)) {
    issues.push({
      severity: 'medium',
      description: 'Document is too short and lacks contracting language; it cannot be treated as a complete agreement.',
      recommendation: 'Do not treat this as a signed contract until operative terms are present.',
      quote: trimmed.slice(0, 180),
      rule: 'thin-document',
    });
  }

  const junk = source.match(JUNK_RE);
  if (junk?.index != null) {
    issues.push({
      severity: 'high',
      description: 'Placeholder or dummy text is present; compliance cannot be certified.',
      recommendation: 'Replace placeholders with negotiated terms before relying on this document.',
      quote: snippet(source, junk.index),
      rule: 'placeholder',
    });
  }

  const vague = source.match(VAGUE_RULE_RE);
  if (vague?.index != null) {
    issues.push({
      severity: 'high',
      description: 'Penalty or consequence is tied to “not respecting a rule” without identifying the rule, making the clause unenforceable.',
      recommendation: 'Name the specific obligation, breach, and proportionate remedy.',
      quote: snippet(source, vague.index),
      rule: 'vague-rule-breach',
    });
  }

  const forfeit = source.match(FORFEIT_QUOTES_RE);
  if (forfeit?.index != null) {
    const pct = parseInt(forfeit[1] || forfeit[2] || '0', 10);
    const pctLabel = pct > 0 ? `${pct}%` : 'a share';
    issues.push({
      severity: 'high',
      description: `Unenforceable forfeiture of ${pctLabel} of quotes/revenue/company assets as a penalty. This is not a valid liquidated-damages clause.`,
      recommendation: 'Replace with a defined, proportionate contractual remedy (capped damages, service credits, or termination rights).',
      quote: snippet(source, forfeit.index),
      rule: 'unenforceable-forfeiture',
    });
  }

  const over = source.match(OVER_100_PCT_RE);
  if (over?.index != null) {
    issues.push({
      severity: 'high',
      description: `Impossible percentage (${over[1]}%) of a whole cannot be a valid contractual penalty.`,
      recommendation: 'Correct the percentage or define the base amount.',
      quote: snippet(source, over.index),
      rule: 'impossible-percentage',
    });
  }

  const junkDocument = issues.some((issue) => issue.rule === 'placeholder' || issue.rule === 'thin-document');
  let scoreCap: number | null = null;
  if (issues.some((issue) => issue.severity === 'high')) scoreCap = junkDocument ? 20 : 35;
  else if (issues.some((issue) => issue.severity === 'medium')) scoreCap = 55;

  return { issues, scoreCap, junkDocument };
}

export function applyContractingHygieneToCompliance(
  compliance: Record<string, unknown> | null | undefined,
  contractText: string,
): Record<string, unknown> | undefined {
  if (!compliance || typeof compliance !== 'object') return compliance || undefined;
  const hygiene = assessContractingHygiene(contractText);
  if (hygiene.issues.length === 0) return compliance;

  const existingIssues = Array.isArray(compliance.issues) ? [...compliance.issues] : [];
  const existingChecks = Array.isArray(compliance.checks) ? [...compliance.checks] : [];
  const descriptions = new Set(
    existingIssues
      .map((issue) => (issue && typeof issue === 'object' ? String((issue as { description?: unknown }).description || '') : ''))
      .filter(Boolean),
  );

  for (const issue of hygiene.issues) {
    if (descriptions.has(issue.description)) continue;
    existingIssues.push({
      severity: issue.severity,
      description: issue.description,
      recommendation: issue.recommendation,
      source: issue.quote,
      rule: issue.rule,
    });
    existingChecks.push({
      regulation: 'Contracting hygiene',
      name: issue.rule,
      status: 'non-compliant',
      details: issue.description,
      source: issue.quote,
      extractedFromText: true,
    });
  }

  const rawScore = typeof compliance.complianceScore === 'number'
    ? compliance.complianceScore
    : typeof compliance.score === 'number'
      ? compliance.score
      : 100;
  const capped = hygiene.scoreCap == null ? rawScore : Math.min(rawScore, hygiene.scoreCap);

  return {
    ...compliance,
    compliant: false,
    complianceScore: capped,
    score: capped,
    checks: existingChecks,
    issues: existingIssues,
    requiresHumanReview: true,
    hygiene: {
      applied: true,
      scoreCap: hygiene.scoreCap,
      junkDocument: hygiene.junkDocument,
      rules: hygiene.issues.map((issue) => issue.rule),
    },
  };
}
