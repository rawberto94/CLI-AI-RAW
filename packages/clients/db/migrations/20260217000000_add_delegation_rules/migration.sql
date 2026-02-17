-- Migration: Add delegation rules and remaining agentic models
-- Created: 2025-02-17
-- Description: Adds the DelegationRule table for approval delegation routing,
--   plus ensures all agentic enhancement models exist (UserFeedbackLog,
--   QualityThreshold, ABTestWinner, AgentABTestResult, AgentPerformanceLog,
--   RiskDetectionLog, IntentDetectionLog).

-- ===== Delegation Rules =====
CREATE TABLE IF NOT EXISTS "delegation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delegate_to_id" TEXT NOT NULL,
    "delegate_to_name" TEXT NOT NULL,
    "delegate_to_email" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "approval_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'all',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_delegation" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "delegation_rules_tenant_id_idx" ON "delegation_rules"("tenant_id");
CREATE INDEX IF NOT EXISTS "delegation_rules_user_id_idx" ON "delegation_rules"("user_id");
CREATE INDEX IF NOT EXISTS "delegation_rules_tenant_user_idx" ON "delegation_rules"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "delegation_rules_is_active_idx" ON "delegation_rules"("is_active");
