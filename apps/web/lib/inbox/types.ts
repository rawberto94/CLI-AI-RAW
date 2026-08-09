/**
 * Unified "Needs you" inbox item contract (Agentic UX Phase 1.4 spike).
 */

export type InboxItemType =
  | 'agent_write'
  | 'agent_goal'
  | 'workflow_approval'
  | 'metadata_review'
  | 'rfx_award'
  | 'compliance_alert'
  | 'renewal_decision'
  | 'policy_violation';

export type InboxRisk = 'critical' | 'high' | 'medium' | 'low';

export type InboxActionKind =
  | 'approve'
  | 'reject'
  | 'modify'
  | 'review'
  | 'acknowledge'
  | 'defer'
  | 'escalate'
  | 'open';

export interface InboxAction {
  kind: InboxActionKind;
  label: string;
  /** For agent_write / agent_goal / rfx — id passed to the corresponding approve API */
  actionId?: string;
}

export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  description?: string | null;
  risk: InboxRisk;
  /** Numeric risk for sorting (higher = more urgent) */
  riskScore: number;
  /** Money / impact value used in risk × value × deadline sort */
  value: number;
  deadline: string | null;
  deepLink: string;
  contractId?: string | null;
  requestedAt: string;
  agentId?: string | null;
  actions: InboxAction[];
  /** Opaque type-specific context for the UI */
  context?: Record<string, unknown>;
}

export const RISK_SCORE: Record<InboxRisk, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

export function priorityToRisk(priority: string | null | undefined): InboxRisk {
  const p = (priority || '').toLowerCase();
  if (p === 'critical' || p === 'urgent') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

/**
 * Sort key: higher risk first, then higher value, then sooner deadline.
 * Items without deadline sort after those with deadlines at the same risk/value.
 */
export function compareInboxItems(a: InboxItem, b: InboxItem): number {
  if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
  if (b.value !== a.value) return b.value - a.value;
  const aDl = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
  const bDl = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
  return aDl - bDl;
}
