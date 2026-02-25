-- Enterprise-Scale RAG Indexes for 5000-6000 contracts per tenant
--
-- Problem: With thousands of contracts per tenant, every vector search and
-- BM25 keyword search must filter by tenantId first. The existing B-tree
-- indexes on tenantId and contractType are separate, forcing PostgreSQL to
-- do a bitmap AND or sequential scan across hundreds of thousands of chunks.
--
-- Solution: Composite indexes that cover the most frequent query patterns,
-- plus a GIN index for full-text search acceleration.
-- 1. Composite index: (tenantId, contractType) — covers cross-contract search
--    filtered by type (e.g., "all NDA termination clauses for tenant X")
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ce_tenant_type" ON "ContractEmbedding" ("tenantId", "contractType");
-- 2. Composite index: (tenantId, contractId) — covers single-contract search
--    within a tenant (most common RAG query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ce_tenant_contract" ON "ContractEmbedding" ("tenantId", "contractId");
-- 3. Composite index: (tenantId, chunkType) — covers chunk-type-filtered
--    search within a tenant (e.g., only 'clause' chunks for legal queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ce_tenant_chunktype" ON "ContractEmbedding" ("tenantId", "chunkType");
-- 4. Covering index: (tenantId, contractId, chunkIndex) INCLUDING chunkText
--    Enables index-only scans for text retrieval after vector search
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ce_tenant_contract_chunk" ON "ContractEmbedding" ("tenantId", "contractId", "chunkIndex");
-- 5. GIN index on chunkText for full-text search (BM25 keyword path)
--    The BM25 CTE in advanced-rag.service uses to_tsvector/to_tsquery;
--    a GIN index on the tsvector accelerates this dramatically at scale.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ce_chunktext_fts" ON "ContractEmbedding" USING GIN (to_tsvector('english', "chunkText"));
-- 6. Partial index: embedding IS NOT NULL — skip rows without embeddings
--    (e.g., failed embedding generation) during vector search
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ce_has_embedding" ON "ContractEmbedding" ("tenantId", "contractId")
WHERE "embedding" IS NOT NULL;
-- 7. Analyze the table to ensure the query planner uses the new indexes
ANALYZE "ContractEmbedding";