-- Migration: add_relationships_and_alerts
-- Created: 2026-02-27
-- Description: Add ContractRelationship and ContractAlert models for Feature 5 & 6

-- =====================================================
-- CONTRACT RELATIONSHIPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "contract_relationships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_contract_id" TEXT NOT NULL,
    "target_contract_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'bidirectional',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "detected_by" TEXT NOT NULL DEFAULT 'manual',
    "evidence" JSONB,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_relationships_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on source/target/type combination
CREATE UNIQUE INDEX "contract_relationships_source_target_type_key" 
    ON "contract_relationships"("source_contract_id", "target_contract_id", "relationship_type");

-- Create index for tenant queries
CREATE INDEX "contract_relationships_tenant_id_idx" 
    ON "contract_relationships"("tenant_id");

-- Create index for source contract lookups
CREATE INDEX "contract_relationships_source_idx" 
    ON "contract_relationships"("source_contract_id");

-- Create index for target contract lookups
CREATE INDEX "contract_relationships_target_idx" 
    ON "contract_relationships"("target_contract_id");

-- Create index for relationship type filtering
CREATE INDEX "contract_relationships_type_idx" 
    ON "contract_relationships"("relationship_type");

-- Create index for status filtering
CREATE INDEX "contract_relationships_status_idx" 
    ON "contract_relationships"("status");

-- Create composite index for common queries
CREATE INDEX "contract_relationships_tenant_status_idx" 
    ON "contract_relationships"("tenant_id", "status");

-- Add foreign key constraints
ALTER TABLE "contract_relationships" 
    ADD CONSTRAINT "contract_relationships_source_fkey" 
    FOREIGN KEY ("source_contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE;

ALTER TABLE "contract_relationships" 
    ADD CONSTRAINT "contract_relationships_target_fkey" 
    FOREIGN KEY ("target_contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE;

-- =====================================================
-- CONTRACT ALERTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "contract_alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "channels" JSONB NOT NULL DEFAULT '[]',
    "title" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "sent_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_alerts_pkey" PRIMARY KEY ("id")
);

-- Create index for tenant queries
CREATE INDEX "contract_alerts_tenant_id_idx" 
    ON "contract_alerts"("tenant_id");

-- Create index for contract lookups
CREATE INDEX "contract_alerts_contract_id_idx" 
    ON "contract_alerts"("contract_id");

-- Create index for scheduled date (for finding upcoming alerts)
CREATE INDEX "contract_alerts_scheduled_date_idx" 
    ON "contract_alerts"("scheduled_date");

-- Create index for status filtering
CREATE INDEX "contract_alerts_status_idx" 
    ON "contract_alerts"("status");

-- Create index for priority filtering
CREATE INDEX "contract_alerts_priority_idx" 
    ON "contract_alerts"("priority");

-- Create composite index for renewal radar queries
CREATE INDEX "contract_alerts_tenant_status_scheduled_idx" 
    ON "contract_alerts"("tenant_id", "status", "scheduled_date");

-- Create composite index for upcoming alerts
CREATE INDEX "contract_alerts_upcoming_idx" 
    ON "contract_alerts"("tenant_id", "status", "scheduled_date") 
    WHERE "status" = 'scheduled';

-- Add foreign key constraint
ALTER TABLE "contract_alerts" 
    ADD CONSTRAINT "contract_alerts_contract_fkey" 
    FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE;

-- =====================================================
-- RLS POLICIES (if using Row Level Security)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE "contract_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_alerts" ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for contract_relationships
CREATE POLICY "tenant_isolation_contract_relationships" 
    ON "contract_relationships" 
    FOR ALL 
    USING ("tenant_id" = current_setting('app.current_tenant', true));

-- Create RLS policy for contract_alerts
CREATE POLICY "tenant_isolation_contract_alerts" 
    ON "contract_alerts" 
    FOR ALL 
    USING ("tenant_id" = current_setting('app.current_tenant', true));

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for contract_relationships
CREATE TRIGGER update_contract_relationships_updated_at 
    BEFORE UPDATE ON "contract_relationships" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for contract_alerts
CREATE TRIGGER update_contract_alerts_updated_at 
    BEFORE UPDATE ON "contract_alerts" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA (Optional relationship types reference)
-- =====================================================

-- Create a table to store relationship type metadata
CREATE TABLE IF NOT EXISTS "relationship_types" (
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'bidirectional',
    "color" TEXT,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_types_pkey" PRIMARY KEY ("type")
);

-- Insert standard relationship types
INSERT INTO "relationship_types" ("type", "label", "description", "direction", "color", "icon") 
VALUES 
    ('SOW_UNDER_MSA', 'SOW under MSA', 'Statement of Work under Master Service Agreement', 'child', '#dbeafe', 'document-text'),
    ('AMENDMENT_TO_ORIGINAL', 'Amendment', 'Amendment modifying original contract', 'child', '#fce7f3', 'pencil-square'),
    ('ANNEX_TO_MAIN', 'Annex', 'Annex/Appendix attached to main contract', 'child', '#fef3c7', 'paper-clip'),
    ('RENEWAL_OF', 'Renewal', 'Automatic renewal relationship', 'bidirectional', '#dcfce7', 'refresh-cw'),
    ('SUPERSEDES', 'Supersedes', 'New contract replacing old version', 'parent', '#fee2e2', 'arrow-up-circle'),
    ('ADDENDUM_TO', 'Addendum', 'Addendum extending original terms', 'child', '#f3e8ff', 'plus-circle'),
    ('SUB_CONTRACT', 'Sub-contract', 'Sub-contract to main contract', 'child', '#ccfbf1', 'git-branch'),
    ('SAME_PARTY_BUNDLE', 'Same Party', 'Contracts with same counterparty', 'bidirectional', '#e0e7ff', 'users'),
    ('TEMPORAL_SEQUENCE', 'Sequence', 'Time-based contract sequence', 'bidirectional', '#f1f5f9', 'clock'),
    ('VALUE_RELATED', 'Value Related', 'Financially related contracts', 'bidirectional', '#fef9c3', 'dollar-sign'),
    ('REFERENCE_LINK', 'Reference', 'Generic reference relationship', 'bidirectional', '#f3f4f6', 'link')
ON CONFLICT ("type") DO NOTHING;
