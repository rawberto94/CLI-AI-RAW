import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockContractFindFirst } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
  },
}));

import { getContractContext } from '../contract-context';

describe('getContractContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not query without a tenant scope', async () => {
    await expect(getContractContext('contract-1', '')).resolves.toBe('');
    expect(mockContractFindFirst).not.toHaveBeenCalled();
  });

  it('loads contract context through the requested tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      tenantId: 'tenant-1',
      fileName: 'msa.pdf',
      contractTitle: 'Master Services Agreement',
      status: 'ACTIVE',
      aiMetadata: {},
      artifacts: [],
      parentContract: {
        tenantId: 'tenant-2',
        contractTitle: 'Other tenant parent',
      },
      childContracts: [],
    });

    const context = await getContractContext('contract-1', 'tenant-1');

    expect(mockContractFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1', tenantId: 'tenant-1' },
      include: expect.objectContaining({
        artifacts: expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
        childContracts: expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      }),
    }));
    expect(context).toContain('Master Services Agreement');
    expect(context).not.toContain('Other tenant parent');
  });
});