import { describe, expect, it } from 'vitest';
import { toDILocale, detectPrevailingLanguage, synonymsForPrompt } from '../src/analysis-language';
import { parseIsoDate } from '../src/contract-extraction';
import { compositeConfidence } from '../src/grounded-field';
import { prefixPages, quoteGrounded } from '../src/grounding';

describe('toDILocale', () => {
  it('maps analysis languages to Swiss DI locales', () => {
    expect(toDILocale('de')).toBe('de-CH');
    expect(toDILocale('fr')).toBe('fr-CH');
    expect(toDILocale('it')).toBe('it-CH');
    expect(toDILocale('en')).toBe('en-US');
  });
});

describe('parseIsoDate locale', () => {
  it('keeps Swiss DD/MM for DE', () => {
    expect(parseIsoDate('01/04/2026', { locale: 'de' })).toBe('2026-04-01');
    expect(parseIsoDate('04.05.2024', { locale: 'de' })).toBe('2024-05-04');
  });

  it('does not guess EN slash dates when both parts are <= 12', () => {
    expect(parseIsoDate('04/05/2024', { locale: 'en' })).toBeNull();
    expect(parseIsoDate('13/01/2026', { locale: 'en' })).toBe('2026-01-13');
  });
});

describe('quoteGrounded', () => {
  it('accepts exact and whitespace-normalized quotes', () => {
    const ocr = 'Der Gesamtvertragswert beträgt CHF 1 200 000.';
    expect(quoteGrounded('Gesamtvertragswert beträgt CHF 1 200 000', ocr).ok).toBe(true);
    expect(quoteGrounded('this quote is not in the document at all', ocr).ok).toBe(false);
  });
});

describe('compositeConfidence', () => {
  it('caps ungrounded-style low quote match', () => {
    const high = compositeConfidence({ model: 0.95, quoteMatch: 1, ocr: 0.9, validation: 1 });
    const ungrounded = compositeConfidence({ model: 0.95, quoteMatch: 0, ocr: 0.9, validation: 0.5 });
    expect(high).toBeGreaterThan(0.85);
    expect(ungrounded).toBeLessThan(0.7);
  });
});

describe('prefixPages', () => {
  it('inserts PAGE markers', () => {
    const text = prefixPages([
      { pageNumber: 1, text: 'Preamble' },
      { pageNumber: 2, text: 'Fees' },
    ]);
    expect(text).toMatch(/\[PAGE 1\]/);
    expect(text).toMatch(/\[PAGE 2\]/);
  });
});

describe('detectPrevailingLanguage', () => {
  it('finds English prevailing clause', () => {
    expect(detectPrevailingLanguage('In case of conflict the English version shall be the prevailing language.')).toBe('en');
  });
});

describe('synonymsForPrompt', () => {
  it('injects German TCV and termination terms', () => {
    const block = synonymsForPrompt('de');
    expect(block).toMatch(/Gesamtvertragswert/);
    expect(block).toMatch(/Kündigung/);
  });
});

describe('selectPagesForExtraction', () => {
  it('keeps English pages when English prevails', async () => {
    const { selectPagesForExtraction } = await import('../src/analysis-language');
    const result = selectPagesForExtraction(
      [
        { pageNumber: 1, text: 'This Agreement is made in English and German. In case of conflict the English version shall be the prevailing language. The parties shall indemnify and the agreement herein pursuant to liability.' },
        { pageNumber: 2, text: 'Dieser Vertrag gilt gemäß den Bestimmungen zwischen den Vertragsparteien. Kündigung, Haftung, Vergütung und Laufzeit.' },
      ],
    );
    expect(result.bilingual).toBe(true);
    expect(result.prevailing).toBe('en');
    expect(result.pages.some((p) => p.pageNumber === 1)).toBe(true);
    expect(result.pages.some((p) => p.pageNumber === 2)).toBe(true);
    expect(result.bilingualWarning).toMatch(/All language pages retained/);
  });
});
