-- Migration: Add QUEUED status to ContractStatus enum
-- Purpose: Prevent race conditions where contract shows PROCESSING before worker starts
-- Part of: E2E Upload Flow Improvement - Phase 2.1
-- Add QUEUED to ContractStatus enum (PostgreSQL)
ALTER TYPE "ContractStatus"
ADD VALUE IF NOT EXISTS 'QUEUED'
AFTER 'UPLOADED';
-- Add QUEUED to JobStatus enum for processing jobs
ALTER TYPE "JobStatus"
ADD VALUE IF NOT EXISTS 'QUEUED'
AFTER 'PENDING';
-- Add queuedAt timestamp to Contract for tracking
ALTER TABLE "Contract"
ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
-- Add queuedAt timestamp to ProcessingJob for tracking
ALTER TABLE "ProcessingJob"
ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
-- Index for efficient QUEUED status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contract_status_queued_idx" ON "Contract" ("status", "queuedAt")
WHERE "status" = 'QUEUED';