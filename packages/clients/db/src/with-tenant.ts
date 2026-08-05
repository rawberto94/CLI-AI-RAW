/**
 * Transaction-scoped tenant context for Postgres RLS.
 *
 * Uses SET LOCAL so values never leak across pooled connections.
 * Sets both app.tenant_id (canonical) and app.current_tenant (legacy web middleware).
 */

export type TenantTxClient = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
};

export type PrismaLike = {
  $transaction: <T>(
    fn: (tx: TenantTxClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ) => Promise<T>;
};

const SAFE_TENANT = /^[a-zA-Z0-9_-]{1,128}$/;

export function assertSafeTenantId(tenantId: string): void {
  if (!tenantId || tenantId === 'unknown' || !SAFE_TENANT.test(tenantId)) {
    throw new Error(`Invalid tenantId for session context: ${tenantId}`);
  }
}

/**
 * Run `fn` inside a transaction with app.tenant_id / app.current_tenant set via SET LOCAL.
 */
export async function withTenant<T>(
  prisma: PrismaLike,
  tenantId: string,
  fn: (tx: TenantTxClient) => Promise<T>,
  options?: { timeout?: number },
): Promise<T> {
  assertSafeTenantId(tenantId);

  return prisma.$transaction(
    async (tx) => {
      // SET LOCAL is transaction-scoped (pool-safe). Dual keys for policy compatibility.
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, tenantId);
      return fn(tx);
    },
    { timeout: options?.timeout ?? 60_000 },
  );
}
