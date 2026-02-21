/**
 * Obligation Tracking Agent
 * Tracks contractual obligations, deliverables, milestones, and payment schedules.
 * Proactively alerts when obligations are at risk of being missed.
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

interface Obligation {
  id: string;
  type: ObligationType;
  description: string;
  dueDate: string | null;
  status: 'pending' | 'at-risk' | 'overdue' | 'completed' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  source: string;
}

type ObligationType =
  | 'payment'
  | 'deliverable'
  | 'milestone'
  | 'notice'
  | 'renewal-action'
  | 'reporting'
  | 'insurance'
  | 'audit';

interface ObligationReport {
  totalObligations: number;
  upcoming: Obligation[];
  atRisk: Obligation[];
  overdue: Obligation[];
  summary: string;
  assessedAt: string;
}

// --------------------------------------------------------------------------
// Obligation extraction heuristics
// --------------------------------------------------------------------------

function extractObligationsFromContext(
  contractId: string,
  ctx: Record<string, any>,
): Obligation[] {
  const obligations: Obligation[] = [];
  const now = new Date();
  let counter = 0;
  const mkId = () => `obl-${contractId.slice(0, 8)}-${++counter}`;

  // 1. Expiration / renewal obligation
  const expDate = ctx.expirationDate;
  if (expDate) {
    const exp = new Date(expDate);
    const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const status =
      daysUntil < 0 ? 'overdue'
        : daysUntil <= 30 ? 'at-risk'
        : 'pending';
    obligations.push({
      id: mkId(),
      type: 'renewal-action',
      description: ctx.autoRenewalEnabled
        ? `Review auto-renewal before ${expDate} (${daysUntil} days)`
        : `Contract expires ${expDate} — initiate renewal or termination`,
      dueDate: expDate,
      status,
      severity: daysUntil <= 14 ? 'critical' : daysUntil <= 30 ? 'high' : 'medium',
      owner: ctx.department || 'Contract Owner',
      source: 'Expiration date field',
    });
  }

  // 2. Payment obligations
  const value = Number(ctx.totalValue || ctx.value || ctx.annualValue || 0);
  if (value > 0) {
    const paymentTerms = (ctx.paymentTerms || ctx.contractText || '').toString();
    const isMonthly = /monthly|per\s*month/i.test(paymentTerms);
    const isQuarterly = /quarterly|per\s*quarter/i.test(paymentTerms);
    const schedule = isMonthly ? 'monthly' : isQuarterly ? 'quarterly' : 'as specified';
    obligations.push({
      id: mkId(),
      type: 'payment',
      description: `Payment obligation: $${value.toLocaleString()} (${schedule})`,
      dueDate: null,
      status: 'pending',
      severity: value > 100_000 ? 'high' : 'medium',
      owner: 'Finance / AP',
      source: 'Contract value field',
    });
  }

  // 3. Notice period obligations
  const text = (ctx.contractText || ctx.description || '').toLowerCase();
  const noticeMatch = text.match(/(\d+)\s*(?:day|calendar\s*day|business\s*day)s?\s*(?:prior|advance|written)\s*notice/i);
  if (noticeMatch && expDate) {
    const noticeDays = parseInt(noticeMatch[1], 10);
    const exp = new Date(expDate);
    const noticeDeadline = new Date(exp.getTime() - noticeDays * 86_400_000);
    const daysUntilNotice = Math.ceil((noticeDeadline.getTime() - now.getTime()) / 86_400_000);
    obligations.push({
      id: mkId(),
      type: 'notice',
      description: `${noticeDays}-day advance notice required before ${expDate}`,
      dueDate: noticeDeadline.toISOString().split('T')[0] ?? null,
      status: daysUntilNotice < 0 ? 'overdue' : daysUntilNotice <= 14 ? 'at-risk' : 'pending',
      severity: daysUntilNotice < 0 ? 'critical' : daysUntilNotice <= 14 ? 'high' : 'medium',
      owner: ctx.department || 'Contract Owner',
      source: 'Notice period clause',
    });
  }

  // 4. Insurance / audit obligations
  if (/insurance|certificate.*insurance|proof.*coverage/i.test(text)) {
    obligations.push({
      id: mkId(),
      type: 'insurance',
      description: 'Maintain required insurance coverage per contract terms',
      dueDate: null,
      status: 'pending',
      severity: 'medium',
      owner: 'Risk / Legal',
      source: 'Insurance clause',
    });
  }
  if (/audit\s*right|right.*audit|annual\s*audit/i.test(text)) {
    obligations.push({
      id: mkId(),
      type: 'audit',
      description: 'Periodic audit rights — ensure readiness for audit requests',
      dueDate: null,
      status: 'pending',
      severity: 'low',
      owner: 'Compliance / Finance',
      source: 'Audit clause',
    });
  }

  // 5. Reporting obligations
  if (/report(ing)?\s*(requirement|obligation)|quarterly\s*report|monthly\s*report/i.test(text)) {
    obligations.push({
      id: mkId(),
      type: 'reporting',
      description: 'Periodic reporting obligations per contract terms',
      dueDate: null,
      status: 'pending',
      severity: 'medium',
      owner: ctx.department || 'Operations',
      source: 'Reporting clause',
    });
  }

  return obligations;
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class ObligationTrackingAgent extends BaseAgent {
  name = 'obligation-tracking-agent';
  version = '1.0.0';
  capabilities = ['obligation-tracking', 'deadline-management', 'compliance'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const ctx = {
      ...input.context,
      ...(input.context?.contract || {}),
    };

    logger.info({ contractId: input.contractId }, 'Extracting and tracking obligations');

    const obligations = extractObligationsFromContext(input.contractId, ctx);

    const atRisk = obligations.filter(o => o.status === 'at-risk');
    const overdue = obligations.filter(o => o.status === 'overdue');
    const upcoming = obligations.filter(o => o.status === 'pending');

    const report: ObligationReport = {
      totalObligations: obligations.length,
      upcoming,
      atRisk,
      overdue,
      summary: obligations.length === 0
        ? 'No obligations could be extracted from available data'
        : `Found ${obligations.length} obligation(s): ${overdue.length} overdue, ${atRisk.length} at-risk, ${upcoming.length} pending`,
      assessedAt: new Date().toISOString(),
    };

    // Actions for overdue / at-risk items
    const actions: AgentAction[] = [...overdue, ...atRisk].map((obl, idx) => ({
      id: `obligation-action-${idx}-${Date.now()}`,
      type: 'send-notification' as const,
      description: `${obl.status === 'overdue' ? '🔴 OVERDUE' : '🟡 AT-RISK'}: ${obl.description}`,
      priority: obl.severity === 'critical' ? 'urgent' as const : 'high' as const,
      automated: false,
      targetEntity: { type: 'contract' as const, id: input.contractId },
      payload: { obligation: obl },
      estimatedImpact: 'Prevents missed obligations and contractual penalties',
    }));

    const recommendations: AgentRecommendation[] = overdue.map((obl, idx) => ({
      id: `obligation-rec-${idx}-${Date.now()}`,
      title: `Overdue: ${obl.type}`,
      description: obl.description,
      category: 'risk-mitigation' as const,
      priority: 'critical' as const,
      confidence: 0.9,
      effort: 'low' as const,
      timeframe: 'Immediate',
      actions: [],
      reasoning: `Obligation overdue: ${obl.description}`,
    }));

    return {
      success: true,
      data: report,
      actions,
      recommendations,
      confidence: obligations.length > 0 ? 0.8 : 0.3,
      reasoning: this.formatReasoning([
        `Total obligations found: ${obligations.length}`,
        `Overdue: ${overdue.length}`,
        `At-risk: ${atRisk.length}`,
        `Pending: ${upcoming.length}`,
        ...overdue.map(o => `🔴 OVERDUE: ${o.description}`),
        ...atRisk.map(o => `🟡 AT-RISK: ${o.description}`),
      ]),
      metadata: { processingTime: Date.now() - startTime },
    };
  }

  protected getEventType(): 'obligation_tracked' {
    return 'obligation_tracked';
  }
}

export const obligationTrackingAgent = new ObligationTrackingAgent();
