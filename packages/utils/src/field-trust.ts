/**
 * Shared field-trust model for backend (extraction auto-apply, agent write gateway)
 * and frontend (confidence heatmap, FieldTrustChip, metadata review).
 *
 * Thresholds MUST stay in lockstep with historical product defaults:
 * - high  0.85 → auto-apply band
 * - medium 0.65 → informational mid band
 * - low   0.4  → review floor (below = do not treat as fact)
 */

export const FIELD_TRUST_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.4,
} as const;

export type FieldTrustThresholdKey = keyof typeof FIELD_TRUST_THRESHOLDS;

/**
 * Trust state for a critical contract field (TCV, parties, dates, renewal, …).
 * UI and APIs should surface this rather than inventing values from alternate stores.
 */
export type FieldTrust =
  | 'canonical_verified' // human-confirmed or audit-passed
  | 'ai_high' // confidence ≥ high threshold, auto-applied
  | 'ai_review' // low..high band, needs human review
  | 'ai_low' // below low threshold — do not present as fact
  | 'conflict' // canonical ≠ derived mirror
  | 'missing' // no value
  | 'pending_agent'; // write-gateway awaiting approval

export type FieldTrustValue<T = unknown> = {
  value: T | null;
  trust: FieldTrust;
  confidence?: number | null;
  evidence?: unknown;
  sourceRunId?: string | null;
};

/** Map a numeric confidence score to a FieldTrust (value present assumed). */
export function trustFromConfidence(confidence: number | null | undefined): FieldTrust {
  if (confidence == null || Number.isNaN(confidence)) return 'missing';
  if (confidence >= FIELD_TRUST_THRESHOLDS.high) return 'ai_high';
  if (confidence >= FIELD_TRUST_THRESHOLDS.low) return 'ai_review';
  return 'ai_low';
}

/** Whether confidence is high enough for automatic application (no HITL). */
export function isAutoApplyConfidence(confidence: number | null | undefined): boolean {
  return typeof confidence === 'number' && confidence >= FIELD_TRUST_THRESHOLDS.high;
}

/** Whether the field should enter a human review queue. */
export function needsHumanReview(confidence: number | null | undefined): boolean {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return true;
  return confidence < FIELD_TRUST_THRESHOLDS.high && confidence >= FIELD_TRUST_THRESHOLDS.low;
}
