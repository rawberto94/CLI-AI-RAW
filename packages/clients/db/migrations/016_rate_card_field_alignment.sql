-- Migration: 016_rate_card_field_alignment
-- Aligns field names between Prisma schema and API route usage
-- Date: 2025-10-28

BEGIN;

-- ============================================================================
-- 1. RateSavingsOpportunity: Rename fields for clarity and API alignment
-- ============================================================================

-- Rename annualSavings to annualSavingsPotential (more descriptive)
ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "annualSavings" TO "annualSavingsPotential";

-- Rename actualSavings to actualSavingsRealized (matches API usage)
ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "actualSavings" TO "actualSavingsRealized";

-- ============================================================================
-- 2. BenchmarkSnapshot: Add missing fields used by API routes
-- ============================================================================

-- Add rateValue field to store snapshot of rate at benchmark time
ALTER TABLE benchmark_snapshots 
  ADD COLUMN IF NOT EXISTS "rateValue" DECIMAL(10, 2);

-- Add marketMedian field for direct comparison (separate from percentile50/median)
ALTER TABLE benchmark_snapshots 
  ADD COLUMN IF NOT EXISTS "marketMedian" DECIMAL(10, 2);

-- ============================================================================
-- 3. Backfill data for new BenchmarkSnapshot fields
-- ============================================================================

-- Backfill rateValue from related RateCardEntry's dailyRateUSD
UPDATE benchmark_snapshots bs
SET "rateValue" = rce."dailyRateUSD"
FROM rate_card_entries rce
WHERE bs."rateCardEntryId" = rce.id
  AND bs."rateValue" IS NULL;

-- Backfill marketMedian from median field (they serve similar purposes)
UPDATE benchmark_snapshots 
SET "marketMedian" = "median"
WHERE "marketMedian" IS NULL;

-- Optional: Make fields NOT NULL after backfill (only if we have data)
-- Uncomment these if you want to enforce NOT NULL
-- ALTER TABLE benchmark_snapshots ALTER COLUMN "rateValue" SET NOT NULL;
-- ALTER TABLE benchmark_snapshots ALTER COLUMN "marketMedian" SET NOT NULL;

-- ============================================================================
-- 4. Update indexes to reflect renamed columns
-- ============================================================================

-- The index on annualSavings should now reference annualSavingsPotential
-- Note: PostgreSQL doesn't have a direct RENAME INDEX COLUMN, so we drop and recreate

-- Find and drop the old index (if it exists)
DROP INDEX IF EXISTS "rate_savings_opportunities_annualSavings_idx";

-- Create new index on renamed column
CREATE INDEX IF NOT EXISTS "rate_savings_opportunities_annualSavingsPotential_idx" 
  ON "rate_savings_opportunities" ("annualSavingsPotential" DESC);

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check that renames worked
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'rate_savings_opportunities' 
-- AND column_name IN ('annualSavingsPotential', 'actualSavingsRealized');

-- Check that new fields exist
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'benchmark_snapshots' 
-- AND column_name IN ('rateValue', 'marketMedian');
