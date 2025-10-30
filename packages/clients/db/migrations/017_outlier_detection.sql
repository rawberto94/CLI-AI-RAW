-- Migration: Add Outlier Detection Tables
-- Description: Adds outlier detection and review tracking for rate card data quality
-- Date: 2025-01-XX

-- Create outlier_flags table
CREATE TABLE IF NOT EXISTS outlier_flags (
  id TEXT PRIMARY KEY,
  rate_card_entry_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  
  -- Outlier Detection
  outlier_type TEXT NOT NULL CHECK (outlier_type IN ('HIGH', 'LOW')),
  deviation_sigma DECIMAL(10, 4) NOT NULL,
  market_mean DECIMAL(10, 2) NOT NULL,
  market_median DECIMAL(10, 2) NOT NULL,
  standard_deviation DECIMAL(10, 2) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('EXTREME', 'MODERATE', 'MILD')),
  
  -- Review Status
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_action TEXT,
  review_notes TEXT,
  
  -- Resolution
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  resolution TEXT,
  
  -- Timestamps
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_outlier_flags_rate_card_entry
    FOREIGN KEY (rate_card_entry_id)
    REFERENCES rate_card_entries(id)
    ON DELETE CASCADE
);

-- Create outlier_review_actions table
CREATE TABLE IF NOT EXISTS outlier_review_actions (
  id TEXT PRIMARY KEY,
  rate_card_entry_id TEXT NOT NULL,
  outlier_flag_id TEXT,
  
  -- Review Details
  reviewed_by TEXT NOT NULL,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL CHECK (action IN ('CORRECT_DATA', 'ACCEPT_AS_VALID', 'MARK_INACTIVE', 'MERGE_DUPLICATE', 'INVESTIGATE_FURTHER')),
  notes TEXT,
  
  -- Foreign Keys
  CONSTRAINT fk_outlier_review_actions_outlier_flag
    FOREIGN KEY (outlier_flag_id)
    REFERENCES outlier_flags(id)
    ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outlier_flags_tenant_id
  ON outlier_flags(tenant_id);

CREATE INDEX IF NOT EXISTS idx_outlier_flags_review_status
  ON outlier_flags(review_status);

CREATE INDEX IF NOT EXISTS idx_outlier_flags_severity
  ON outlier_flags(severity);

CREATE INDEX IF NOT EXISTS idx_outlier_flags_deviation_sigma
  ON outlier_flags(deviation_sigma DESC);

CREATE INDEX IF NOT EXISTS idx_outlier_flags_tenant_review_status
  ON outlier_flags(tenant_id, review_status);

CREATE INDEX IF NOT EXISTS idx_outlier_review_actions_rate_card_entry_id
  ON outlier_review_actions(rate_card_entry_id);

CREATE INDEX IF NOT EXISTS idx_outlier_review_actions_outlier_flag_id
  ON outlier_review_actions(outlier_flag_id);

CREATE INDEX IF NOT EXISTS idx_outlier_review_actions_reviewed_at
  ON outlier_review_actions(reviewed_at);

-- Add comments
COMMENT ON TABLE outlier_flags IS 'Tracks statistical outliers in rate card data for quality control';
COMMENT ON TABLE outlier_review_actions IS 'Records review actions taken on outlier rate cards';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_outlier_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_outlier_flags_updated_at
  BEFORE UPDATE ON outlier_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_outlier_flags_updated_at();
