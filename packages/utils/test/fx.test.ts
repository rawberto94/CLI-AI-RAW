import { describe, expect, it } from 'vitest';
import { convertCurrency, detectCurrencyFromText, formatMoneyText, resolvePersistCurrency, tryConvertCurrency, UNKNOWN_CURRENCY } from '../src/fx';

describe('convertCurrency', () => {
  it('converts CHF to USD and back', () => {
    const usd = convertCurrency(100, 'CHF', 'USD');
    expect(usd).toBeGreaterThan(100);
    const chf = convertCurrency(usd, 'USD', 'CHF');
    expect(chf).toBeCloseTo(100, 5);
  });

  it('returns the same amount for JPY identity conversion', () => {
    expect(convertCurrency(1234, 'JPY', 'JPY')).toBe(1234);
    expect(convertCurrency(1234, 'jpy', 'JPY')).toBe(1234);
  });

  it('throws on unknown currency instead of silently using 1', () => {
    expect(() => convertCurrency(10, 'XYZ', 'USD')).toThrow(/No FX rate/);
  });

  it('does not invent USD when a currency is missing', () => {
    expect(() => convertCurrency(10, '', 'CHF')).toThrow(/Currency required/);
    expect(() => convertCurrency(10, 'CHF', '')).toThrow(/Currency required/);
  });
});

describe('tryConvertCurrency', () => {
  it('returns null for unknown currency XYZ instead of throwing', () => {
    expect(tryConvertCurrency(10, 'XYZ', 'USD')).toBeNull();
  });

  it('returns null when a currency code is missing', () => {
    expect(tryConvertCurrency(10, '', 'CHF')).toBeNull();
  });

  it('returns the converted amount for known currencies', () => {
    expect(tryConvertCurrency(100, 'CHF', 'USD')).toBe(convertCurrency(100, 'CHF', 'USD'));
  });
});

describe('resolvePersistCurrency', () => {
  it('does not invent USD when the client omitted currency', () => {
    expect(resolvePersistCurrency(undefined, null, '')).toBe(UNKNOWN_CURRENCY);
    expect(resolvePersistCurrency('chf')).toBe('CHF');
  });
});

describe('formatMoneyText', () => {
  it('does not invent USD or CHF when currency is missing', () => {
    expect(formatMoneyText(1200000)).not.toMatch(/USD|CHF|\$/);
    expect(formatMoneyText(1200000, 'XXX')).not.toMatch(/XXX|USD|CHF|\$/);
    expect(formatMoneyText(1200000, 'EUR')).toMatch(/EUR/);
  });
});

describe('detectCurrencyFromText', () => {
  it('detects CHF and does not default a bare amount to USD', () => {
    expect(detectCurrencyFromText("CHF 1'200'000")).toBe('CHF');
    expect(detectCurrencyFromText('Fr. 1400')).toBe('CHF');
    expect(detectCurrencyFromText('€ 50.000')).toBe('EUR');
    expect(detectCurrencyFromText('$1,200,000')).toBe('USD');
    expect(detectCurrencyFromText('1 200 000')).toBeNull();
  });
});

