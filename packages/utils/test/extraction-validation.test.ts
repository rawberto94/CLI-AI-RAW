import { describe, expect, it } from 'vitest';
import { applyExtractionValidation, flattenGroundedValue, isDefinitionOnlyQuote } from '../src/extraction-validation';
import { capConfidenceIfUngrounded } from '../src/grounding';
import { needsHumanReviewHighRisk } from '../src/field-trust';

describe('flattenGroundedValue', () => {
  it('unwraps GroundedField and {value,source} objects', () => {
    expect(flattenGroundedValue({ status: 'found', value: '2026-04-01', sourceQuote: 'Inkrafttreten: 01.04.2026' })).toBe('2026-04-01');
    expect(flattenGroundedValue({ value: 1200000, source: 'Gesamtvertragswert' })).toBe(1200000);
    expect(flattenGroundedValue('plain')).toBe('plain');
  });
});

describe('quote grounding on artifacts', () => {
  it('caps ungrounded quotes and flags human review', () => {
    const ocr = 'Der Gesamtvertragswert beträgt CHF 1 200 000. Inkrafttreten: 01.04.2026.';
    const result = applyExtractionValidation(
      {
        OVERVIEW: {
          effectiveDate: '2026-04-01',
          totalValue: 1_200_000,
          certainty: 0.95,
          additionalFindings: [{ field: 'tcv', value: '1.2m', source: 'this quote is not in the document at all xyz' }],
        },
        FINANCIAL: { totalValue: 1_200_000, tcvProvenance: { quote: 'Gesamtvertragswert beträgt CHF 1 200 000' } },
      },
      ocr,
      { locale: 'de', packedText: `[PAGE 1]\n${ocr}` },
    );
    expect(result.ungroundedPaths.length).toBeGreaterThan(0);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.groundedFields.totalValue.grounded).toBe(true);
  });

  it('does not auto-apply ungrounded high-risk fields', () => {
    expect(needsHumanReviewHighRisk({ confidence: 0.95, grounded: false })).toBe(true);
    expect(needsHumanReviewHighRisk({ confidence: 0.95, grounded: true })).toBe(false);
    expect(capConfidenceIfUngrounded(0.95, false)).toBeLessThan(0.6);
  });
});

describe('relative dates', () => {
  it('marks relative dates as definition-adjacent only when they are definitions', () => {
    expect(isDefinitionOnlyQuote('foo', '')).toBe(false);
  });
});
