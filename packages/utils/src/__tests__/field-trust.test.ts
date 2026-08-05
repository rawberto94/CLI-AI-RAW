import { describe, it, expect } from 'vitest';
import {
  FIELD_TRUST_THRESHOLDS,
  trustFromConfidence,
  isAutoApplyConfidence,
  needsHumanReview,
} from '../field-trust';

describe('field-trust', () => {
  it('uses product-standard thresholds', () => {
    expect(FIELD_TRUST_THRESHOLDS.high).toBe(0.85);
    expect(FIELD_TRUST_THRESHOLDS.medium).toBe(0.65);
    expect(FIELD_TRUST_THRESHOLDS.low).toBe(0.4);
  });

  it('maps confidence to trust bands', () => {
    expect(trustFromConfidence(0.9)).toBe('ai_high');
    expect(trustFromConfidence(0.85)).toBe('ai_high');
    expect(trustFromConfidence(0.7)).toBe('ai_review');
    expect(trustFromConfidence(0.4)).toBe('ai_review');
    expect(trustFromConfidence(0.39)).toBe('ai_low');
    expect(trustFromConfidence(null)).toBe('missing');
  });

  it('auto-apply and review helpers', () => {
    expect(isAutoApplyConfidence(0.85)).toBe(true);
    expect(isAutoApplyConfidence(0.84)).toBe(false);
    expect(needsHumanReview(0.7)).toBe(true);
    expect(needsHumanReview(0.9)).toBe(false);
    expect(needsHumanReview(0.2)).toBe(false); // too low — not "review", treat as unusable
  });
});
