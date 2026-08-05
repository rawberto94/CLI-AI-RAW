import { describe, it, expect } from 'vitest';
import { assertTenantGuard, TenantGuardError } from '../tenant-guard';

describe('assertTenantGuard', () => {
  it('allows non-tenant models', () => {
    expect(() =>
      assertTenantGuard({ model: 'Party', action: 'findMany', args: { where: {} } }),
    ).not.toThrow();
  });

  it('requires tenantId on Contract create', () => {
    expect(() =>
      assertTenantGuard({ model: 'Contract', action: 'create', args: { data: { fileName: 'x' } } }),
    ).toThrow(TenantGuardError);
    expect(() =>
      assertTenantGuard({
        model: 'Contract',
        action: 'create',
        args: { data: { tenantId: 't1', fileName: 'x' } },
      }),
    ).not.toThrow();
  });

  it('blocks updateMany without tenantId', () => {
    expect(() =>
      assertTenantGuard({
        model: 'Contract',
        action: 'updateMany',
        args: { where: { id: 'c1' }, data: { status: 'ACTIVE' } },
      }),
    ).toThrow(/cross-tenant write/);
  });

  it('allows updateMany with tenantId', () => {
    expect(() =>
      assertTenantGuard({
        model: 'Contract',
        action: 'updateMany',
        args: { where: { id: 'c1', tenantId: 't1' }, data: { status: 'ACTIVE' } },
      }),
    ).not.toThrow();
  });

  it('blocks strict findFirst without tenantId', () => {
    expect(() =>
      assertTenantGuard(
        { model: 'ContractEmbedding', action: 'findFirst', args: { where: { contractId: 'c1' } } },
        { strictReads: true },
      ),
    ).toThrow(/cross-tenant read/);
  });

  it('allows non-strict findMany without tenantId', () => {
    expect(() =>
      assertTenantGuard(
        { model: 'Contract', action: 'findMany', args: { where: {} } },
        { strictReads: false },
      ),
    ).not.toThrow();
  });

  it('requires tenantId on createMany rows', () => {
    expect(() =>
      assertTenantGuard({
        model: 'ContractEmbedding',
        action: 'createMany',
        args: {
          data: [
            { contractId: 'c1', chunkIndex: 0, tenantId: 't1' },
            { contractId: 'c1', chunkIndex: 1 },
          ],
        },
      }),
    ).toThrow(/createMany/);
  });
});
