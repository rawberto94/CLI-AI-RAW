/**
 * Conflict Resolution Agent — Codename: Mediator ⚖️
 *
 * Detects contradictions and inconsistencies between contract clauses.
 * Analyzes termination vs renewal, liability vs indemnity, jurisdiction
 * conflicts, payment term mismatches, and date inconsistencies.
 *
 * Cluster: guardians | Handle: @mediator
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput, AgentRecommendation } from './types';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

type ConflictSeverity = 'critical' | 'high' | 'medium' | 'low';

interface ConflictItem {
  id: string;
  type: string;
  severity: ConflictSeverity;
  description: string;
  clauseA: string;
  clauseB: string;
  suggestion: string;
  confidence: number;
}

interface ConflictReport {
  conflicts: ConflictItem[];
  summary: string;
  riskScore: number;
  analysedAt: string;
}

// --------------------------------------------------------------------------
// Conflict detection rules
// --------------------------------------------------------------------------

const TERMINATION_PATTERNS = [
  /terminat\w*\s+(?:for\s+)?convenience/gi,
  /either\s+party\s+may\s+terminat/gi,
  /(?:30|60|90)\s*(?:-|\s)?day\s+(?:written\s+)?notice\s+(?:of\s+)?terminat/gi,
  /immediate\s+terminat/gi,
];

const AUTO_RENEWAL_PATTERNS = [
  /auto(?:-|\s)?renew/gi,
  /automatically\s+renew/gi,
  /shall\s+renew\s+(?:for|upon)/gi,
  /successive\s+(?:renewal\s+)?(?:term|period)s?\b/gi,
];

const LIABILITY_CAP_PATTERNS = [
  /(?:aggregate|total|maximum|cumulative)\s+liabilit/gi,
  /liabilit\w*\s+(?:shall\s+)?not\s+exceed/gi,
  /(?:cap|limit)\w*\s+(?:on|of)\s+liabilit/gi,
  /in\s+no\s+event\s+(?:shall|will)\s+.{0,40}liabilit/gi,
];

const INDEMNITY_PATTERNS = [
  /indemnif\w+/gi,
  /hold\s+harmless/gi,
  /unlimited\s+indemnit/gi,
  /full\s+indemnit/gi,
];

const JURISDICTION_PATTERNS = [
  /govern(?:ed|ing)\s+(?:by\s+)?(?:the\s+)?laws?\s+of\s+([A-Z][\w\s,]+)/gi,
  /(?:exclusive\s+)?jurisdiction\s+of\s+(?:the\s+)?courts?\s+(?:of|in)\s+([A-Z][\w\s,]+)/gi,
  /venue\s+(?:shall\s+be|for)\s+(?:in\s+)?([A-Z][\w\s,]+)/gi,
];

const PAYMENT_TERM_PATTERNS = [
  /net\s*(\d+)/gi,
  /within\s+(\d+)\s+(?:calendar\s+)?days/gi,
  /payment\s+(?:is\s+)?due\s+(\d+)/gi,
  /(?:upon|on)\s+(?:receipt|delivery|completion|milestone)/gi,
];

const CONFIDENTIALITY_PATTERNS = [
  /confidential(?:ity)?\s+(?:period|obligation|term)/gi,
  /(?:non-?\s*disclosure|NDA)\s+(?:period|obligation)/gi,
  /(?:\d+)\s+years?\s+(?:after|following|from)\s+(?:terminat|expir)/gi,
  /perpetual\s+confidential/gi,
  /indefinite\s+confidential/gi,
];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function extractMatchingSections(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pat of patterns) {
    // Reset lastIndex for global regexes
    pat.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(text)) !== null) {
      // Grab surrounding context (100 chars each side)
      const start = Math.max(0, m.index - 100);
      const end = Math.min(text.length, m.index + m[0].length + 100);
      results.push(text.slice(start, end).trim());
    }
  }
  return results;
}

function extractJurisdictions(text: string): string[] {
  const jurisdictions: string[] = [];
  for (const pat of JURISDICTION_PATTERNS) {
    pat.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(text)) !== null) {
      const jurisdiction = (m[1] || '').trim().replace(/[.,;]+$/, '');
      if (jurisdiction.length > 2) jurisdictions.push(jurisdiction);
    }
  }
  return [...new Set(jurisdictions)];
}

function extractPaymentDays(text: string): number[] {
  const days: number[] = [];
  for (const pat of PAYMENT_TERM_PATTERNS) {
    pat.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(text)) !== null) {
      if (m[1]) days.push(parseInt(m[1], 10));
    }
  }
  return [...new Set(days)];
}

function severityWeight(s: ConflictSeverity): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s];
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class ConflictResolutionAgent extends BaseAgent {
  name = 'conflict-resolution-agent';
  version = '1.0.0';
  capabilities = ['conflict-resolution', 'validation'] as string[];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const ctx = { ...input.context, ...(input.context?.contract || {}) };
    const text: string = ctx.rawText || ctx.searchableText || ctx.contractText || '';

    logger.info({ contractId: input.contractId }, 'Scanning for clause conflicts');

    if (!text || text.length < 50) {
      return {
        success: true,
        data: { conflicts: [], summary: 'No text available for conflict analysis.', riskScore: 0, analysedAt: new Date().toISOString() },
        confidence: 0.5,
        reasoning: 'Insufficient contract text for meaningful analysis.',
      };
    }

    const conflicts: ConflictItem[] = [];
    let conflictIdx = 0;

    // --- 1. Termination vs Auto-Renewal ---
    const termSections = extractMatchingSections(text, TERMINATION_PATTERNS);
    const renewSections = extractMatchingSections(text, AUTO_RENEWAL_PATTERNS);
    if (termSections.length > 0 && renewSections.length > 0) {
      const hasImmediateTermination = /immediate\s+terminat/i.test(text);
      conflicts.push({
        id: `conflict-${++conflictIdx}`,
        type: 'termination-vs-renewal',
        severity: hasImmediateTermination ? 'critical' : 'high',
        description: 'Contract contains both termination provisions and auto-renewal clauses, which may conflict.',
        clauseA: termSections[0] || '',
        clauseB: renewSections[0] || '',
        suggestion: 'Clarify whether termination for convenience overrides auto-renewal, and specify the opt-out window before renewal.',
        confidence: 0.85,
      });
    }

    // --- 2. Liability Cap vs Indemnity Scope ---
    const liabSections = extractMatchingSections(text, LIABILITY_CAP_PATTERNS);
    const indSections = extractMatchingSections(text, INDEMNITY_PATTERNS);
    if (liabSections.length > 0 && indSections.length > 0) {
      const hasUnlimited = /unlimited\s+indemnit|full\s+indemnit/i.test(text);
      conflicts.push({
        id: `conflict-${++conflictIdx}`,
        type: 'liability-vs-indemnity',
        severity: hasUnlimited ? 'critical' : 'medium',
        description: hasUnlimited
          ? 'Liability is capped but indemnification is unlimited — indemnity claims could exceed the liability cap.'
          : 'Both liability limitations and indemnification obligations exist. Verify indemnity obligations do not override the liability cap.',
        clauseA: liabSections[0] || '',
        clauseB: indSections[0] || '',
        suggestion: 'Specify whether indemnification obligations are subject to the aggregate liability cap, or carve out specific exceptions.',
        confidence: hasUnlimited ? 0.9 : 0.7,
      });
    }

    // --- 3. Jurisdiction Conflicts ---
    const jurisdictions = extractJurisdictions(text);
    if (jurisdictions.length > 1) {
      conflicts.push({
        id: `conflict-${++conflictIdx}`,
        type: 'jurisdiction-conflict',
        severity: 'high',
        description: `Multiple jurisdictions referenced: ${jurisdictions.join(', ')}. This creates ambiguity about governing law and dispute resolution venue.`,
        clauseA: `Jurisdiction 1: ${jurisdictions[0]}`,
        clauseB: `Jurisdiction 2: ${jurisdictions[1]}`,
        suggestion: 'Consolidate to a single governing law and specify exclusive jurisdiction for dispute resolution.',
        confidence: 0.8,
      });
    }

    // --- 4. Payment Term Contradictions ---
    const paymentDays = extractPaymentDays(text);
    if (paymentDays.length > 1) {
      const sorted = [...paymentDays].sort((a, b) => a - b);
      if (sorted[sorted.length - 1]! - sorted[0]! > 0) {
        conflicts.push({
          id: `conflict-${++conflictIdx}`,
          type: 'payment-term-mismatch',
          severity: 'medium',
          description: `Multiple payment terms detected: ${sorted.map(d => `Net ${d}`).join(', ')}. Inconsistent payment periods create billing disputes.`,
          clauseA: `Payment term: Net ${sorted[0]}`,
          clauseB: `Payment term: Net ${sorted[sorted.length - 1]}`,
          suggestion: 'Standardise to a single payment term, or clarify which term applies to which payment type (e.g., milestones vs recurring).',
          confidence: 0.75,
        });
      }
    }

    // --- 5. Confidentiality Scope Conflicts ---
    const confSections = extractMatchingSections(text, CONFIDENTIALITY_PATTERNS);
    const hasPerpetual = /perpetual\s+confidential|indefinite\s+confidential/i.test(text);
    const hasTimedConf = /(\d+)\s+years?\s+(?:after|following|from)\s+(?:terminat|expir)/i.test(text);
    if (hasPerpetual && hasTimedConf) {
      conflicts.push({
        id: `conflict-${++conflictIdx}`,
        type: 'confidentiality-scope',
        severity: 'medium',
        description: 'Contract specifies both perpetual and time-limited confidentiality obligations.',
        clauseA: confSections.find(s => /perpetual|indefinite/i.test(s)) || 'Perpetual clause detected',
        clauseB: confSections.find(s => /\d+\s+years?/i.test(s)) || 'Time-limited clause detected',
        suggestion: 'Clarify which categories of information have perpetual confidentiality (e.g., trade secrets) versus time-limited (e.g., general business information).',
        confidence: 0.8,
      });
    }

    // --- 6. Date Inconsistencies ---
    const effectiveDate = ctx.effectiveDate ? new Date(ctx.effectiveDate) : null;
    const expirationDate = ctx.expirationDate ? new Date(ctx.expirationDate) : null;
    if (effectiveDate && expirationDate && effectiveDate >= expirationDate) {
      conflicts.push({
        id: `conflict-${++conflictIdx}`,
        type: 'date-inconsistency',
        severity: 'critical',
        description: `Effective date (${effectiveDate.toISOString().split('T')[0]}) is on or after expiration date (${expirationDate.toISOString().split('T')[0]}).`,
        clauseA: `Effective: ${effectiveDate.toISOString().split('T')[0]}`,
        clauseB: `Expiration: ${expirationDate.toISOString().split('T')[0]}`,
        suggestion: 'Correct the dates so the effective date precedes the expiration date.',
        confidence: 0.95,
      });
    }

    // --- Build report ---
    const riskScore = conflicts.length > 0
      ? Math.min(1, conflicts.reduce((sum, c) => sum + severityWeight(c.severity) * c.confidence, 0) / 12)
      : 0;

    const report: ConflictReport = {
      conflicts,
      summary: conflicts.length > 0
        ? `Found ${conflicts.length} potential conflict(s): ${conflicts.filter(c => c.severity === 'critical').length} critical, ${conflicts.filter(c => c.severity === 'high').length} high, ${conflicts.filter(c => c.severity === 'medium').length} medium, ${conflicts.filter(c => c.severity === 'low').length} low.`
        : 'No clause conflicts detected.',
      riskScore,
      analysedAt: new Date().toISOString(),
    };

    // --- Recommendations ---
    const recommendations: AgentRecommendation[] = conflicts.map((c, idx) => ({
      id: `conflict-rec-${idx}-${Date.now()}`,
      title: `Resolve: ${c.type.replace(/-/g, ' ')}`,
      description: c.description,
      category: 'risk-mitigation' as const,
      priority: (c.severity === 'critical' || c.severity === 'high' ? 'high' : 'medium') as 'high' | 'medium',
      confidence: c.confidence,
      effort: 'medium' as const,
      timeframe: c.severity === 'critical' ? 'Immediate' : 'Before execution',
      actions: [],
      reasoning: c.suggestion,
    }));

    const confidence = this.calculateConfidence({
      dataQuality: text.length > 1000 ? 0.9 : 0.6,
      modelConfidence: 0.8,
      validationPassed: true,
    });

    return {
      success: true,
      data: report,
      recommendations,
      confidence,
      reasoning: this.formatReasoning([
        `Analysed ${text.length.toLocaleString()} characters of contract text`,
        `Detected ${conflicts.length} potential conflict(s)`,
        `Risk score: ${(riskScore * 100).toFixed(0)}%`,
        ...conflicts.map(c => `⚠️  [${c.severity.toUpperCase()}] ${c.type}: ${c.description.slice(0, 80)}`),
      ]),
      metadata: { conflictCount: conflicts.length, riskScore },
    };
  }

  protected getEventType(): 'conflict_resolved' {
    return 'conflict_resolved';
  }
}

export const conflictResolutionAgent = new ConflictResolutionAgent();
