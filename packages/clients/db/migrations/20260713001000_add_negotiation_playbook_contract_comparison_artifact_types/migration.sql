-- Add NEGOTIATION_PLAYBOOK and CONTRACT_COMPARISON to ArtifactType enum.
-- Referenced by negotiation-copilot.service.ts and smart-comparison.service.ts
-- ('as any' casts) but never added to the enum -> runtime 500 when invoked.
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'NEGOTIATION_PLAYBOOK';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'CONTRACT_COMPARISON';
