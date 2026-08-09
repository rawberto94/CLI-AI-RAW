import { describe, it, expect } from 'vitest';
import { unwrapVal, stableStringify, emptyFacts, factsHash } from '../facts';

describe('facts helpers', () => {
  it('unwraps SourcedValue', () => {
    expect(unwrapVal({ value: 42, source: 'FINANCIAL', extractedFromText: true })).toBe(42);
    expect(unwrapVal({ value: { value: 'nested', source: 'x' }, source: 'y' })).toBe('nested');
  });

  it('stableStringify is order-independent', () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('factsHash ignores _resolved', () => {
    const f1 = emptyFacts(100);
    f1.financial.totalValue = 1000;
    f1._resolved['financial.totalValue'] = { value: 1000, source: 'x', path: 'financial.totalValue' };
    const f2 = emptyFacts(100);
    f2.financial.totalValue = 1000;
    expect(factsHash(f1)).toBe(factsHash(f2));
  });
});
