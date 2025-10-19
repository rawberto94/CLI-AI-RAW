-- Processing Jobs Schema Migration
-- Adds support for tracking contract processing lifecycle with progress and error handling

-- Create enum for job status
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- Create enum for error category
CREATE TYPE "ErrorCategory" AS ENUM (
  'TRANSIENT',
  'PERMANENT',
  'NETWORK_ERROR',
  'TIMEOUT_ERROR',
  'VALIDATION_ERROR',
  'BUSINESS_LOGIC_ERROR'
);

-- Create processing_jobs table
CREATE TABLE IF NOT EXISTS "processing_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  
  -- Status tracking
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "currentStage" TEXT,
  "totalStages" INTEGER NOT NULL DEFAULT 1,
  
  -- Timing
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "estimatedCompletionAt" TIMESTAMP(3),
  
  -- Error handling
  "error" TEXT,
  "errorStack" TEXT,
  "errorCategory" "ErrorCategory",
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt" TIMESTAMP(3),
  
  -- Queue management
  "priority" INTEGER NOT NULL DEFAULT 0,
  "queuePosition" INTEGER,
  
  -- Checkpoints for resumability
  "lastCheckpoint" TEXT,
  "checkpointData" JSONB,
  
  -- Metadata
  "metadata" JSONB,
  
  -- Audit
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key
  CONSTRAINT "processing_jobs_contractId_fkey" FOREIGN KEY ("contractId") 
    REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX "processing_jobs_contractId_idx" ON "processing_jobs"("contractId");
CREATE INDEX "processing_jobs_tenantId_idx" ON "processing_jobs"("tenantId");
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs"("status");
CREATE INDEX "processing_jobs_createdAt_idx" ON "processing_jobs"("createdAt");
CREATE INDEX "processing_jobs_priority_idx" ON "processing_jobs"("priority" DESC);
CREATE INDEX "processing_jobs_nextRetryAt_idx" ON "processing_jobs"("nextRetryAt") 
  WHERE "nextRetryAt" IS NOT NULL;

-- Composite index for queue queries
CREATE INDEX "processing_jobs_queue_idx" ON "processing_jobs"("status", "priority" DESC, "createdAt");

-- Add checksum field to contracts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'checksum'
  ) THEN
    ALTER TABLE "contracts" ADD COLUMN "checksum" TEXT;
    ALTER TABLE "contracts" ADD COLUMN "checksumAlgorithm" TEXT DEFAULT 'sha256';
    CREATE INDEX "contracts_checksum_idx" ON "contracts"("checksum") WHERE "checksum" IS NOT NULL;
  END IF;
END $$;

-- Add version field to contracts for optimistic locking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'version'
  ) THEN
    ALTER TABLE "contracts" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Add processing fields to contracts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'processingJobId'
  ) THEN
    ALTER TABLE "contracts" ADD COLUMN "processingJobId" TEXT;
    ALTER TABLE "contracts" ADD COLUMN "processingStartedAt" TIMESTAMP(3);
    ALTER TABLE "contracts" ADD COLUMN "processingCompletedAt" TIMESTAMP(3);
    ALTER TABLE "contracts" ADD COLUMN "processingDuration" INTEGER;
  END IF;
END $$;

-- Add quality scores to contracts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'dataQualityScore'
  ) THEN
    ALTER TABLE "contracts" ADD COLUMN "dataQualityScore" INTEGER DEFAULT 0;
    ALTER TABLE "contracts" ADD COLUMN "completenessScore" INTEGER DEFAULT 0;
    ALTER TABLE "contracts" ADD COLUMN "confidenceScore" INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add audit fields to contracts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contracts' AND column_name = 'createdBy'
  ) THEN
    ALTER TABLE "contracts" ADD COLUMN "createdBy" TEXT;
    ALTER TABLE "contracts" ADD COLUMN "updatedBy" TEXT;
    ALTER TABLE "contracts" ADD COLUMN "lastAccessedAt" TIMESTAMP(3);
    ALTER TABLE "contracts" ADD COLUMN "lastAccessedBy" TEXT;
    ALTER TABLE "contracts" ADD COLUMN "accessCount" INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add version and audit fields to artifacts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'artifacts' AND column_name = 'version'
  ) THEN
    ALTER TABLE "artifacts" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE "artifacts" ADD COLUMN "previousVersionId" TEXT;
    ALTER TABLE "artifacts" ADD COLUMN "changeReason" TEXT;
  END IF;
END $$;

-- Add quality fields to artifacts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'artifacts' AND column_name = 'confidence'
  ) THEN
    ALTER TABLE "artifacts" ADD COLUMN "confidence" DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE "artifacts" ADD COLUMN "dataCompleteness" DOUBLE PRECISION DEFAULT 0;
    ALTER TABLE "artifacts" ADD COLUMN "validationStatus" TEXT DEFAULT 'pending';
    ALTER TABLE "artifacts" ADD COLUMN "generationMethod" TEXT DEFAULT 'ai';
    ALTER TABLE "artifacts" ADD COLUMN "processingTime" INTEGER;
    ALTER TABLE "artifacts" ADD COLUMN "retryCount" INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add audit fields to artifacts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'artifacts' AND column_name = 'generatedBy'
  ) THEN
    ALTER TABLE "artifacts" ADD COLUMN "generatedBy" TEXT;
    ALTER TABLE "artifacts" ADD COLUMN "validatedBy" TEXT;
    ALTER TABLE "artifacts" ADD COLUMN "validatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Create function to update queue positions
CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
  -- Update queue positions for pending jobs
  WITH ranked_jobs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "tenantId" 
        ORDER BY "priority" DESC, "createdAt" ASC
      ) as position
    FROM processing_jobs
    WHERE status = 'PENDING'
  )
  UPDATE processing_jobs pj
  SET "queuePosition" = rj.position
  FROM ranked_jobs rj
  WHERE pj.id = rj.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update queue positions
DROP TRIGGER IF EXISTS update_queue_positions_trigger ON processing_jobs;
CREATE TRIGGER update_queue_positions_trigger
  AFTER INSERT OR UPDATE OF status, priority ON processing_jobs
  FOR EACH STATEMENT
  EXECUTE FUNCTION update_queue_positions();

-- Create function to calculate estimated completion time
CREATE OR REPLACE FUNCTION calculate_estimated_completion()
RETURNS TRIGGER AS $$
DECLARE
  avg_duration INTEGER;
BEGIN
  IF NEW.status = 'RUNNING' AND NEW."estimatedCompletionAt" IS NULL THEN
    -- Calculate average duration from completed jobs
    SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")))::INTEGER
    INTO avg_duration
    FROM processing_jobs
    WHERE status = 'COMPLETED'
      AND "tenantId" = NEW."tenantId"
      AND "completedAt" > NOW() - INTERVAL '7 days'
    LIMIT 100;
    
    -- Set estimated completion time
    IF avg_duration IS NOT NULL THEN
      NEW."estimatedCompletionAt" = NEW."startedAt" + (avg_duration || ' seconds')::INTERVAL;
    ELSE
      -- Default to 5 minutes if no historical data
      NEW."estimatedCompletionAt" = NEW."startedAt" + INTERVAL '5 minutes';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for estimated completion time
DROP TRIGGER IF EXISTS calculate_estimated_completion_trigger ON processing_jobs;
CREATE TRIGGER calculate_estimated_completion_trigger
  BEFORE UPDATE OF status ON processing_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'RUNNING')
  EXECUTE FUNCTION calculate_estimated_completion();

-- Add comments for documentation
COMMENT ON TABLE processing_jobs IS 'Tracks contract processing lifecycle with progress, errors, and retry logic';
COMMENT ON COLUMN processing_jobs.progress IS 'Processing progress percentage (0-100)';
COMMENT ON COLUMN processing_jobs.currentStage IS 'Current processing stage name';
COMMENT ON COLUMN processing_jobs.totalStages IS 'Total number of processing stages';
COMMENT ON COLUMN processing_jobs.priority IS 'Job priority (higher = processed first)';
COMMENT ON COLUMN processing_jobs.queuePosition IS 'Position in processing queue';
COMMENT ON COLUMN processing_jobs.lastCheckpoint IS 'Last successful checkpoint for resumability';
COMMENT ON COLUMN processing_jobs.checkpointData IS 'Checkpoint data for resume';
