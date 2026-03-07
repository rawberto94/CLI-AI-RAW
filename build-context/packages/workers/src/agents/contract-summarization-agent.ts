/**
 * Contract Summarization Agent
 * Generates concise, executive-level summaries of contracts.
 * Combines metadata fields with any available text to produce
 * structured summaries with key terms, risk factors, and highlights.
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  AgentRecommendation,
} from './types';
import { logger } from '../utils/logger';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

interface ContractSummary {
  title: string;
  executiveSummary: string;
  keyTerms: KeyTerm[];
  parties: PartyInfo[];
  financials: FinancialSummary;
  timeline: TimelineSummary;
  riskHighlights: string[];
  generatedAt: string;
}

interface KeyTerm {
  label: string;
  value: string;
  importance: 'high' | 'medium' | 'low';
}

interface PartyInfo {
  role: string;
  name: string;
}

interface FinancialSummary {
  totalValue: string;
  annualValue: string;
  paymentTerms: string;
}

interface TimelineSummary {
  effectiveDate: string;
  expirationDate: string;
  durationDays: number | null;
  autoRenews: boolean;
}

// --------------------------------------------------------------------------
// Summary builder
// --------------------------------------------------------------------------

function buildSummary(contractId: string, ctx: Record<string, any>): ContractSummary {
  const title = ctx.contractTitle || ctx.title || 'Untitled Contract';
  const supplier = ctx.supplierName || ctx.counterparty || ctx.vendor || 'Unknown Party';
  const type = ctx.contractType || 'Unknown Type';
  const totalValue = Number(ctx.totalValue || ctx.value || 0);
  const annualValue = Number(ctx.annualValue || 0);
  const effDate = ctx.effectiveDate || null;
  const expDate = ctx.expirationDate || null;
  const autoRenewal = !!ctx.autoRenewalEnabled;
  const department = ctx.department || '';
  const status = ctx.status || '';

  // Calculate duration
  let durationDays: number | null = null;
  if (effDate && expDate) {
    const d1 = new Date(effDate);
    const d2 = new Date(expDate);
    durationDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Build executive summary
  const valuePart = totalValue > 0 ? ` valued at $${totalValue.toLocaleString()}` : '';
  const durationPart = durationDays !== null ? ` spanning ${durationDays} days` : '';
  const renewalPart = autoRenewal ? ' with auto-renewal' : '';
  const deptPart = department ? ` (${department})` : '';
  const executiveSummary =
    `${type} agreement with ${supplier}${valuePart}${durationPart}${renewalPart}${deptPart}. ` +
    `Status: ${status || 'Active'}.`;

  // Key terms
  const keyTerms: KeyTerm[] = [];
  if (totalValue > 0) keyTerms.push({ label: 'Total Value', value: `$${totalValue.toLocaleString()}`, importance: 'high' });
  if (annualValue > 0) keyTerms.push({ label: 'Annual Value', value: `$${annualValue.toLocaleString()}`, importance: 'high' });
  if (type) keyTerms.push({ label: 'Contract Type', value: type, importance: 'medium' });
  if (department) keyTerms.push({ label: 'Department', value: department, importance: 'medium' });
  keyTerms.push({ label: 'Auto-Renewal', value: autoRenewal ? 'Yes' : 'No', importance: autoRenewal ? 'high' : 'low' });

  // Parties
  const parties: PartyInfo[] = [
    { role: 'Organization', name: 'Our Company' },
    { role: 'Counterparty', name: supplier },
  ];

  // Risk highlights
  const riskHighlights: string[] = [];
  const now = new Date();
  if (expDate) {
    const daysToExpiry = Math.ceil((new Date(expDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToExpiry <= 30 && daysToExpiry > 0) riskHighlights.push(`Expires in ${daysToExpiry} days — action required`);
    if (daysToExpiry < 0) riskHighlights.push(`Contract expired ${Math.abs(daysToExpiry)} days ago`);
  } else {
    riskHighlights.push('No expiration date set — evergreen contract risk');
  }
  if (totalValue > 500_000) riskHighlights.push('High-value contract — requires enhanced oversight');
  if (autoRenewal) riskHighlights.push('Auto-renewal enabled — monitor for opt-out deadlines');

  // Text-based risk detection
  const text = (ctx.contractText || ctx.description || '').toLowerCase();
  if (!/limit.*liabil|liability.*limit/i.test(text) && totalValue > 50_000) {
    riskHighlights.push('No limitation of liability clause detected');
  }
  if (!/terminat.*conveni/i.test(text)) {
    riskHighlights.push('Termination for convenience not found');
  }

  return {
    title,
    executiveSummary,
    keyTerms,
    parties,
    financials: {
      totalValue: totalValue > 0 ? `$${totalValue.toLocaleString()}` : 'Not specified',
      annualValue: annualValue > 0 ? `$${annualValue.toLocaleString()}` : 'Not specified',
      paymentTerms: ctx.paymentTerms || 'Not specified',
    },
    timeline: {
      effectiveDate: effDate || 'Not specified',
      expirationDate: expDate || 'Not specified',
      durationDays,
      autoRenews: autoRenewal,
    },
    riskHighlights,
    generatedAt: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// Agent implementation
// --------------------------------------------------------------------------

export class ContractSummarizationAgent extends BaseAgent {
  name = 'contract-summarization-agent';
  version = '1.0.0';
  capabilities = ['summarization', 'analysis', 'reporting'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const ctx = {
      ...input.context,
      ...(input.context?.contract || {}),
    };

    logger.info({ contractId: input.contractId }, 'Generating contract summary');

    const summary = buildSummary(input.contractId, ctx);

    const recommendations: AgentRecommendation[] = summary.riskHighlights.map((risk, idx) => ({
      id: `summary-rec-${idx}-${Date.now()}`,
      title: 'Risk Highlight',
      description: risk,
      category: 'risk-mitigation' as const,
      priority: risk.includes('action required') || risk.includes('expired') ? 'high' as const : 'medium' as const,
      confidence: 0.8,
      effort: 'low' as const,
      timeframe: 'Review promptly',
      actions: [],
      reasoning: `Summary analysis: ${risk}`,
    }));

    return {
      success: true,
      data: summary,
      recommendations,
      confidence: 0.9,
      reasoning: this.formatReasoning([
        `Title: ${summary.title}`,
        `Summary: ${summary.executiveSummary}`,
        `Key terms: ${summary.keyTerms.length}`,
        `Risk highlights: ${summary.riskHighlights.length}`,
        `Duration: ${summary.timeline.durationDays ?? 'N/A'} days`,
        ...summary.riskHighlights.map(r => `⚠️  ${r}`),
      ]),
      metadata: { processingTime: Date.now() - startTime },
    };
  }

  protected getEventType(): 'contract_summarized' {
    return 'contract_summarized';
  }
}

export const contractSummarizationAgent = new ContractSummarizationAgent();
