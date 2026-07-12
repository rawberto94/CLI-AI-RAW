-- Add ArtifactType enum values that existed in schema.prisma but were never
-- applied to some databases (schema drift from ad-hoc db push / manual SQL
-- instead of tracked migrations). Confirmed missing in production: uploads
-- were failing with "invalid input value for enum ArtifactType: X" for any
-- of these types, silently dropping 4-10 of the 14 artifacts the app
-- generates per contract (packages/workers/src/artifact-generator.ts and
-- apps/web/lib/real-artifact-generator.ts both rely on the full enum).
--
-- Idempotent: ADD VALUE IF NOT EXISTS is a no-op wherever a value already
-- exists. Each ALTER TYPE is its own statement — do not add other statements
-- that use these new enum values in the same migration/transaction (Postgres
-- disallows using a newly added enum value before the transaction commits).

ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'PROACTIVE_RISKS';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'PARTIES';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'TIMELINE';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'DELIVERABLES';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'PRICING';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'INTELLECTUAL_PROPERTY';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'DATA_PRIVACY';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'AUDIT_TRAIL';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'EXECUTIVE_SUMMARY';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'ACTION_ITEMS';
