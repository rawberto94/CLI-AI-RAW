-- Migration: Add client/tenant, baseline flag, and negotiation fields to rate cards
-- Migration: 023_add_client_baseline_negotiation

-- Add new columns to RateCardEntry
ALTER TABLE "rate_card_entries" 
ADD COLUMN IF NOT EXISTS "clientName" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "clientId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "isBaseline" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "baselineType" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "isNegotiated" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "negotiationDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "negotiatedBy" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "msaReference" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "isEditable" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "editedBy" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "editHistory" JSONB DEFAULT '[]'::jsonb;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_client_name" 
ON "rate_card_entries" ("clientName");

CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_client_id" 
ON "rate_card_entries" ("clientId");

CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_is_baseline" 
ON "rate_card_entries" ("isBaseline") WHERE "isBaseline" = true;

CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_is_negotiated" 
ON "rate_card_entries" ("isNegotiated") WHERE "isNegotiated" = true;

CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_tenant_client" 
ON "rate_card_entries" ("tenantId", "clientName");

CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_baseline_negotiated" 
ON "rate_card_entries" ("isBaseline", "isNegotiated");

-- Add composite index for filtering
CREATE INDEX IF NOT EXISTS "idx_rate_card_entry_client_baseline_filter" 
ON "rate_card_entries" ("tenantId", "clientName", "isBaseline", "isNegotiated");

-- Comments for documentation
COMMENT ON COLUMN "rate_card_entries"."clientName" IS 'Client/tenant name (e.g., UBS, Pictet, KPMG)';
COMMENT ON COLUMN "rate_card_entries"."clientId" IS 'Reference to client/tenant ID';
COMMENT ON COLUMN "rate_card_entries"."isBaseline" IS 'Marks if this rate is a baseline/target rate';
COMMENT ON COLUMN "rate_card_entries"."baselineType" IS 'Type of baseline (negotiated, market, target, etc.)';
COMMENT ON COLUMN "rate_card_entries"."isNegotiated" IS 'Indicates if this rate was negotiated';
COMMENT ON COLUMN "rate_card_entries"."negotiationDate" IS 'Date when the rate was negotiated';
COMMENT ON COLUMN "rate_card_entries"."negotiatedBy" IS 'User who negotiated the rate';
COMMENT ON COLUMN "rate_card_entries"."msaReference" IS 'Reference to Master Service Agreement';
COMMENT ON COLUMN "rate_card_entries"."isEditable" IS 'Controls if the rate card can be manually edited';
COMMENT ON COLUMN "rate_card_entries"."editedBy" IS 'Last user who edited the rate card';
COMMENT ON COLUMN "rate_card_entries"."editedAt" IS 'Timestamp of last edit';
COMMENT ON COLUMN "rate_card_entries"."editHistory" IS 'JSON array of edit history';

-- Update existing records to be editable by default
UPDATE "rate_card_entries" 
SET "isEditable" = true 
WHERE "isEditable" IS NULL;
