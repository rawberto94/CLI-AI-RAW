/**
 * SSE Helpers for AI Chat Stream
 * 
 * Utility functions for summarizing tool results, deduplicating actions,
 * detecting topics, and building tool previews for streaming UI.
 */

import type { ToolResult } from '@/lib/ai/streaming-tools';

/** Detect the general topic of a user query. */
export function detectTopic(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('expir') || q.includes('renew')) return 'renewal';
  if (q.includes('risk') || q.includes('compliance')) return 'risk';
  if (q.includes('spend') || q.includes('value') || q.includes('cost')) return 'financial';
  if (q.includes('supplier') || q.includes('vendor')) return 'supplier';
  if (q.includes('workflow') || q.includes('approv')) return 'workflow';
  if (q.includes('clause') || q.includes('term')) return 'legal';
  return 'general';
}

/** Summarize a tool result into a short human-readable string. */
export function summarizeToolResult(result: ToolResult): string {
  if (!result.success) return `Error: ${result.error}`;
  const d = result.data as Record<string, unknown>;
  if (!d) return 'Done';

  switch (result.toolName) {
    case 'search_contracts':
      return `Found ${d.count || 0} contracts`;
    case 'get_contract_details':
      return `Loaded: ${d.title || 'contract'}`;
    case 'list_expiring_contracts':
      return `${d.count || 0} contracts expiring in ${d.daysAhead || 30} days`;
    case 'get_spend_analysis':
      return `Analyzed ${d.totalContracts || 0} contracts, $${Number(d.totalSpend || 0).toLocaleString()} total`;
    case 'get_risk_assessment': {
      const summary = d.summary as Record<string, number> | undefined;
      return summary ? `${summary.criticalRisks || 0} critical, ${summary.highRisks || 0} high risks` : 'Risk assessed';
    }
    case 'get_supplier_info': {
      const s = d.summary as Record<string, unknown> | undefined;
      return s ? `${s.totalContracts || 0} contracts, $${Number(s.totalSpend || 0).toLocaleString()} spend` : 'Supplier loaded';
    }
    case 'start_workflow':
      return `Started "${d.workflowName}" workflow`;
    case 'list_workflows': {
      const templates = d.templates as unknown[];
      return `${templates?.length || 0} workflow templates`;
    }
    case 'get_pending_approvals':
      return `${d.total || 0} pending approvals`;
    case 'approve_or_reject_step':
      return `${d.decision === 'approve' ? 'Approved' : 'Rejected'}: ${d.step || 'step'}`;
    case 'create_contract':
      return `Created draft: ${d.title || 'contract'}`;
    case 'update_contract':
      return `Updated ${d.field}: ${d.newValue}`;
    case 'navigate_to_page':
      return `Navigate to ${d.page || 'page'}`;
    case 'get_compliance_summary':
      return `Compliance: ${d.complianceScore || 0}%`;
    case 'get_contract_stats':
      return `${d.totalContracts || 0} contracts, $${Number(d.totalValue || 0).toLocaleString()}`;
    case 'get_agent_insights':
      return `${d.totalInsights || 0} agent insights across ${(d.categories as string[])?.length || 0} categories`;
    case 'get_agent_debate': {
      const debate = d.debate as Record<string, unknown> | undefined;
      return debate ? `${(debate.agentsParticipated as string[])?.length || 0} agents debated over ${debate.totalTurns || 0} turns, convergence: ${debate.convergenceScore || 0}%` : 'Debate complete';
    }
    case 'rate_response':
      return `Feedback recorded: ${d.rating}`;
    case 'compare_contracts': {
      const contracts = d.contracts as Record<string, Record<string, unknown>> | undefined;
      return contracts ? `Compared: "${contracts.A?.title}" vs "${contracts.B?.title}"` : 'Comparison complete';
    }
    case 'extract_clauses':
      return `${d.totalClauses || 0} clauses extracted from ${d.contractTitle || 'contract'}`;
    case 'list_obligations': {
      const summary = d.summary as Record<string, unknown> | undefined;
      return `${summary?.total || 0} obligations (${summary?.overdue || 0} overdue, ${summary?.dueSoon || 0} due soon)`;
    }
    default:
      return 'Complete';
  }
}

/** Deduplicate actions by their action string. */
export function deduplicateActions(actions: Array<{ label: string; action: string }>): Array<{ label: string; action: string }> {
  const seen = new Set<string>();
  return actions.filter(a => {
    if (seen.has(a.action)) return false;
    seen.add(a.action);
    return true;
  });
}

/** Build a rich preview from tool results for streaming UI (#9). */
export function buildToolPreview(result: ToolResult): Record<string, unknown> | null {
  const d = result.data as Record<string, unknown>;
  if (!d) return null;

  switch (result.toolName) {
    case 'search_contracts': {
      const contracts = d.contracts as Array<Record<string, unknown>> | undefined;
      if (!contracts || contracts.length === 0) return null;
      return {
        type: 'contract_list',
        items: contracts.slice(0, 3).map(c => ({
          id: c.contractId,
          name: c.contractName,
          supplier: c.supplier,
          score: c.score,
        })),
        totalCount: d.count,
      };
    }
    case 'get_contract_details':
      return {
        type: 'contract_card',
        title: d.title,
        supplier: d.supplier,
        status: d.status,
        value: d.value,
        daysUntilExpiry: d.daysUntilExpiry,
      };
    case 'list_expiring_contracts': {
      const contracts = d.contracts as Array<Record<string, unknown>> | undefined;
      return {
        type: 'expiring_list',
        count: d.count,
        totalValueAtRisk: d.totalValueAtRisk,
        items: (contracts || []).slice(0, 3).map(c => ({
          title: c.title,
          supplier: c.supplier,
          daysUntilExpiry: c.daysUntilExpiry,
          value: c.value,
        })),
      };
    }
    case 'get_agent_insights': {
      const insights = d.insights as Array<Record<string, unknown>> | undefined;
      if (!insights || insights.length === 0) return null;
      return {
        type: 'insights_list',
        count: d.totalInsights,
        topInsights: insights.slice(0, 3).map(i => ({
          severity: i.severity,
          title: i.title,
          source: i.source,
        })),
      };
    }
    case 'get_agent_debate': {
      const debate = d.debate as Record<string, unknown> | undefined;
      if (!debate) return null;
      return {
        type: 'debate_summary',
        totalTurns: debate.totalTurns,
        agentsParticipated: debate.agentsParticipated,
        convergenceScore: debate.convergenceScore,
        consensusReached: d.consensusReached,
      };
    }
    case 'get_pending_approvals':
      return {
        type: 'approvals_count',
        total: d.total,
        urgent: (d.approvals as Array<Record<string, unknown>> | undefined)?.filter(a => {
          const started = a.startedAt as string | undefined;
          return started && (Date.now() - new Date(started).getTime() > 3 * 86400000);
        }).length || 0,
      };
    case 'compare_contracts': {
      const contracts = d.contracts as Record<string, Record<string, unknown>> | undefined;
      const dimensions = d.dimensions as Record<string, Record<string, unknown>> | undefined;
      if (!contracts) return null;
      return {
        type: 'contract_comparison',
        contractA: contracts.A?.title,
        contractB: contracts.B?.title,
        valueDifference: dimensions?.value?.difference,
      };
    }
    case 'extract_clauses': {
      const riskDist = d.riskDistribution as Record<string, number> | undefined;
      return {
        type: 'clause_extraction',
        totalClauses: d.totalClauses,
        categories: d.categories,
        highRisk: riskDist?.high || 0,
      };
    }
    case 'list_obligations': {
      const summary = d.summary as Record<string, unknown> | undefined;
      return {
        type: 'obligations_summary',
        total: summary?.total,
        overdue: summary?.overdue,
        dueSoon: summary?.dueSoon,
      };
    }
    default:
      return null;
  }
}
