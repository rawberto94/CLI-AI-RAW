import { describe, it, expect } from 'vitest';
import { normalizeCitations, buildCitationHref, formatFieldValue, locateSnippetInText, resolveCitationSpan } from '../citations';

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
    expect(href).toContain('pdf=1');
    expect(href).toContain('tab=details');
  });

  it('keeps the current tab when already on the contract page', () => {
    const href = buildCitationHref(
      { contractId: 'abc', index: 1, snippet: 'liability cap' },
      { pathname: '/contracts/abc', searchParams: 'tab=overview' },
    );
    expect(href).toContain('tab=overview');
    expect(href).toContain('cite=1');
  });

  it('includes the cited PDF page', () => {
    const href = buildCitationHref({
      contractId: 'abc',
      index: 1,
      page: 8,
      snippet: 'liability cap',
    });
    expect(href).toContain('citePage=8');
  });

  it('returns null without contractId', () => {
    expect(buildCitationHref({ index: 1 })).toBeNull();
  });
});

describe('locateSnippetInText', () => {
  const text = 'ARTICLE 8 Limitation of Liability\nSupplier shall not be liable for indirect damages.';

  it('finds an exact quote', () => {
    expect(locateSnippetInText(text, 'Supplier shall not be liable for indirect damages.')).toEqual({
      start: text.indexOf('Supplier'),
      end: text.indexOf('Supplier') + 'Supplier shall not be liable for indirect damages.'.length,
    });
  });

  it('finds a quote when casing differs', () => {
    const located = locateSnippetInText(text, 'supplier shall not be liable for indirect damages.');
    expect(located?.start).toBe(text.indexOf('Supplier'));
  });

  it('returns null for a missing quote', () => {
    expect(locateSnippetInText(text, 'This sentence is not in the contract at all')).toBeNull();
  });

  it('matches curly quotes and OCR hyphenation', () => {
    const ocr = 'The “Total Con-\ntract Value” shall not exceed CHF 1\'200\'000.';
    const located = locateSnippetInText(ocr, 'The "Total Contract Value" shall not exceed CHF 1\'200\'000.');
    expect(located).not.toBeNull();
    expect(ocr.slice(located!.start, located!.end)).toMatch(/Total Con/);
  });
});

describe('resolveCitationSpan', () => {
  const text = 'Preamble. ARTICLE 8 Limitation of Liability. Supplier is capped at twelve months of fees.';

  it('uses offsets when they still contain the quote', () => {
    const start = text.indexOf('Supplier');
    const end = start + 'Supplier is capped at twelve months of fees.'.length;
    const span = resolveCitationSpan(text, {
      startOffset: start,
      endOffset: end,
      snippet: 'Supplier is capped at twelve months of fees.',
    });
    expect(span?.strategy).toBe('offset');
    expect(span?.start).toBe(start);
  });

  it('falls back to snippet search when offsets are stale', () => {
    const span = resolveCitationSpan(text, {
      startOffset: 0,
      endOffset: 8,
      snippet: 'Supplier is capped at twelve months of fees.',
    });
    expect(span?.strategy).toBe('snippet');
    expect(text.slice(span!.start, span!.end)).toMatch(/Supplier is capped/);
  });
});

describe('formatFieldValue', () => {
  it('formats scalars and objects', () => {
    expect(formatFieldValue(null)).toBe('—');
    expect(formatFieldValue('hi')).toBe('hi');
    expect(formatFieldValue(['a', 'b'])).toContain('a');
  });
});
