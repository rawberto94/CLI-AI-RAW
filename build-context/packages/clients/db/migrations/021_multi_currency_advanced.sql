-- Migration: Multi-Currency Advanced Support
-- Description: Add exchange rate tracking and currency volatility alerts

-- Exchange Rates Table
CREATE TABLE IF NOT EXISTS "exchange_rates" (
  "id" TEXT PRIMARY KEY,
  "from_currency" VARCHAR(3) NOT NULL,
  "to_currency" VARCHAR(3) NOT NULL,
  "rate" DECIMAL(10, 6) NOT NULL,
  "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
  "source" TEXT NOT NULL DEFAULT 'exchangerate-api.io'
);

-- Indexes for exchange rates
CREATE INDEX IF NOT EXISTS "idx_exchange_rates_currencies_timestamp" 
  ON "exchange_rates" ("from_currency", "to_currency", "timestamp");
CREATE INDEX IF NOT EXISTS "idx_exchange_rates_timestamp" 
  ON "exchange_rates" ("timestamp");

-- Currency Volatility Alerts Table
CREATE TABLE IF NOT EXISTS "currency_volatility_alerts" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "base_currency" VARCHAR(3) NOT NULL,
  "change_percent" DECIMAL(5, 2) NOT NULL,
  "previous_rate" DECIMAL(10, 6) NOT NULL,
  "current_rate" DECIMAL(10, 6) NOT NULL,
  "affected_rates" INTEGER NOT NULL DEFAULT 0,
  "acknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
  "acknowledged_by" TEXT,
  "acknowledged_at" TIMESTAMP,
  "detected_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for currency volatility alerts
CREATE INDEX IF NOT EXISTS "idx_currency_volatility_tenant_ack" 
  ON "currency_volatility_alerts" ("tenant_id", "acknowledged");
CREATE INDEX IF NOT EXISTS "idx_currency_volatility_currency" 
  ON "currency_volatility_alerts" ("currency");
CREATE INDEX IF NOT EXISTS "idx_currency_volatility_detected" 
  ON "currency_volatility_alerts" ("detected_at");
CREATE INDEX IF NOT EXISTS "idx_currency_volatility_change" 
  ON "currency_volatility_alerts" ("change_percent" DESC);

-- Comments
COMMENT ON TABLE "exchange_rates" IS 'Historical exchange rate data for multi-currency support';
COMMENT ON TABLE "currency_volatility_alerts" IS 'Alerts for significant currency fluctuations affecting rate cards';
