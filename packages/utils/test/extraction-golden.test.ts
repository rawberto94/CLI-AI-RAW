import { describe, expect, it } from 'vitest';
import { isPrebuiltContractLanguageSupported } from '../src/analysis-language';
import { selectFieldEvidence } from '../src/extraction-evidence';
import {
  mapOverviewToPersistedColumns,
  scorePersistedFields,
  summarizeGoldenRun,
} from '../src/persist-extracted-columns';
import { EXTRACTION_GOLDEN_CASES } from './extraction-golden-cases';

describe('extraction golden set', () => {
  it('covers short/long, scanned/native, DE/FR/IT/EN, amendment, and rate schedule', () => {
    const langs = new Set(EXTRACTION_GOLDEN_CASES.map((c) => c.language));
    const scans = new Set(EXTRACTION_GOLDEN_CASES.map((c) => c.scanType));
    const lengths = new Set(EXTRACTION_GOLDEN_CASES.map((c) => c.length));
    const kinds = new Set(EXTRACTION_GOLDEN_CASES.map((c) => c.kind));
    expect([...langs].sort()).toEqual(['de', 'en', 'fr', 'it']);
    expect(scans.has('native')).toBe(true);
    expect(scans.has('scanned')).toBe(true);
    expect(lengths.has('short')).toBe(true);
    expect(lengths.has('long')).toBe(true);
    expect(kinds.has('amendment')).toBe(true);
    expect(kinds.has('rate_schedule')).toBe(true);
    expect(EXTRACTION_GOLDEN_CASES.length).toBeGreaterThanOrEqual(8);
  });

  it('scores missing separately from incorrect and rejects invented fields', () => {
    const totals = { correct: 0, missing: 0, incorrect: 0, spurious: 0 };
    const failures: string[] = [];

    for (const fixture of EXTRACTION_GOLDEN_CASES) {
      const persisted = mapOverviewToPersistedColumns({
        text: fixture.text,
        locale: fixture.locale || fixture.language,
        contractType: fixture.contractType,
        overview: fixture.overview,
      });
      const score = scorePersistedFields(fixture.expected, persisted);
      totals.correct += score.correct.length;
      totals.missing += score.missing.length;
      totals.incorrect += score.incorrect.length;
      totals.spurious += score.spurious.length;
      if (score.incorrect.length || score.spurious.length || score.missing.length) {
        failures.push(
          `${summarizeGoldenRun(fixture.id, score)} ${JSON.stringify({
            incorrect: score.incorrect,
            spurious: score.spurious,
            missing: score.missing,
          })}`,
        );
      }
    }

    expect({ ...totals, failures }, failures.join('\n')).toMatchObject({
      incorrect: 0,
      spurious: 0,
      missing: 0,
    });
    expect(totals.correct).toBeGreaterThan(0);
  });

  it('keeps tail evidence on the long German document instead of a 12k prefix', () => {
    const longCase = EXTRACTION_GOLDEN_CASES.find((c) => c.id === 'de-long-capped-layout');
    expect(longCase).toBeTruthy();
    const packed = selectFieldEvidence(longCase!.text, [
      { name: 'total_value', hint: 'Gesamtvertragswert' },
    ], { maxChars: 8000 });
    expect(packed.coverage.omitted).toBe(true);
    expect(packed.text).toMatch(/Gesamtvertragswert/);
    expect(packed.text).toMatch(/Unterschriften|IN WITNESS/);
  });

  it('does not select the English-only prebuilt-contract model for DE/FR/IT', () => {
    expect(isPrebuiltContractLanguageSupported('de-CH', [])).toBe(false);
    expect(isPrebuiltContractLanguageSupported('fr-CH', [])).toBe(false);
    expect(isPrebuiltContractLanguageSupported('it-CH', [])).toBe(false);
    expect(isPrebuiltContractLanguageSupported('en-US', ['en'])).toBe(true);
  });

  it('honors human locks on persisted columns', () => {
    const persisted = mapOverviewToPersistedColumns({
      text: 'Total Contract Value: CHF 250000. Effective Date: 2026-04-01.',
      locale: 'en',
      overview: { totalValue: 'CHF 250000', currency: 'CHF', effectiveDate: '2026-04-01' },
      aiMetadata: { tcvSource: 'human', humanLocks: { effectiveDate: true } },
    });
    expect(persisted.totalValue).toBeUndefined();
    expect(persisted.currency).toBeUndefined();
    expect(persisted.effectiveDate).toBeUndefined();
  });
});
