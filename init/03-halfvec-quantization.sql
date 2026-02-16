-- Half-precision vector quantization for ContractEmbedding
-- Adds a halfvec(1536) shadow column + HNSW index for ~50% storage savings
-- on the vector index while preserving the original float32 embedding.
--
-- Strategy:
--   1. Add "embeddingHalf" halfvec(1536) column (nullable)
--   2. Populate it from the existing float32 embedding column via a cast
--   3. Create an HNSW index on the halfvec column for low-latency ANN queries
--   4. The application can query either index depending on precision needs:
--        - embeddingHalf for fast, memory-efficient retrieval (most queries)
--        - embedding     for full-precision reranking / comparison
--
-- Prerequisites: pgvector >= 0.7.0 (halfvec support)
-- Safe to run multiple times (all operations are idempotent).
-- Step 1: Add the halfvec column if it doesn't exist
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ContractEmbedding'
        AND column_name = 'embeddingHalf'
) THEN
ALTER TABLE "ContractEmbedding"
ADD COLUMN "embeddingHalf" halfvec(1536);
RAISE NOTICE 'Added embeddingHalf halfvec(1536) column';
ELSE RAISE NOTICE 'embeddingHalf column already exists';
END IF;
END $$;
-- Step 2: Back-fill from existing float32 embeddings (cast is lossless down to fp16)
-- Only updates rows where embeddingHalf is NULL and embedding is NOT NULL.
DO $$ BEGIN
UPDATE "ContractEmbedding"
SET "embeddingHalf" = "embedding"::halfvec(1536)
WHERE "embeddingHalf" IS NULL
    AND "embedding" IS NOT NULL;
RAISE NOTICE 'Back-filled embeddingHalf from existing embeddings';
END $$;
-- Step 3: Create HNSW index on the halfvec column
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_contract_embedding_halfvec_hnsw'
) THEN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ContractEmbedding'
        AND column_name = 'embeddingHalf'
) THEN CREATE INDEX idx_contract_embedding_halfvec_hnsw ON "ContractEmbedding" USING hnsw ("embeddingHalf" halfvec_cosine_ops) WITH (m = 16, ef_construction = 200);
RAISE NOTICE 'Created HNSW index on embeddingHalf';
END IF;
ELSE RAISE NOTICE 'HNSW halfvec index already exists';
END IF;
END $$;