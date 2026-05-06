import { describe, expect, it } from 'vitest';

import {
  isAzureContentFilteredError,
  normalizeDraftingPrompt,
  normalizeDraftingValue,
  summarizeDraftingPromptForStrictSafety,
} from '@/lib/ai/drafting-safety';

describe('drafting-safety helpers', () => {
  it('normalizes common legal jargon that triggers false positives', () => {
    expect(normalizeDraftingPrompt('NDA for consultancy support with Disclosing Party duties')).toBe(
      'confidentiality agreement for consulting support with sharing party duties',
    );
  });

  it('summarizes a prompt into a neutral strict-retry label', () => {
    expect(summarizeDraftingPromptForStrictSafety('NDA for consultancy support')).toBe(
      'a confidentiality agreement',
    );
  });

  it('normalizes nested prompt values without changing object shape', () => {
    expect(
      normalizeDraftingValue({
        contractType: 'NDA',
        parties: [{ role: 'Disclosing Party' }],
        notes: ['consultancy support'],
      }),
    ).toEqual({
      contractType: 'confidentiality agreement',
      parties: [{ role: 'sharing party' }],
      notes: ['consulting support'],
    });
  });

  it('recognizes Azure content-filter errors', () => {
    expect(isAzureContentFilteredError(new Error('400 content_filter ResponsibleAI policy'))).toBe(true);
    expect(isAzureContentFilteredError(new Error('429 rate limit'))).toBe(false);
  });
});