-- RAG Performance Indexes for Contract Intelligence Platform
-- Run after Prisma migrations to ensure vector and full-text search indexes exist.
-- These cannot be managed by Prisma because it doesn't support pgvector index types.
-- Vector similarity index (HNSW) for semantic search on ContractEmbedding
-- HNSW provides better recall than IVFFlat for small-to-medium datasets (< 1M vectors)
-- and doesn't require a training step.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_contract_embedding_vector_hnsw'
) THEN -- Only create if table and column exist
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ContractEmbedding'
        AND column_name = 'embedding'
) THEN -- Ensure the vector column has explicit 1536 dimensions (text-embedding-3-small)
ALTER TABLE "ContractEmbedding"
ALTER COLUMN embedding TYPE vector(1536);
CREATE INDEX idx_contract_embedding_vector_hnsw ON "ContractEmbedding" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200);
RAISE NOTICE 'Created HNSW vector index on ContractEmbedding.embedding';
END IF;
ELSE RAISE NOTICE 'HNSW vector index already exists';
END IF;
END $$;
-- GIN index for BM25 full-text keyword search on ContractEmbedding.chunkText
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_contract_embedding_chunktext_fts'
) THEN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ContractEmbedding'
        AND column_name = 'chunkText'
) THEN CREATE INDEX idx_contract_embedding_chunktext_fts ON "ContractEmbedding" USING gin (to_tsvector('english', "chunkText"));
RAISE NOTICE 'Created GIN full-text index on ContractEmbedding.chunkText';
END IF;
ELSE RAISE NOTICE 'GIN full-text index on chunkText already exists';
END IF;
END $$;
-- GIN index for full-text search on Contract.rawText (fallback search)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_contract_rawtext_fts'
) THEN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Contract'
        AND column_name = 'rawText'
) THEN CREATE INDEX idx_contract_rawtext_fts ON "Contract" USING gin (to_tsvector('english', "rawText"))
WHERE "rawText" IS NOT NULL;
RAISE NOTICE 'Created GIN full-text index on Contract.rawText';
END IF;
ELSE RAISE NOTICE 'GIN full-text index on rawText already exists';
END IF;
END $$;
-- Drop old IVFFlat indexes if they exist (replaced by HNSW above)
DROP INDEX IF EXISTS idx_contract_embedding_vector;
DROP INDEX IF EXISTS contract_embedding_embedding_idx;
-- GIN trigram index for fast substring / LIKE / ILIKE queries on chunkText.
-- Requires pg_trgm extension (enabled in 01-enable-extensions.sql).
-- Powers fuzzy search, autocomplete, and trigram similarity ranking.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_contract_embedding_chunktext_trgm'
) THEN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ContractEmbedding'
        AND column_name = 'chunkText'
) THEN CREATE INDEX idx_contract_embedding_chunktext_trgm ON "ContractEmbedding" USING gin ("chunkText" gin_trgm_ops);
RAISE NOTICE 'Created GIN trigram index on ContractEmbedding.chunkText';
END IF;
ELSE RAISE NOTICE 'GIN trigram index on chunkText already exists';
END IF;
END $$;
-- Composite B-tree index for common pre-filter pattern: tenantId + contractId lookups
-- Accelerates the JOIN-free vector search path added in the pre-filter optimization.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_contract_embedding_tenant_contract'
) THEN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ContractEmbedding'
        AND column_name = 'tenantId'
) THEN CREATE INDEX idx_contract_embedding_tenant_contract ON "ContractEmbedding" ("tenantId", "contractId");
RAISE NOTICE 'Created composite index on ContractEmbedding(tenantId, contractId)';
END IF;
ELSE RAISE NOTICE 'Composite tenantId+contractId index already exists';
END IF;
END $$;