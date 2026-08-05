/**
 * Helpers for writing ContractEmbedding rows with required tenant columns.
 *
 * Hybrid/vector search filters on ce."tenantId". Every write path must stamp
 * tenantId (and ideally contractType) or freshly indexed contracts are invisible.
 */

export type ContractEmbeddingWriteRecord = {
  contractId: string;
  chunkIndex: number;
  chunkText: string;
  /** pgvector SQL form, e.g. JSON array string from toSql() */
  embedding: string;
  chunkType: string | null;
  section: string | null;
  tenantId: string;
  contractType: string | null;
};

/**
 * Build a fully parameterized multi-row INSERT for ContractEmbedding.
 * Returns SQL with $1..$N placeholders and the params array (8 per row).
 */
export function buildContractEmbeddingInsertBatch(
  records: ContractEmbeddingWriteRecord[],
): { sql: string; params: unknown[] } {
  if (records.length === 0) {
    throw new Error('buildContractEmbeddingInsertBatch requires at least one record');
  }

  for (const r of records) {
    if (!r.tenantId || r.tenantId === 'unknown') {
      throw new Error(
        `ContractEmbedding write missing tenantId for contractId=${r.contractId} chunkIndex=${r.chunkIndex}`,
      );
    }
  }

  const paramParts: string[] = [];
  const params: unknown[] = [];

  for (let idx = 0; idx < records.length; idx++) {
    const offset = idx * 8;
    paramParts.push(
      `(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::vector, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, NOW(), NOW())`,
    );
    const r = records[idx]!;
    params.push(
      r.contractId,
      r.chunkIndex,
      r.chunkText,
      r.embedding,
      r.chunkType,
      r.section ?? null,
      r.tenantId,
      r.contractType,
    );
  }

  const sql = `INSERT INTO "ContractEmbedding" ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt") VALUES ${paramParts.join(', ')}`;
  return { sql, params };
}
