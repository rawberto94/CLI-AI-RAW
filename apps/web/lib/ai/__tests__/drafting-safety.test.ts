import { describe, expect, it } from 'vitest';

import {
  containsBannedWord,
  isAzureContentFilteredError,
  normalizeDraftingPrompt,
  normalizeDraftingValue,
  summarizeDraftingPromptForStrictSafety,
} from '@/lib/ai/drafting-safety';

describe('drafting-safety helpers', () => {
  it('passes user wording through verbatim (no paternalistic rewrites)', () => {
    expect(normalizeDraftingPrompt('NDA for consultancy support with Disclosing Party duties')).toBe(
      'NDA for consultancy support with Disclosing Party duties',
    );
    // Whitespace is collapsed but words are untouched
    expect(normalizeDraftingPrompt('  body lease   for  Q4  ')).toBe('body lease for Q4');
  });

  it('summarizes a prompt into a neutral category label', () => {
    expect(summarizeDraftingPromptForStrictSafety('NDA for consultancy support')).toBe(
      'a confidentiality agreement',
    );
    expect(summarizeDraftingPromptForStrictSafety('MSA with vendor X')).toBe(
      'a master services agreement',
    );
  });

  it('normalizeDraftingValue is a pass-through and preserves shape and values', () => {
    const input = {
      contractType: 'NDA',
      parties: [{ role: 'Disclosing Party' }],
      notes: ['consultancy support'],
    };
    expect(normalizeDraftingValue(input)).toEqual(input);
  });

  it('recognizes Azure content-filter errors', () => {
    expect(isAzureContentFilteredError(new Error('400 content_filter ResponsibleAI policy'))).toBe(true);
    expect(isAzureContentFilteredError(new Error('429 rate limit'))).toBe(false);
  });

  describe('containsBannedWord', () => {
    it('accepts ordinary B2B requests including industry jargon', () => {
      expect(containsBannedWord('NDA for an RFP in Installation Services').banned).toBe(false);
      expect(containsBannedWord('body lease, kill fee, hit list').banned).toBe(false);
      expect(containsBannedWord('Master Services Agreement with target customer').banned).toBe(false);
    });

    it('rejects an obvious explicit banned term', () => {
      const result = containsBannedWord('Please draft me CSAM distribution terms');
      expect(result.banned).toBe(true);
      if (result.banned) {
        expect(result.reason).toMatch(/cannot draft/i);
      }
    });

    it('handles empty input', () => {
      expect(containsBannedWord('').banned).toBe(false);
    });
  });
});