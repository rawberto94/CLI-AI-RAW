/**
 * Per-agent autonomy policy (Agentic UX Phase 2.1).
 *
 * Defaults to `review` when no config exists — never silently auto-upgrade.
 * Used by the write gateway (and future goal executor) before creating pending
 * AiDecision rows.
 */

import { FIELD_TRUST_THRESHOLDS } from './field-trust';

export type AutonomyMode = 'suggest' | 'review' | 'auto';

export type AutonomyRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentAutonomyConfigShape {
  tenantId: string;
  agentId: string;
  actionType: string;
  mode: AutonomyMode;
  confidenceThreshold: number;
  costThreshold?: number | null;
  riskThreshold: AutonomyRiskLevel;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
}

export interface AutonomyDecisionInput {
  confidence: number;
  /** Optional estimated cost / contract value impact */
  cost?: number | null;
  /** Optional risk of the proposed action */
  risk?: AutonomyRiskLevel | null;
  config?: AgentAutonomyConfigShape | null;
}

export interface AutonomyDecision {
  /** Whether the write gateway may auto-apply without HITL */
  allowAutoApply: boolean;
  /** Effective mode after defaults */
  mode: AutonomyMode;
  reason: string;
  thresholds: {
    confidence: number;
    cost: number | null;
    risk: AutonomyRiskLevel;
  };
}

const RISK_RANK: Record<AutonomyRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const DEFAULT_AUTONOMY_MODE: AutonomyMode = 'review';
export const DEFAULT_CONFIDENCE_THRESHOLD = FIELD_TRUST_THRESHOLDS.high;
export const DEFAULT_RISK_THRESHOLD: AutonomyRiskLevel = 'medium';

/** Normalize free-form mode strings; unknown → review (safe). */
export function normalizeAutonomyMode(raw: unknown): AutonomyMode {
  if (raw === 'suggest' || raw === 'review' || raw === 'auto') return raw;
  return DEFAULT_AUTONOMY_MODE;
}

export function normalizeRiskLevel(raw: unknown): AutonomyRiskLevel {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'critical') return raw;
  return DEFAULT_RISK_THRESHOLD;
}

/**
 * Decide whether an agent action may be auto-applied.
 *
 * Rules:
 * - Missing config → review (no auto)
 * - mode suggest → never auto (always queue as pending / dry suggestion)
 * - mode review → never auto
 * - mode auto → auto only if confidence ≥ threshold AND cost ≤ costThreshold
 *   (when set) AND risk ≤ riskThreshold
 * - Global kill switch is handled outside this pure function (AGENT_WRITES_ENABLED)
 */
export function evaluateAutonomy(input: AutonomyDecisionInput): AutonomyDecision {
  const confThreshold =
    typeof input.config?.confidenceThreshold === 'number'
      ? input.config.confidenceThreshold
      : DEFAULT_CONFIDENCE_THRESHOLD;
  const costThreshold =
    input.config?.costThreshold != null && Number.isFinite(input.config.costThreshold)
      ? input.config.costThreshold
      : null;
  const riskThreshold = normalizeRiskLevel(input.config?.riskThreshold);
  const mode = input.config
    ? normalizeAutonomyMode(input.config.mode)
    : DEFAULT_AUTONOMY_MODE;

  const thresholds = {
    confidence: confThreshold,
    cost: costThreshold,
    risk: riskThreshold,
  };

  if (mode === 'suggest') {
    return {
      allowAutoApply: false,
      mode,
      reason: 'mode_suggest',
      thresholds,
    };
  }

  if (mode === 'review' || !input.config) {
    return {
      allowAutoApply: false,
      mode: input.config ? mode : DEFAULT_AUTONOMY_MODE,
      reason: input.config ? 'mode_review' : 'no_config_default_review',
      thresholds,
    };
  }

  // mode === 'auto'
  if (typeof input.confidence !== 'number' || Number.isNaN(input.confidence)) {
    return { allowAutoApply: false, mode, reason: 'missing_confidence', thresholds };
  }
  if (input.confidence < confThreshold) {
    return { allowAutoApply: false, mode, reason: 'below_confidence_threshold', thresholds };
  }

  if (costThreshold != null && typeof input.cost === 'number' && input.cost > costThreshold) {
    return { allowAutoApply: false, mode, reason: 'above_cost_threshold', thresholds };
  }

  const actionRisk = normalizeRiskLevel(input.risk ?? 'low');
  if (RISK_RANK[actionRisk] > RISK_RANK[riskThreshold]) {
    return { allowAutoApply: false, mode, reason: 'above_risk_threshold', thresholds };
  }

  return {
    allowAutoApply: true,
    mode,
    reason: 'auto_thresholds_met',
    thresholds,
  };
}

/**
 * Legacy global confidence gate still applies as a floor when mode is auto
 * and config threshold is lower than product default — the more conservative wins.
 */
export function effectiveConfidenceFloor(configThreshold?: number | null): number {
  const configured =
    typeof configThreshold === 'number' && Number.isFinite(configThreshold)
      ? configThreshold
      : DEFAULT_CONFIDENCE_THRESHOLD;
  // Never auto below product low floor
  return Math.max(configured, FIELD_TRUST_THRESHOLDS.low);
}
