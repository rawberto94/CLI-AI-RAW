import { describe, expect, it } from 'vitest';
import { selectFieldEvidence } from '../extraction-evidence';
import { parseNoticePeriodFromClause } from '../contract-extraction';
import { isPrebuiltContractLanguageSupported } from '../analysis-language';
import { isHumanFieldLocked, withHumanLocks } from '../field-trust';

describe('selectFieldEvidence', () => {
  it('returns the full document when it fits', () => {
    const packed = selectFieldEvidence('short contract text', [{ name: 'total_value' }]);
    expect(packed.coverage.omitted).toBe(false);
    expect(packed.text).toBe('short contract text');
  });

  it('keeps tail evidence instead of only a prefix on long documents', () => {
    const head = 'HEAD '.repeat(800);
    const middle = 'MIDDLE noise '.repeat(2000);
    const tail = "TAIL Gesamtvertragswert CHF 1'200'000 signature block";
    const packed = selectFieldEvidence(head + middle + tail, [
      { name: 'total_value', hint: 'Gesamtvertragswert' },
    ], { maxChars: 8000 });
    expect(packed.coverage.omitted).toBe(true);
    expect(packed.text).toContain('HEAD');
    expect(packed.text).toContain('Gesamtvertragswert');
    expect(packed.text).toContain('TAIL');
  });
});

describe('parseNoticePeriodFromClause', () => {
  it('parses a German notice window', () => {
    expect(parseNoticePeriodFromClause('Die Kündigungsfrist beträgt 90 Tagen.')).toBe(90);
  });

  it('does not treat a 24-month term as notice', () => {
    expect(parseNoticePeriodFromClause('The initial term of this Agreement is 24 months from the Effective Date.')).toBeNull();
  });

  it('parses French and Italian notice units next to the keyword', () => {
    expect(parseNoticePeriodFromClause('Préavis de résiliation : 30 jours.')).toBe(30);
    expect(parseNoticePeriodFromClause('Preavviso: 60 giorni.')).toBe(60);
  });

  it('does not take an earlier term length from the same paragraph as notice', () => {
    expect(parseNoticePeriodFromClause('Die Anfangslaufzeit beträgt 24 Monate ab Inkrafttreten. Die Kündigungsfrist beträgt 90 Tagen.')).toBe(90);
  });
});

describe('isPrebuiltContractLanguageSupported', () => {
  it('allows English-only documents', () => {
    expect(isPrebuiltContractLanguageSupported('en-US', ['en'])).toBe(true);
  });

  it('rejects German/French/Italian contracts', () => {
    expect(isPrebuiltContractLanguageSupported('de-CH', [])).toBe(false);
    expect(isPrebuiltContractLanguageSupported('en-US', ['de'])).toBe(false);
  });

  it('does not run the English contract model when language is unknown', () => {
    expect(isPrebuiltContractLanguageSupported(undefined, [])).toBe(false);
  });
});

describe('human field locks', () => {
  it('locks TCV via tcvSource and other fields via humanLocks', () => {
    expect(isHumanFieldLocked({ tcvSource: 'human' }, 'totalValue')).toBe(true);
    const locked = withHumanLocks({}, ['effectiveDate', 'clientName']);
    expect(isHumanFieldLocked(locked, 'effectiveDate')).toBe(true);
    expect(isHumanFieldLocked(locked, 'expirationDate')).toBe(false);
  });
});
