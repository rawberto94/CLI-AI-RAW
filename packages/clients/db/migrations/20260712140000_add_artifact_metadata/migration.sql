-- Add Artifact.metadata: free-form generation/quality metadata (regeneration
-- diagnostics, UI hints like description/preview/confidence). The artifact
-- generator worker (packages/workers/src/artifact-generator.ts) writes this on
-- every artifact create/update, and RealtimeArtifactViewer.tsx reads it — the
-- column was missing, so every artifact write failed with
-- PrismaClientValidationError and no artifact could ever persist.
-- Idempotent: safe to run against environments where this was already applied
-- by hand (e.g. via a direct ALTER TABLE on a dev database).

ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';
