import { describe, it, expect, vi } from 'vitest';
import { withTenant, assertSafeTenantId } from '../with-tenant';

describe('withTenant', () => {
  it('rejects unsafe tenant ids', () => {
    expect(() => assertSafeTenantId('')).toThrow();
    expect(() => assertSafeTenantId('unknown')).toThrow();
    expect(() => assertSafeTenantId("t1'; DROP TABLE")).toThrow();
    expect(() => assertSafeTenantId('tenant_abc-123')).not.toThrow();
  });

  it('sets session config then runs callback', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      $transaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({ $executeRawUnsafe: execute }),
    };

    const result = await withTenant(prisma, 'tenant_1', async () => 'ok');
    expect(result).toBe('ok');
    expect(execute).toHaveBeenCalledWith(
      `SELECT set_config('app.tenant_id', $1, true)`,
      'tenant_1',
    );
    expect(execute).toHaveBeenCalledWith(
      `SELECT set_config('app.current_tenant', $1, true)`,
      'tenant_1',
    );
  });
});
