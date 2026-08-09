import { describe, it, expect } from 'vitest';
import { evaluateOp, getByPath } from '../operators';

describe('policy operators', () => {
  it('eq / ne', () => {
    expect(evaluateOp('eq', 10, 10)).toEqual({ ok: true, pass: true });
    expect(evaluateOp('eq', 10, 11)).toEqual({ ok: true, pass: false });
    expect(evaluateOp('ne', 'a', 'b')).toEqual({ ok: true, pass: true });
  });

  it('lte / gte / lt / gt', () => {
    expect(evaluateOp('lte', 12, 12)).toEqual({ ok: true, pass: true });
    expect(evaluateOp('lt', 11, 12)).toEqual({ ok: true, pass: true });
    expect(evaluateOp('gt', 13, 12)).toEqual({ ok: true, pass: true });
    expect(evaluateOp('gte', 12, 12)).toEqual({ ok: true, pass: true });
  });

  it('in / nin', () => {
    expect(evaluateOp('in', 'CH', ['CH', 'DE'])).toEqual({ ok: true, pass: true });
    expect(evaluateOp('nin', 'FR', ['CH', 'DE'])).toEqual({ ok: true, pass: true });
  });

  it('exists / absent', () => {
    expect(evaluateOp('exists', 'x', undefined)).toEqual({ ok: true, pass: true });
    expect(evaluateOp('exists', null, undefined)).toEqual({ ok: true, pass: false });
    expect(evaluateOp('absent', null, undefined)).toEqual({ ok: true, pass: true });
  });

  it('contains / matches', () => {
    expect(evaluateOp('contains', 'Net 30 days', '30')).toEqual({ ok: true, pass: true });
    expect(evaluateOp('matches', 'Net 45', '^Net\\s+\\d+$')).toEqual({ ok: true, pass: true });
  });

  it('between', () => {
    expect(evaluateOp('between', 50, [0, 100])).toEqual({ ok: true, pass: true });
    expect(evaluateOp('between', 150, [0, 100])).toEqual({ ok: true, pass: false });
  });

  it('missing left returns missing', () => {
    const r = evaluateOp('eq', null, 1);
    expect(r.ok).toBe(false);
    if (!r.ok && 'missing' in r) expect(r.missing).toBe(true);
  });

  it('pathB comparison for consistency', () => {
    const r = evaluateOp('lt', '2020-01-01', undefined, {
      pathBValue: '2021-01-01',
    });
    expect(r).toEqual({ ok: true, pass: true });
  });

  it('getByPath', () => {
    const obj = { financial: { paymentTermsDays: 45, nested: [{ a: 1 }] } };
    expect(getByPath(obj, 'financial.paymentTermsDays')).toBe(45);
    expect(getByPath(obj, 'financial.nested.0.a')).toBe(1);
    expect(getByPath(obj, 'missing.path')).toBeUndefined();
  });
});
