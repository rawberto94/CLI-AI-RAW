-- Migration: Add Rate Forecasts Table
-- Description: Adds predictive analytics support with rate forecasting capabilities
-- Date: 2025-01-XX

-- Create rate_forecasts table
CREATE TABLE IF NOT EXISTS rate_forecasts (
  id TEXT PRIMARY KEY,
  rate_card_entry_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  
  -- Current State
  current_rate DECIMAL(10, 2) NOT NULL,
  forecast_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 3-Month Predictions
  three_month_rate DECIMAL(10, 2) NOT NULL,
  three_month_confidence DECIMAL(5, 2) NOT NULL,
  three_month_lower DECIMAL(10, 2) NOT NULL,
  three_month_upper DECIMAL(10, 2) NOT NULL,
  
  -- 6-Month Predictions
  six_month_rate DECIMAL(10, 2) NOT NULL,
  six_month_confidence DECIMAL(5, 2) NOT NULL,
  six_month_lower DECIMAL(10, 2) NOT NULL,
  six_month_upper DECIMAL(10, 2) NOT NULL,
  
  -- 12-Month Predictions
  twelve_month_rate DECIMAL(10, 2) NOT NULL,
  twelve_month_confidence DECIMAL(5, 2) NOT NULL,
  twelve_month_lower DECIMAL(10, 2) NOT NULL,
  twelve_month_upper DECIMAL(10, 2) NOT NULL,
  
  -- Trend Analysis
  trend_direction TEXT NOT NULL CHECK (trend_direction IN ('increasing', 'decreasing', 'stable')),
  trend_coefficient DECIMAL(10, 6) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Model Metadata
  confidence DECIMAL(5, 2) NOT NULL,
  historical_data_points INTEGER NOT NULL,
  model_version TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  CONSTRAINT fk_rate_forecasts_rate_card_entry
    FOREIGN KEY (rate_card_entry_id)
    REFERENCES rate_card_entries(id)
    ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_forecasts_rate_card_entry_id
  ON rate_forecasts(rate_card_entry_id);

CREATE INDEX IF NOT EXISTS idx_rate_forecasts_tenant_forecast_date
  ON rate_forecasts(tenant_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_rate_forecasts_risk_level
  ON rate_forecasts(risk_level);

CREATE INDEX IF NOT EXISTS idx_rate_forecasts_trend_direction
  ON rate_forecasts(trend_direction);

-- Add comment
COMMENT ON TABLE rate_forecasts IS 'Stores predictive analytics forecasts for rate cards with 3, 6, and 12-month predictions';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_rate_forecasts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rate_forecasts_updated_at
  BEFORE UPDATE ON rate_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_forecasts_updated_at();
