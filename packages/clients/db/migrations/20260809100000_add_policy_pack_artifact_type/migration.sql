-- Add POLICY_CHECK to ArtifactType enum.
-- Must be its own migration: Postgres cannot use a new enum value in the same
-- transaction that adds it.
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'POLICY_CHECK';
