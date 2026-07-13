import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: { findMany: vi.fn(), count: vi.fn() },
    taxonomyCategory: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/cache', () => ({
  withCache: vi.fn(),
  CacheKeys: { contractsList: vi.fn() },
}));

import { buildMetadataIssueFilter, buildMetadataQuality } from '../collection';

const completeContract = {
  contractTitle: 'Master Services Agreement',
  clientName: 'Acme Corp',
  supplierName: 'Vendor Inc',
  totalValue: 120000,
  effectiveDate: new Date('2026-01-01'),
  expirationDate: new Date('2027-01-01'),
  contractCategoryId: 'cat-1',
  category: null,
  categoryL1: null,
  contractType: 'Service Agreement',
  tags: ['msa'],
  aiMetadata: {},
  documentClassificationConf: 0.95,
  documentClassificationWarning: null,
} as const;

describe('buildMetadataQuality — contract-type-aware scoring', () => {
  it('flags missing value for standard contract types', () => {
    const quality = buildMetadataQuality({ ...completeContract, totalValue: null });

    expect(quality.metadataIssues.some((issue) => issue.key === 'missing-value')).toBe(true);
    expect(quality.metadataCompleteness).toBe(83); // 5/6 required issues clear
  });

  it('does not flag missing value for NDAs', () => {
    const quality = buildMetadataQuality({
      ...completeContract,
      contractType: 'NDA',
      totalValue: null,
    });

    expect(quality.metadataIssues.some((issue) => issue.key === 'missing-value')).toBe(false);
  });

  it('scores an NDA 100 when all remaining required fields are present', () => {
    const quality = buildMetadataQuality({
      ...completeContract,
      contractType: 'Non-Disclosure Agreement',
      totalValue: null,
    });

    expect(quality.metadataIssues).toEqual([]);
    expect(quality.metadataCompleteness).toBe(100);
    expect(quality.metadataCompletenessLabel).toBe('ready');
  });

  it('matches NDA exemptions case-insensitively', () => {
    const quality = buildMetadataQuality({
      ...completeContract,
      contractType: 'nda',
      totalValue: null,
    });

    expect(quality.metadataIssues.some((issue) => issue.key === 'missing-value')).toBe(false);
    expect(quality.metadataCompleteness).toBe(100);
  });

  it('still flags genuinely missing counterparties on NDAs', () => {
    const quality = buildMetadataQuality({
      ...completeContract,
      contractType: 'NDA',
      totalValue: null,
      clientName: null,
      supplierName: null,
    });

    expect(quality.metadataIssues.some((issue) => issue.key === 'missing-party')).toBe(true);
    // 4/5 required issues clear (missing-value is not part of the NDA denominator)
    expect(quality.metadataCompleteness).toBe(80);
  });
});

describe('buildMetadataIssueFilter — contract-type-aware filtering', () => {
  it('excludes value-exempt contract types from the missing-value filter', () => {
    const filter = buildMetadataIssueFilter('missing-value');

    expect(filter).toEqual({
      AND: [
        { totalValue: null },
        { NOT: { contractType: { in: ['NDA', 'Non-Disclosure Agreement', 'Partnership Agreement'], mode: 'insensitive' } } },
      ],
    });
  });

  it('leaves other issue filters untouched', () => {
    expect(buildMetadataIssueFilter('missing-title')).toEqual({
      OR: [{ contractTitle: null }, { contractTitle: '' }],
    });
  });
});
