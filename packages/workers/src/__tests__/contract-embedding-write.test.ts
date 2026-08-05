import { describe, it, expect } from 'vitest';
import { buildContractEmbeddingInsertBatch } from '../utils/contract-embedding-write';

describe('buildContractEmbeddingInsertBatch', () => {
  it('includes tenantId and contractType columns and params', () => {
    const { sql, params } = buildContractEmbeddingInsertBatch([
      {
        contractId: 'c1',
        chunkIndex: 0,
        chunkText: 'hello',
        embedding: '[0.1,0.2]',
        chunkType: 'paragraph',
        section: 'Intro',
        tenantId: 'tenant-a',
        contractType: 'MSA',
      },
      {
        contractId: 'c1',
        chunkIndex: 1,
        chunkText: 'world',
        embedding: '[0.3,0.4]',
        chunkType: 'clause',
        section: null,
        tenantId: 'tenant-a',
        contractType: 'MSA',
      },
    ]);

    expect(sql).toContain('"tenantId"');
    expect(sql).toContain('"contractType"');
    expect(sql).not.toMatch(/\$17/); // 2 rows × 8 params = $1..$16
    expect(params).toHaveLength(16);
    expect(params[6]).toBe('tenant-a');
    expect(params[7]).toBe('MSA');
    expect(params[14]).toBe('tenant-a');
    expect(params[15]).toBe('MSA');
  });

  it('rejects missing tenantId', () => {
    expect(() =>
      buildContractEmbeddingInsertBatch([
        {
          contractId: 'c1',
          chunkIndex: 0,
          chunkText: 'x',
          embedding: '[]',
          chunkType: null,
          section: null,
          tenantId: '',
          contractType: null,
        },
      ]),
    ).toThrow(/missing tenantId/);
  });

  it('rejects unknown tenantId sentinel', () => {
    expect(() =>
      buildContractEmbeddingInsertBatch([
        {
          contractId: 'c1',
          chunkIndex: 0,
          chunkText: 'x',
          embedding: '[]',
          chunkType: null,
          section: null,
          tenantId: 'unknown',
          contractType: null,
        },
      ]),
    ).toThrow(/missing tenantId/);
  });
});
