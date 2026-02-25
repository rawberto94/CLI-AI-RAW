-- Contigo Labs Final Migration
-- Adds tables for Approval Actions, Agent Conversations, and RFx Opportunities

-- Create ApprovalAction table
CREATE TABLE IF NOT EXISTS "approval_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "approval_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "notes" TEXT,
    "modifications" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ApprovalAction
CREATE INDEX IF NOT EXISTS "approval_actions_tenant_id_idx" ON "approval_actions"("tenant_id");
CREATE INDEX IF NOT EXISTS "approval_actions_approval_id_idx" ON "approval_actions"("approval_id");
CREATE INDEX IF NOT EXISTS "approval_actions_actor_id_idx" ON "approval_actions"("actor_id");
CREATE INDEX IF NOT EXISTS "approval_actions_created_at_idx" ON "approval_actions"("created_at");

-- Create AgentConversation table
CREATE TABLE IF NOT EXISTS "agent_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "user_id" TEXT,
    "agent_id" TEXT,
    "agent_codename" TEXT,
    "context" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- Create indexes for AgentConversation
CREATE INDEX IF NOT EXISTS "agent_conversations_tenant_id_thread_id_idx" ON "agent_conversations"("tenant_id", "thread_id");
CREATE INDEX IF NOT EXISTS "agent_conversations_timestamp_idx" ON "agent_conversations"("timestamp");
CREATE INDEX IF NOT EXISTS "agent_conversations_agent_id_idx" ON "agent_conversations"("agent_id");

-- Create RFxOpportunity table
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

-- Create indexes for RFxOpportunity
CREATE INDEX IF NOT EXISTS "rfx_opportunities_tenant_id_idx" ON "rfx_opportunities"("tenant_id");
CREATE INDEX IF NOT EXISTS "rfx_opportunities_tenant_id_status_idx" ON "rfx_opportunities"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "rfx_opportunities_tenant_id_algorithm_idx" ON "rfx_opportunities"("tenant_id", "algorithm");
CREATE INDEX IF NOT EXISTS "rfx_opportunities_detected_at_idx" ON "rfx_opportunities"("detected_at");

-- Create OpportunityUrgency enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OpportunityUrgency') THEN
        CREATE TYPE "OpportunityUrgency" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
    END IF;
END $$;
