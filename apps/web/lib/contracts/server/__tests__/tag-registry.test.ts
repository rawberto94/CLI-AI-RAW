import { describe, expect, it } from 'vitest';

import { normalizeTagArray, normalizeTagName } from '../tag-registry';

describe('normalizeTagName', () => {
  it('lowercases and hyphenates whitespace', () => {
    expect(normalizeTagName('High Value')).toBe('high-value');
    expect(normalizeTagName('  MSA Tag  ')).toBe('msa-tag');
    expect(normalizeTagName('already-hyphenated')).toBe('already-hyphenated');
  });

  it('collapses repeated whitespace into a single hyphen', () => {
    expect(normalizeTagName('High   Value  Tag')).toBe('high-value-tag');
  });

  it('returns empty for non-strings', () => {
    expect(normalizeTagName(null)).toBe('');
    expect(normalizeTagName(undefined)).toBe('');
    expect(normalizeTagName(12)).toBe('');
  });
});

describe('normalizeTagArray', () => {
  it('hyphenates, drops empties, and dedupes', () => {
    expect(normalizeTagArray(['High Value', 'high-value', '  ', 'MSA'])).toEqual([
      'high-value',
      'msa',
    ]);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeTagArray('high-value')).toEqual([]);
    expect(normalizeTagArray(null)).toEqual([]);
  });
});
