-- Add INTELLIGENCE_BRIEF to ArtifactType enum.
-- Referenced by apps/web/lib/contracts/server/intelligence-brief.ts and
-- apps/web/lib/ai/intelligence-brief.service.ts but never added to the enum.
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'INTELLIGENCE_BRIEF';
