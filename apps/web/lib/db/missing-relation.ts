/**
 * Several admin features are backed by tables that are created by optional SQL
 * migrations rather than the Prisma schema (DLP policies, records management,
 * AI governance). On environments where those migrations have not been applied
 * the raw queries throw Postgres 42P01 ("relation ... does not exist").
 *
 * Treat that as "feature not provisioned here" and let the UI say so, instead of
 * surfacing a 500 that looks like a broken page.
 */
export function isMissingRelationError(error: unknown): boolean {
  if (!error) return false;

  const code = (error as { code?: unknown }).code;
  if (code === '42P01') return true;

  // Prisma wraps driver errors; the raw code is preserved in meta on P2010.
  const metaCode = (error as { meta?: { code?: unknown } }).meta?.code;
  if (metaCode === '42P01') return true;

  const message = error instanceof Error ? error.message : String(error);
  return /relation "[^"]+" does not exist/i.test(message);
}
