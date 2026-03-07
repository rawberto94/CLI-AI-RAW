-- Migration: Alerts and Reporting System
-- Description: Add models for rate card alerts and scheduled reports

-- Create rate_card_alerts table
CREATE TABLE IF NOT EXISTS rate_card_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  
  -- Alert Details
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for rate_card_alerts
CREATE INDEX IF NOT EXISTS idx_rate_card_alerts_tenant_read_created ON rate_card_alerts(tenant_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_card_alerts_user_read ON rate_card_alerts(user_id, read);
CREATE INDEX IF NOT EXISTS idx_rate_card_alerts_type ON rate_card_alerts(type);
CREATE INDEX IF NOT EXISTS idx_rate_card_alerts_severity ON rate_card_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_rate_card_alerts_tenant_type_read ON rate_card_alerts(tenant_id, type, read);

-- Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Report Details
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  recipients JSONB NOT NULL,
  filters JSONB DEFAULT '{}',
  
  -- Schedule
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for scheduled_reports
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant_enabled_next ON scheduled_reports(tenant_id, enabled, next_run);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON scheduled_reports(type);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run);

-- Add comments
COMMENT ON TABLE rate_card_alerts IS 'Stores alerts and notifications for rate card events';
COMMENT ON TABLE scheduled_reports IS 'Stores scheduled report configurations';
