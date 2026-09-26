-- Restore approximate-nearest-neighbor search on embeddings; source project never had this index either
-- HNSW requires a fixed dimension on the column; existing data is 1024-dim (text-embedding-3-small) but the column type had no bound
ALTER TABLE "ContractEmbedding" ALTER COLUMN embedding TYPE vector(1024);

CREATE INDEX IF NOT EXISTS "ContractEmbedding_embedding_hnsw_idx"
  ON "ContractEmbedding" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
