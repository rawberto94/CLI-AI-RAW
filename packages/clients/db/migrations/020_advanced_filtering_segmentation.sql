-- Migration: Advanced Filtering & Segmentation
-- Description: Add support for advanced filtering with boolean logic and custom segments

-- Create rate_card_segments table
CREATE TABLE IF NOT EXISTS "rate_card_segments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filters" JSONB NOT NULL,
  "shared" BOOLEAN NOT NULL DEFAULT false,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "rate_card_segments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for rate_card_segments
CREATE INDEX IF NOT EXISTS "rate_card_segments_tenant_id_idx" ON "rate_card_segments"("tenant_id");
CREATE INDEX IF NOT EXISTS "rate_card_segments_user_id_idx" ON "rate_card_segments"("user_id");
CREATE INDEX IF NOT EXISTS "rate_card_segments_tenant_id_shared_idx" ON "rate_card_segments"("tenant_id", "shared");
CREATE INDEX IF NOT EXISTS "rate_card_segments_usage_count_idx" ON "rate_card_segments"("usage_count" DESC);

-- Add comment to table
COMMENT ON TABLE "rate_card_segments" IS 'Custom rate card segments with advanced filtering capabilities';
COMMENT ON COLUMN "rate_card_segments"."filters" IS 'Complex filter definition with boolean logic (AND, OR, NOT)';
COMMENT ON COLUMN "rate_card_segments"."shared" IS 'Whether the segment is shared with team members';
COMMENT ON COLUMN "rate_card_segments"."usage_count" IS 'Number of times this segment has been used';
