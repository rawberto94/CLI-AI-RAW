-- =============================================================================
-- Contigo Production Database Schema Setup
-- =============================================================================
-- This file contains DDL statements required to bring the production database
-- in sync with the Prisma schema. These were applied on 2026-03-19 to fix
-- upload failures and dashboard errors.
--
-- Usage:
--   psql $DATABASE_URL -f data/production-schema-setup.sql
--
-- All statements are idempotent (safe to re-run).
-- =============================================================================


-- =============================================================================
-- 1. Contract table: Add missing OCR provider tracking columns
-- =============================================================================
-- These columns are required by the upload handler (prisma.contract.create).
-- Without them, contract uploads fail with:
--   "The column Contract.ocrProvider does not exist in the current database"

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "ocrProvider" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "ocrModel" TEXT;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "ocrProcessedAt" TIMESTAMP(3);


-- =============================================================================
-- 2. Agent Performance Log table
-- =============================================================================
-- Used by the agentic AI dashboard for tracking agent execution metrics.

CREATE TABLE IF NOT EXISTS "agent_performance_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "execution_time" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "quality_score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "won_negotiation" BOOLEAN,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_performance_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_performance_log_tenant_timestamp_idx"
    ON "agent_performance_log"("tenant_id", "timestamp");
CREATE INDEX IF NOT EXISTS "agent_performance_log_agent_timestamp_idx"
    ON "agent_performance_log"("agent_type", "timestamp");


-- =============================================================================
-- 3. Risk Detection Log table
-- =============================================================================
-- Used by the risk monitoring dashboard for tracking detected contract risks.

CREATE TABLE IF NOT EXISTS "risk_detection_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "risk_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "affected_section" TEXT,
    "estimated_impact" TEXT,
    "estimated_cost" DOUBLE PRECISION,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_detection_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "risk_detection_log_tenant_detected_idx"
    ON "risk_detection_log"("tenant_id", "detected_at");
CREATE INDEX IF NOT EXISTS "risk_detection_log_contract_detected_idx"
    ON "risk_detection_log"("contract_id", "detected_at");
CREATE INDEX IF NOT EXISTS "risk_detection_log_severity_detected_idx"
    ON "risk_detection_log"("severity", "detected_at");


-- =============================================================================
-- 4. RFx Opportunities table (with required enums)
-- =============================================================================
-- Used by the Contigo Labs procurement optimization features.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpportunityStatus') THEN
        CREATE TYPE "OpportunityStatus" AS ENUM (
            'IDENTIFIED', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS',
            'IMPLEMENTED', 'REJECTED', 'EXPIRED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpportunityUrgency') THEN
        CREATE TYPE "OpportunityUrgency" AS ENUM (
            'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "rfx_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "urgency" "OpportunityUrgency" NOT NULL DEFAULT 'MEDIUM',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "current_value" DECIMAL(15,2),
    "savings_potential" DECIMAL(15,2),
    "savings_percent" DOUBLE PRECISION,
    "market_rate" DECIMAL(15,2),
    "expiry_date" TIMESTAMP(3),
    "days_to_expiry" INTEGER,
    "evidence" JSONB,
    "recommended_action" TEXT NOT NULL,
    "rfx_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "snoozed_until" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted_at" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "rfx_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rfx_opportunities_tenant_id_idx"
    ON "rfx_opportunities"("tenant_id");
CREATE INDEX IF NOT EXISTS "rfx_opportunities_tenant_id_status_idx"
    ON "rfx_opportunities"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "rfx_opportunities_tenant_id_algorithm_idx"
    ON "rfx_opportunities"("tenant_id", "algorithm");
CREATE INDEX IF NOT EXISTS "rfx_opportunities_detected_at_idx"
    ON "rfx_opportunities"("detected_at");


-- =============================================================================
-- 5. RFx Events table
-- =============================================================================
-- Used by the RFx workflow engine for tracking procurement events.

CREATE TABLE IF NOT EXISTS "rfx_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "source_contract_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category" TEXT,
    "contract_type" TEXT,
    "estimated_value" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "publish_date" TIMESTAMP(3),
    "response_deadline" TIMESTAMP(3) NOT NULL,
    "award_date" TIMESTAMP(3),
    "contract_start_date" TIMESTAMP(3),
    "requirements" JSONB,
    "evaluation_criteria" JSONB,
    "invited_vendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responses" JSONB,
    "winner" TEXT,
    "award_justification" TEXT,
    "savings_achieved" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    CONSTRAINT "rfx_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rfx_events_tenant_id_status_idx"
    ON "rfx_events"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "rfx_events_tenant_id_type_idx"
    ON "rfx_events"("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "rfx_events_source_contract_id_idx"
    ON "rfx_events"("source_contract_id");
CREATE INDEX IF NOT EXISTS "rfx_events_response_deadline_idx"
    ON "rfx_events"("response_deadline");
CREATE INDEX IF NOT EXISTS "rfx_events_status_response_deadline_idx"
    ON "rfx_events"("status", "response_deadline");
