/**
 * Guards for dynamic raw SQL helpers. Used before $queryRawUnsafe / $executeRawUnsafe
 * when SQL text is assembled outside Prisma tagged templates.
 */

const READ_ONLY_PREFIX = /^(SELECT|WITH)\s/i;
const BLOCKED_SQL_TOKENS = /;|--|\/\*|\*\//;

/** Allow EXPLAIN / SELECT analysis only — blocks injection via stacked statements. */
export function assertReadOnlyAnalysisSql(query: string, context = 'SQL analysis'): void {
  const normalized = query.trim();
  if (!normalized) {
    throw new Error(`${context}: empty query`);
  }
  if (!READ_ONLY_PREFIX.test(normalized) && !/^EXPLAIN\s/i.test(normalized)) {
    throw new Error(`${context}: only SELECT/WITH/EXPLAIN queries are allowed`);
  }
  if (BLOCKED_SQL_TOKENS.test(normalized)) {
    throw new Error(`${context}: multi-statement or commented SQL is not allowed`);
  }
}

/** Clamp integer used in SET LOCAL / session knobs (e.g. hnsw.ef_search). */
export function clampSqlInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('SQL integer parameter must be finite');
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}