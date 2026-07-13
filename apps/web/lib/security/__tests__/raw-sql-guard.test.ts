import { describe, expect, it } from 'vitest';

import { assertReadOnlyAnalysisSql, clampSqlInteger } from '../raw-sql-guard';

describe('raw-sql-guard', () => {
  it('allows SELECT and EXPLAIN queries', () => {
    expect(() => assertReadOnlyAnalysisSql('SELECT 1')).not.toThrow();
    expect(() => assertReadOnlyAnalysisSql('EXPLAIN SELECT 1')).not.toThrow();
  });

  it('rejects destructive or stacked SQL', () => {
    expect(() => assertReadOnlyAnalysisSql('DELETE FROM "Contract"')).toThrow();
    expect(() => assertReadOnlyAnalysisSql('SELECT 1; DROP TABLE "Contract"')).toThrow();
    expect(() => assertReadOnlyAnalysisSql('SELECT 1 -- comment')).toThrow();
  });

  it('clamps SQL integer parameters', () => {
    expect(clampSqlInteger(9999, 10, 400)).toBe(400);
    expect(clampSqlInteger(5.9, 10, 400)).toBe(10);
  });
});