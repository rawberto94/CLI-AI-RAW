-- Migration: Add Agentic AI Enhancements Tables
-- Description: Adds tables for user feedback learning, quality threshold tracking, and A/B testing
-- Version: 1.0.0
-- Date: 2024
-- =============================================
-- USER FEEDBACK LEARNING SYSTEM
-- =============================================
-- User feedback tracking
CREATE TABLE IF NOT EXISTS user_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (
    feedback_type IN (
      'artifact_edit',
      'artifact_regeneration',
      'quality_rating',
      'error_report',
      'positive_feedback'
    )
  ),
  artifact_type TEXT NOT NULL,
  original_data JSONB NOT NULL,
  edited_data JSONB,
  rating INTEGER CHECK (
    rating BETWEEN 1 AND 5
  ),
  comment TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_artifact ON user_feedback_log(tenant_id, artifact_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback_log(feedback_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback_log(user_id, timestamp DESC);
COMMENT ON TABLE user_feedback_log IS 'Tracks user feedback for learning system';
COMMENT ON COLUMN user_feedback_log.feedback_type IS 'Type of feedback: artifact_edit, artifact_regeneration, quality_rating, error_report, positive_feedback';
COMMENT ON COLUMN user_feedback_log.original_data IS 'Original artifact data before user edit';
COMMENT ON COLUMN user_feedback_log.edited_data IS 'User-edited artifact data (for artifact_edit type)';
COMMENT ON COLUMN user_feedback_log.rating IS 'User quality rating 1-5 (for quality_rating type)';
-- =============================================
-- QUALITY THRESHOLD ADJUSTMENTS
-- =============================================
-- Quality threshold tracking per tenant and artifact type
CREATE TABLE IF NOT EXISTS quality_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  thresholds JSONB NOT NULL,
  previous_thresholds JSONB,
  adjustment_reason TEXT,
  adjustment_magnitude FLOAT CHECK (
    adjustment_magnitude >= 0
    AND adjustment_magnitude <= 0.5
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, artifact_type)
);
CREATE INDEX IF NOT EXISTS idx_quality_thresholds_tenant ON quality_thresholds(tenant_id, artifact_type);
CREATE INDEX IF NOT EXISTS idx_quality_thresholds_updated ON quality_thresholds(updated_at DESC);
COMMENT ON TABLE quality_thresholds IS 'Tenant-specific quality thresholds adjusted by learning system';
COMMENT ON COLUMN quality_thresholds.thresholds IS 'Current thresholds: {overall, completeness, accuracy, consistency, confidence}';
COMMENT ON COLUMN quality_thresholds.previous_thresholds IS 'Previous thresholds before adjustment';
COMMENT ON COLUMN quality_thresholds.adjustment_reason IS 'Explanation for why thresholds were adjusted';
COMMENT ON COLUMN quality_thresholds.adjustment_magnitude IS 'Size of the adjustment (0-0.5)';
-- =============================================
-- A/B TESTING SYSTEM
-- =============================================
-- A/B test results tracking (agent quality per variant)
CREATE TABLE IF NOT EXISTS agent_ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  contract_id TEXT,
  artifact_id TEXT,
  variant_id TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_data JSONB NOT NULL,
  quality_score FLOAT NOT NULL CHECK (
    quality_score >= 0
    AND quality_score <= 1
  ),
  completeness FLOAT NOT NULL CHECK (
    completeness >= 0
    AND completeness <= 1
  ),
  accuracy FLOAT NOT NULL CHECK (
    accuracy >= 0
    AND accuracy <= 1
  ),
  consistency FLOAT NOT NULL CHECK (
    consistency >= 0
    AND consistency <= 1
  ),
  confidence FLOAT NOT NULL CHECK (
    confidence >= 0
    AND confidence <= 1
  ),
  generation_time INTEGER NOT NULL CHECK (generation_time >= 0),
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  cost FLOAT NOT NULL CHECK (cost >= 0),
  user_accepted BOOLEAN,
  user_rating INTEGER CHECK (
    user_rating BETWEEN 1 AND 5
  ),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_ab_test_name_timestamp ON agent_ab_test_results(test_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_ab_test_tenant ON agent_ab_test_results(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_ab_test_variant ON agent_ab_test_results(test_name, variant_id);
CREATE INDEX IF NOT EXISTS idx_agent_ab_test_quality ON agent_ab_test_results(test_name, quality_score DESC);
COMMENT ON TABLE agent_ab_test_results IS 'A/B testing results for prompt and model optimization';
COMMENT ON COLUMN agent_ab_test_results.test_name IS 'Name of the A/B test (e.g., "overview-model-test")';
COMMENT ON COLUMN agent_ab_test_results.variant_id IS 'ID of the test variant used (e.g., "gpt-4o-mini")';
COMMENT ON COLUMN agent_ab_test_results.variant_name IS 'Human-readable variant name';
COMMENT ON COLUMN agent_ab_test_results.generation_time IS 'Generation time in milliseconds';
COMMENT ON COLUMN agent_ab_test_results.token_count IS 'Number of tokens used';
COMMENT ON COLUMN agent_ab_test_results.cost IS 'Cost in USD';
COMMENT ON COLUMN agent_ab_test_results.user_accepted IS 'Did user accept without edits?';
COMMENT ON COLUMN agent_ab_test_results.user_rating IS 'User quality rating 1-5';
-- A/B test winners
CREATE TABLE IF NOT EXISTS ab_test_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL UNIQUE,
  winner_variant_id TEXT NOT NULL,
  winner_variant_name TEXT NOT NULL,
  t_statistic FLOAT NOT NULL,
  p_value FLOAT,
  sample_size INTEGER NOT NULL,
  avg_quality_score FLOAT NOT NULL,
  avg_cost FLOAT NOT NULL,
  determined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ab_winners_determined ON ab_test_winners(determined_at DESC);
COMMENT ON TABLE ab_test_winners IS 'Winning variants from A/B tests';
COMMENT ON COLUMN ab_test_winners.t_statistic IS 'T-statistic for statistical significance';
COMMENT ON COLUMN ab_test_winners.p_value IS 'P-value (if calculated)';
COMMENT ON COLUMN ab_test_winners.sample_size IS 'Number of samples used to determine winner';
-- =============================================
-- AGENT PERFORMANCE METRICS
-- =============================================
-- Track performance of each specialist agent
CREATE TABLE IF NOT EXISTS agent_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (
    agent_type IN (
      'LEGAL',
      'PRICING',
      'COMPLIANCE',
      'RISK',
      'OPERATIONS'
    )
  ),
  artifact_type TEXT NOT NULL,
  execution_time INTEGER NOT NULL CHECK (execution_time >= 0),
  cost FLOAT NOT NULL CHECK (cost >= 0),
  quality_score FLOAT CHECK (
    quality_score >= 0
    AND quality_score <= 1
  ),
  confidence FLOAT CHECK (
    confidence >= 0
    AND confidence <= 1
  ),
  won_negotiation BOOLEAN,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_performance_tenant ON agent_performance_log(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_performance_type ON agent_performance_log(agent_type, timestamp DESC);
COMMENT ON TABLE agent_performance_log IS 'Tracks performance of multi-agent system';
COMMENT ON COLUMN agent_performance_log.won_negotiation IS 'Did this agent win the negotiation for this artifact?';
-- =============================================
-- RISK DETECTION HISTORY
-- =============================================
-- Track proactive risk detections
CREATE TABLE IF NOT EXISTS risk_detection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  risk_type TEXT NOT NULL CHECK (
    risk_type IN (
      'MISSING_CRITICAL_CLAUSE',
      'UNFAVORABLE_TERMS',
      'COMPLIANCE_GAP',
      'EXCESSIVE_LIABILITY',
      'RENEWAL_RISK',
      'PRICING_ANOMALY',
      'AMBIGUOUS_LANGUAGE',
      'OBLIGATION_CONFLICT'
    )
  ),
  severity TEXT NOT NULL CHECK (
    severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
  ),
  description TEXT NOT NULL,
  recommendation TEXT,
  affected_section TEXT,
  estimated_impact TEXT,
  estimated_cost FLOAT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_detection_tenant ON risk_detection_log(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_detection_contract ON risk_detection_log(contract_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_detection_severity ON risk_detection_log(severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_detection_unresolved ON risk_detection_log(tenant_id, resolved)
WHERE resolved = FALSE;
COMMENT ON TABLE risk_detection_log IS 'Tracks proactive risk detections';
COMMENT ON COLUMN risk_detection_log.acknowledged IS 'Has user acknowledged this risk?';
COMMENT ON COLUMN risk_detection_log.resolved IS 'Has this risk been resolved?';
-- =============================================
-- INTENT DETECTION HISTORY
-- =============================================
-- Track detected user intents
CREATE TABLE IF NOT EXISTS intent_detection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  user_id TEXT,
  user_query TEXT,
  user_role TEXT,
  detected_goal TEXT NOT NULL CHECK (
    detected_goal IN (
      'NEGOTIATE',
      'RISK_ASSESSMENT',
      'COST_OPTIMIZATION',
      'COMPLIANCE_CHECK',
      'RENEWAL_PREP',
      'QUICK_REVIEW',
      'DEEP_ANALYSIS'
    )
  ),
  secondary_goals TEXT [],
  confidence FLOAT NOT NULL CHECK (
    confidence >= 0
    AND confidence <= 1
  ),
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')),
  signals JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correct BOOLEAN,
  user_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intent_detection_tenant ON intent_detection_log(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_detection_goal ON intent_detection_log(detected_goal, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_detection_confidence ON intent_detection_log(confidence DESC);
COMMENT ON TABLE intent_detection_log IS 'Tracks detected user intents for goal-oriented reasoning';
COMMENT ON COLUMN intent_detection_log.signals IS 'Signals used for intent detection (query keywords, role, etc.)';
COMMENT ON COLUMN intent_detection_log.correct IS 'Was the detected intent correct? (user feedback)';
-- =============================================
-- VIEWS FOR ANALYTICS
-- =============================================
-- View: A/B Test Performance Summary
CREATE OR REPLACE VIEW ab_test_performance_summary AS
SELECT test_name,
  variant_id,
  variant_name,
  COUNT(*) as total_tests,
  AVG(quality_score) as avg_quality,
  AVG(completeness) as avg_completeness,
  AVG(accuracy) as avg_accuracy,
  AVG(cost) as avg_cost,
  AVG(generation_time) as avg_time_ms,
  SUM(
    CASE
      WHEN user_accepted = true THEN 1
      ELSE 0
    END
  )::float / NULLIF(
    SUM(
      CASE
        WHEN user_accepted IS NOT NULL THEN 1
        ELSE 0
      END
    ),
    0
  ) as acceptance_rate
FROM agent_ab_test_results
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY test_name,
  variant_id,
  variant_name;
COMMENT ON VIEW ab_test_performance_summary IS 'Summary of A/B test performance by variant (last 30 days)';
-- View: Agent Performance Summary
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT agent_type,
  artifact_type,
  COUNT(*) as total_executions,
  AVG(execution_time) as avg_time_ms,
  AVG(cost) as avg_cost,
  AVG(quality_score) as avg_quality,
  SUM(
    CASE
      WHEN won_negotiation = true THEN 1
      ELSE 0
    END
  )::float / NULLIF(COUNT(*), 0) as win_rate
FROM agent_performance_log
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY agent_type,
  artifact_type;
COMMENT ON VIEW agent_performance_summary IS 'Summary of agent performance by type and artifact (last 30 days)';
-- View: Risk Detection Summary
CREATE OR REPLACE VIEW risk_detection_summary AS
SELECT tenant_id,
  risk_type,
  severity,
  COUNT(*) as total_detections,
  SUM(
    CASE
      WHEN acknowledged = true THEN 1
      ELSE 0
    END
  ) as acknowledged_count,
  SUM(
    CASE
      WHEN resolved = true THEN 1
      ELSE 0
    END
  ) as resolved_count,
  AVG(
    EXTRACT(
      EPOCH
      FROM (acknowledged_at - detected_at)
    ) / 3600
  ) as avg_hours_to_acknowledge,
  AVG(
    EXTRACT(
      EPOCH
      FROM (resolved_at - detected_at)
    ) / 3600
  ) as avg_hours_to_resolve
FROM risk_detection_log
WHERE detected_at > NOW() - INTERVAL '30 days'
GROUP BY tenant_id,
  risk_type,
  severity;
COMMENT ON VIEW risk_detection_summary IS 'Summary of risk detections by type and severity (last 30 days)';
-- View: Intent Detection Accuracy
CREATE OR REPLACE VIEW intent_detection_accuracy AS
SELECT detected_goal,
  COUNT(*) as total_detections,
  AVG(confidence) as avg_confidence,
  SUM(
    CASE
      WHEN correct = true THEN 1
      ELSE 0
    END
  )::float / NULLIF(
    SUM(
      CASE
        WHEN correct IS NOT NULL THEN 1
        ELSE 0
      END
    ),
    0
  ) as accuracy_rate
FROM intent_detection_log
WHERE detected_at > NOW() - INTERVAL '30 days'
GROUP BY detected_goal;
COMMENT ON VIEW intent_detection_accuracy IS 'Accuracy of intent detection by goal (last 30 days)';
-- =============================================
-- FUNCTIONS FOR COMMON QUERIES
-- =============================================
-- Function: Get latest quality thresholds for tenant/artifact
CREATE OR REPLACE FUNCTION get_quality_thresholds(p_tenant_id TEXT, p_artifact_type TEXT) RETURNS JSONB AS $$
DECLARE thresholds JSONB;
BEGIN
SELECT t.thresholds INTO thresholds
FROM quality_thresholds t
WHERE t.tenant_id = p_tenant_id
  AND t.artifact_type = p_artifact_type
ORDER BY t.updated_at DESC
LIMIT 1;
-- Return defaults if not found
IF thresholds IS NULL THEN RETURN jsonb_build_object(
  'overall',
  0.7,
  'completeness',
  0.6,
  'accuracy',
  0.7,
  'consistency',
  0.65,
  'confidence',
  0.6
);
END IF;
RETURN thresholds;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION get_quality_thresholds IS 'Get current quality thresholds for tenant/artifact, or defaults';
-- Function: Get current A/B test winner
CREATE OR REPLACE FUNCTION get_ab_test_winner(p_test_name TEXT) RETURNS TABLE (
    variant_id TEXT,
    variant_name TEXT,
    avg_quality FLOAT,
    avg_cost FLOAT,
    determined_at TIMESTAMPTZ
  ) AS $$ BEGIN RETURN QUERY
SELECT w.winner_variant_id,
  w.winner_variant_name,
  w.avg_quality_score,
  w.avg_cost,
  w.determined_at
FROM ab_test_winners w
WHERE w.test_name = p_test_name
ORDER BY w.determined_at DESC
LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION get_ab_test_winner IS 'Get current winner for an A/B test';
-- =============================================
-- INITIAL DATA
-- =============================================
-- Insert default quality thresholds (optional, system will create as needed)
-- INSERT INTO quality_thresholds (tenant_id, artifact_type, thresholds)
-- VALUES ('default', 'OVERVIEW', '{"overall": 0.7, "completeness": 0.6, "accuracy": 0.7, "consistency": 0.65, "confidence": 0.6}')
-- ON CONFLICT (tenant_id, artifact_type) DO NOTHING;
-- =============================================
-- GRANTS (adjust based on your security model)
-- =============================================
-- Grant permissions to application role (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_role;
-- =============================================
-- COMPLETION
-- =============================================
-- Log migration completion
DO $$ BEGIN RAISE NOTICE 'Agentic AI Enhancements migration completed successfully';
RAISE NOTICE 'Tables created: user_feedback_log, quality_thresholds, ab_test_results, ab_test_winners, agent_performance_log, risk_detection_log, intent_detection_log';
RAISE NOTICE 'Views created: ab_test_performance_summary, agent_performance_summary, risk_detection_summary, intent_detection_accuracy';
RAISE NOTICE 'Functions created: get_quality_thresholds, get_ab_test_winner';
END $$;