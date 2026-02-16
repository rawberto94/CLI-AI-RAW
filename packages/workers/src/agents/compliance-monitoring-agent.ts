/**
 * Compliance Monitoring Agent
 * Monitors contract terms against regulatory requirements and internal policies.
 * Detects compliance gaps, tracks regulatory changes, and recommends remediation.
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  AgentAction,
  AgentRecommendation,
} from './types';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface ComplianceCheck {
  rule: string;
  category: ComplianceCategory;
  status: 'compliant' | 'non-compliant' | 'needs-review' | 'not-applicable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  recommendation?: string;
}

type ComplianceCategory =
  | 'data-privacy'
  | 'financial-regulation'
  | 'labor-law'
  | 'intellectual-property'
  | 'export-control'
  | 'industry-specific'
  | 'internal-policy';

interface ComplianceReport {
  overallScore: number;          // 0-100
  overallStatus: 'compliant' | 'at-risk' | 'non-compliant';
  checks: ComplianceCheck[];
  highPriorityGaps: ComplianceCheck[];
  lastAssessedAt: string;
}

// --------------------------------------------------------------------------
// Compliance rules each contract is checked against
// --------------------------------------------------------------------------

const COMPLIANCE_RULES: Array<{
  rule: string;
  category: ComplianceCategory;
  check: (ctx: Record<string, any>) => ComplianceCheck;
}> = [
  {
    rule: 'Data protection clause present',
    category: 'data-privacy',
    check: (ctx) => {
      const text = (ctx.contractText || ctx.description || '').toLowerCase();
      const hasClause = /data\s*protect|gdpr|ccpa|privacy/i.test(text);
      return {
        rule: 'Data protection clause present',
        category: 'data-privacy',
        status: hasClause ? 'compliant' : 'needs-review',
        severity: 'high',
        details: hasClause
          ? 'Contract contains data protection language'
          : 'No data protection or privacy clause detected — review required',
        recommendation: hasClause ? undefined : 'Add a data processing / privacy clause referencing applicable regulation (GDPR, CCPA)',
      };
    },
  },
  {
    rule: 'Termination for cause clause',
    category: 'internal-policy',
    check: (ctx) => {
      const text = (ctx.contractText || ctx.description || '').toLowerCase();
      const has = /terminat.*for\s*cause|material\s*breach/i.test(text);
      return {
        rule: 'Termination for cause clause',
        category: 'internal-policy',
        status: has ? 'compliant' : 'needs-review',
        severity: 'medium',
        details: has
          ? 'Termination for cause clause found'
          : 'No termination-for-cause clause detected',
        recommendation: has ? undefined : 'Add termination-for-cause provision to protect against material breach',
      };
    },
  },
  {
    rule: 'Limitation of liability',
    category: 'financial-regulation',
    check: (ctx) => {
      const text = (ctx.contractText || ctx.description || '').toLowerCase();
      const has = /limit.*liabil|cap.*liabil|liability.*limit/i.test(text);
      return {
        rule: 'Limitation of liability',
        category: 'financial-regulation',
        status: has ? 'compliant' : 'needs-review',
        severity: 'high',
        details: has
          ? 'Liability limitation clause present'
          : 'No limitation of liability clause detected — financial risk',
        recommendation: has ? undefined : 'Add a liability cap proportional to contract value',
      };
    },
  },
  {
    rule: 'Intellectual property assignment',
    category: 'intellectual-property',
    check: (ctx) => {
      const type = (ctx.contractType || '').toUpperCase();
      if (!['SOW', 'MSA', 'LICENSE'].includes(type)) {
        return {
          rule: 'Intellectual property assignment',
          category: 'intellectual-property',
          status: 'not-applicable',
          severity: 'low',
          details: `IP clause check not applicable for ${type || 'unknown'} contract type`,
        };
      }
      const text = (ctx.contractText || ctx.description || '').toLowerCase();
      const has = /intellect.*property|ip\s*rights|work.?for.?hire|assignment.*rights/i.test(text);
      return {
        rule: 'Intellectual property assignment',
        category: 'intellectual-property',
        status: has ? 'compliant' : 'needs-review',
        severity: 'high',
        details: has
          ? 'IP assignment / rights clause present'
          : 'No IP rights clause detected for SOW/MSA/LICENSE — review required',
        recommendation: has ? undefined : 'Add an IP assignment or licensing clause',
      };
    },
  },
  {
    rule: 'Insurance / indemnification requirement',
    category: 'financial-regulation',
    check: (ctx) => {
      const value = Number(ctx.totalValue || ctx.value || 0);
      if (value < 50_000) {
        return {
          rule: 'Insurance / indemnification requirement',
          category: 'financial-regulation',
          status: 'not-applicable',
          severity: 'low',
          details: 'Insurance clause check waived for low-value contracts',
        };
      }
      const text = (ctx.contractText || ctx.description || '').toLowerCase();
      const has = /indemnif|insurance|hold\s*harmless/i.test(text);
      return {
        rule: 'Insurance / indemnification requirement',
        category: 'financial-regulation',
        status: has ? 'compliant' : 'non-compliant',
        severity: 'high',
        details: has
          ? 'Indemnification / insurance clause present'
          : `High-value contract ($${value.toLocaleString()}) without indemnification`,
        recommendation: has ? undefined : 'Add indemnification clause and require certificate of insurance',
      };
    },
  },
  {
    rule: 'Expiration date set',
    category: 'internal-policy',
    check: (ctx) => {
      const has = !!ctx.expirationDate;
      return {
        rule: 'Expiration date set',
        category: 'internal-policy',
        status: has ? 'compliant' : 'non-compliant',
        severity: 'medium',
        details: has
          ? `Expiration date set: ${ctx.expirationDate}`
          : 'Contract has no expiration date — evergreen risk',
        recommendation: has ? undefined : 'Set an explicit expiration or review date',
      };
    },
  },
  {
    rule: 'Governing law specified',
    category: 'labor-law',
    check: (ctx) => {
      const text = (ctx.contractText || ctx.description || '').toLowerCase();
      const has = /govern.*law|jurisdiction|applicable\s*law|venue/i.test(text);
      return {
        rule: 'Governing law specified',
        category: 'labor-law',
        status: has ? 'compliant' : 'needs-review',
        severity: 'medium',
        details: has
          ? 'Governing law / jurisdiction clause found'
          : 'No governing law clause detected',
        recommendation: has ? undefined : 'Specify governing law and dispute resolution venue',
      };
    },
  },
];

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class ComplianceMonitoringAgent extends BaseAgent {
  name = 'compliance-monitoring-agent';
  version = '1.0.0';
  capabilities = ['compliance', 'risk-monitoring', 'regulatory-check'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const ctx = {
      ...input.context,
      ...(input.context?.contract || {}),
    };

    logger.info({ contractId: input.contractId }, 'Running compliance checks');

    // Run all compliance rules
    const checks = COMPLIANCE_RULES.map(r => r.check(ctx));

    // Score
    const applicableChecks = checks.filter(c => c.status !== 'not-applicable');
    const compliantCount = applicableChecks.filter(c => c.status === 'compliant').length;
    const overallScore = applicableChecks.length > 0
      ? Math.round((compliantCount / applicableChecks.length) * 100)
      : 100;

    const highPriorityGaps = checks.filter(
      c => c.status !== 'compliant' && c.status !== 'not-applicable' && (c.severity === 'high' || c.severity === 'critical'),
    );

    const overallStatus: ComplianceReport['overallStatus'] =
      highPriorityGaps.some(g => g.status === 'non-compliant') ? 'non-compliant'
      : highPriorityGaps.length > 0 ? 'at-risk'
      : 'compliant';

    const report: ComplianceReport = {
      overallScore,
      overallStatus,
      checks,
      highPriorityGaps,
      lastAssessedAt: new Date().toISOString(),
    };

    // Build actions for non-compliant items
    const actions: AgentAction[] = highPriorityGaps.map((gap, idx) => ({
      id: `compliance-action-${idx}-${Date.now()}`,
      type: 'flag-opportunity' as const,
      description: gap.recommendation || `Fix compliance gap: ${gap.rule}`,
      priority: gap.severity === 'critical' ? 'urgent' as const : 'high' as const,
      automated: false,
      targetEntity: { type: 'contract' as const, id: input.contractId },
      payload: { rule: gap.rule, category: gap.category, status: gap.status },
      estimatedImpact: 'Reduces regulatory/policy risk',
    }));

    // Build recommendations
    const recommendations: AgentRecommendation[] = highPriorityGaps.map((gap, idx) => ({
      id: `compliance-rec-${idx}-${Date.now()}`,
      title: gap.rule,
      description: gap.details,
      category: 'compliance' as const,
      priority: gap.severity === 'critical' ? 'critical' as const : 'high' as const,
      confidence: 0.85,
      effort: 'medium' as const,
      timeframe: 'Within 1 week',
      actions: [],
      reasoning: `${gap.rule}: ${gap.status}`,
    }));

    return {
      success: true,
      data: report,
      actions,
      recommendations,
      confidence: 0.85,
      reasoning: this.formatReasoning([
        `Compliance Score: ${overallScore}/100 (${overallStatus})`,
        `Checks performed: ${checks.length}`,
        `Applicable: ${applicableChecks.length}`,
        `Compliant: ${compliantCount}`,
        `High-priority gaps: ${highPriorityGaps.length}`,
        ...highPriorityGaps.map(g => `⚠️  ${g.severity.toUpperCase()}: ${g.rule} — ${g.status}`),
      ]),
      metadata: { processingTime: Date.now() - startTime },
    };
  }

  protected getEventType(): 'compliance_checked' {
    return 'compliance_checked';
  }
}

export const complianceMonitoringAgent = new ComplianceMonitoringAgent();
