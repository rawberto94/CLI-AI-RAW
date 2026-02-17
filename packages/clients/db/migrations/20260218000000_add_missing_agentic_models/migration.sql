-- Migration: Add missing agentic enhancement models
-- Created: 2026-02-18
-- Description: Creates tables for UserFeedbackLog, QualityThreshold, ABTestWinner,
--   AgentABTestResult, AgentPerformanceLog, RiskDetectionLog, and IntentDetectionLog.
--   These were defined in the Prisma schema but had no corresponding migration.
-- ===== User Feedback Log =====
CREATE TABLE IF NOT EXISTS "user_feedback_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feedback_type" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "original_data" JSONB NOT NULL,
    "edited_data" JSONB,
    "rating" INTEGER,
    "comment" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_feedback_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "user_feedback_log_tenant_id_idx" ON "user_feedback_log"("tenant_id");
CREATE INDEX IF NOT EXISTS "user_feedback_log_tenant_artifact_idx" ON "user_feedback_log"("tenant_id", "artifact_type");
CREATE INDEX IF NOT EXISTS "user_feedback_log_timestamp_idx" ON "user_feedback_log"("timestamp");
CREATE INDEX IF NOT EXISTS "user_feedback_log_user_id_idx" ON "user_feedback_log"("user_id");
-- ===== Quality Thresholds =====
CREATE TABLE IF NOT EXISTS "quality_thresholds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "thresholds" JSONB NOT NULL,
    "previous_thresholds" JSONB,
    "adjustment_reason" TEXT,
    "adjustment_magnitude" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quality_thresholds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quality_thresholds_tenant_artifact_unique" ON "quality_thresholds"("tenant_id", "artifact_type");
CREATE INDEX IF NOT EXISTS "quality_thresholds_tenant_id_idx" ON "quality_thresholds"("tenant_id");
CREATE INDEX IF NOT EXISTS "quality_thresholds_updated_at_idx" ON "quality_thresholds"("updated_at");
-- ===== AB Test Winners =====
CREATE TABLE IF NOT EXISTS "ab_test_winners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_name" TEXT NOT NULL,
    "winner_variant_id" TEXT NOT NULL,
    "winner_variant_name" TEXT NOT NULL,
    "t_statistic" DOUBLE PRECISION NOT NULL,
    "p_value" DOUBLE PRECISION,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "avg_quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "determined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ab_test_winners_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ab_test_winners_test_name_unique" ON "ab_test_winners"("test_name");
CREATE INDEX IF NOT EXISTS "ab_test_winners_determined_at_idx" ON "ab_test_winners"("determined_at");
-- ===== Agent AB Test Results =====
CREATE TABLE IF NOT EXISTS "agent_ab_test_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_name" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "artifact_id" TEXT,
    "variant_id" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "artifact_data" JSONB NOT NULL,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "generation_time" INTEGER NOT NULL,
    "token_count" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "user_accepted" BOOLEAN,
    "user_rating" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_ab_test_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_ab_test_results_test_timestamp_idx" ON "agent_ab_test_results"("test_name", "timestamp");
CREATE INDEX IF NOT EXISTS "agent_ab_test_results_tenant_timestamp_idx" ON "agent_ab_test_results"("tenant_id", "timestamp");
CREATE INDEX IF NOT EXISTS "agent_ab_test_results_test_variant_idx" ON "agent_ab_test_results"("test_name", "variant_id");
CREATE INDEX IF NOT EXISTS "agent_ab_test_results_test_quality_idx" ON "agent_ab_test_results"("test_name", "quality_score");
-- ===== Agent Performance Log =====
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
CREATE INDEX IF NOT EXISTS "agent_performance_log_tenant_timestamp_idx" ON "agent_performance_log"("tenant_id", "timestamp");
CREATE INDEX IF NOT EXISTS "agent_performance_log_agent_timestamp_idx" ON "agent_performance_log"("agent_type", "timestamp");
-- ===== Risk Detection Log =====
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
CREATE INDEX IF NOT EXISTS "risk_detection_log_tenant_detected_idx" ON "risk_detection_log"("tenant_id", "detected_at");
CREATE INDEX IF NOT EXISTS "risk_detection_log_contract_detected_idx" ON "risk_detection_log"("contract_id", "detected_at");
CREATE INDEX IF NOT EXISTS "risk_detection_log_severity_detected_idx" ON "risk_detection_log"("severity", "detected_at");
-- ===== Intent Detection Log =====
CREATE TABLE IF NOT EXISTS "intent_detection_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_query" TEXT,
    "user_role" TEXT,
    "detected_goal" TEXT NOT NULL,
    "secondary_goals" TEXT [] DEFAULT ARRAY []::TEXT [],
    "confidence" DOUBLE PRECISION NOT NULL,
    "urgency" TEXT,
    "signals" JSONB,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correct" BOOLEAN,
    "user_feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "intent_detection_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "intent_detection_log_tenant_detected_idx" ON "intent_detection_log"("tenant_id", "detected_at");
CREATE INDEX IF NOT EXISTS "intent_detection_log_goal_detected_idx" ON "intent_detection_log"("detected_goal", "detected_at");
CREATE INDEX IF NOT EXISTS "intent_detection_log_confidence_idx" ON "intent_detection_log"("confidence");