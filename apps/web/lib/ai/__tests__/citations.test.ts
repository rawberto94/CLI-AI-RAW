import { describe, it, expect } from 'vitest';
import { normalizeCitations, buildCitationHref, formatFieldValue } from '../citations';

describe('normalizeCitations', () => {
  it('normalizes RAGSource-like objects', () => {
    const result = normalizeCitations([
      {
        contractId: 'c1',
        contractName: 'MSA',
        score: 0.82,
        snippet: 'termination for convenience',
        heading: '§12',
        startOffset: 10,
        endOffset: 40,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].contractId).toBe('c1');
    expect(result[0].score).toBeCloseTo(0.82);
    expect(result[0].snippet).toContain('termination');
  });

  it('handles audit Citation shape', () => {
    const result = normalizeCitations([
      { text: 'quoted text', source: 'doc.pdf', page: 3, confidence: 0.9 },
    ]);
    expect(result[0].snippet).toBe('quoted text');
    expect(result[0].score).toBeCloseTo(0.9);
  });

  it('returns empty for null/undefined', () => {
    expect(normalizeCitations(null)).toEqual([]);
    expect(normalizeCitations(undefined)).toEqual([]);
  });
});

describe('buildCitationHref', () => {
  it('builds contract deep link with cite params', () => {
    const href = buildCitationHref({
      contractId: 'abc',
      index: 2,
      heading: 'Liability',
      startOffset: 5,
      endOffset: 20,
      snippet: 'hello world',
    });
    expect(href).toContain('/contracts/abc?');
    expect(href).toContain('cite=1');
    expect(href).toContain('citeIndex=2');
    expect(href).toContain('citeHeading=Liability');
    expect(href).toContain('citeStart=5');
  });

  it('returns null without contractId', () => {
    expect(buildCitationHref({ index: 1 })).toBeNull();
  });
});

describe('formatFieldValue', () => {
  it('formats scalars and objects', () => {
    expect(formatFieldValue(null)).toBe('—');
    expect(formatFieldValue('hi')).toBe('hi');
    expect(formatFieldValue(['a', 'b'])).toContain('a');
  });
});
