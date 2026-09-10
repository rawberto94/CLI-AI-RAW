import { describe, expect, it } from 'vitest';
import { clampTrendPercent, formatPercent, normalizePercent } from '../percent';
import { formatPercentage } from '../formatters';

describe('normalizePercent', () => {
  it('treats 0–1 as a fraction', () => {
    expect(normalizePercent(0.856)).toBe(85.6);
    expect(normalizePercent(0.5)).toBe(50);
    expect(normalizePercent(1)).toBe(100);
    expect(normalizePercent(0)).toBe(0);
  });

  it('treats 1–100 as already a percent', () => {
    expect(normalizePercent(85)).toBe(85);
    expect(normalizePercent(100)).toBe(100);
  });

  it('rejects 100000-style values', () => {
    expect(normalizePercent(1000)).toBeNull();
    expect(normalizePercent(100000)).toBeNull();
    expect(normalizePercent(-1)).toBeNull();
  });
});

describe('formatPercent', () => {
  it('formats 0, fractions, and already-percent values', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(85)).toBe('85%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('does not print 100000%', () => {
    expect(formatPercent(1000)).toBe('—');
    expect(formatPercent(100000)).toBe('—');
  });
});

describe('formatPercentage (shared formatter)', () => {
  it('accepts both 0–1 and 0–100 without exploding', () => {
    expect(formatPercentage(1)).toBe('100%');
    expect(formatPercentage(100)).toBe('100%');
    expect(formatPercentage(100000)).toBe('—');
  });
});

describe('clampTrendPercent', () => {
  it('caps wild swings when the previous period is tiny', () => {
    expect(clampTrendPercent(100000, 1)).toBe(100);
    expect(clampTrendPercent(250, 20)).toBe(250);
  });
});
