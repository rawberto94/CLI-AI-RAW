-- Migration: Add optimistic locking support
-- Description: Adds version fields to key tables for optimistic concurrency control

-- Add version field to Contract table
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "Contract_version_idx" ON "Contract"("version");

-- Add version field to Artifact table
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "Artifact_version_idx" ON "Artifact"("version");

-- Add version field to RateCardEntry table
ALTER TABLE "rate_card_entries" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "rate_card_entries_version_idx" ON "rate_card_entries"("version");

-- Add version field to RateCardBaseline table
ALTER TABLE "rate_card_baselines" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "rate_card_baselines_version_idx" ON "rate_card_baselines"("version");

-- Add version field to ContractMetadata table
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "contract_metadata_version_idx" ON "contract_metadata"("version");

-- Add version field to RateCardSupplier table
ALTER TABLE "rate_card_suppliers" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "rate_card_suppliers_version_idx" ON "rate_card_suppliers"("version");

-- Add version field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "User_version_idx" ON "User"("version");

-- Add version field to Tenant table
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "Tenant_version_idx" ON "Tenant"("version");

-- Create function to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-incrementing version
CREATE TRIGGER contract_version_trigger
  BEFORE UPDATE ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER artifact_version_trigger
  BEFORE UPDATE ON "Artifact"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER rate_card_entry_version_trigger
  BEFORE UPDATE ON "rate_card_entries"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER rate_card_baseline_version_trigger
  BEFORE UPDATE ON "rate_card_baselines"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER contract_metadata_version_trigger
  BEFORE UPDATE ON "contract_metadata"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER rate_card_supplier_version_trigger
  BEFORE UPDATE ON "rate_card_suppliers"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER user_version_trigger
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER tenant_version_trigger
  BEFORE UPDATE ON "Tenant"
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- Add comments
COMMENT ON COLUMN "Contract"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "Artifact"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "rate_card_entries"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "rate_card_baselines"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "contract_metadata"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "rate_card_suppliers"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "User"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "Tenant"."version" IS 'Optimistic locking version number';
