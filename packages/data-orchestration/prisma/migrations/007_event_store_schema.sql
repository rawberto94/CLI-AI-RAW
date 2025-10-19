-- Event Store Schema for Enhanced Event Bus
-- Supports event persistence, replay, and correlation tracking

-- Event Store Table
CREATE TABLE IF NOT EXISTS event_store (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    correlation_id VARCHAR(36),
    tenant_id VARCHAR(36),
    user_id VARCHAR(36),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    source VARCHAR(255) NOT NULL DEFAULT 'system',
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Indexes for efficient querying
    INDEX idx_event_store_type (type),
    INDEX idx_event_store_correlation_id (correlation_id),
    INDEX idx_event_store_tenant_id (tenant_id),
    INDEX idx_event_store_timestamp (timestamp),
    INDEX idx_event_store_source (source)
);

-- Event Subscriptions Table (for persistent subscriptions)
CREATE TABLE IF NOT EXISTS event_subscriptions (
    id VARCHAR(36) PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    subscriber_name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    retry_count INT DEFAULT 3,
    retry_delay INT DEFAULT 1000,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_event_subscriptions_type (event_type),
    INDEX idx_event_subscriptions_active (is_active),
    UNIQUE INDEX idx_event_subscriptions_unique (event_type, subscriber_name)
);

-- Processed Events Table (for idempotency)
CREATE TABLE IF NOT EXISTS processed_events (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL,
    subscriber_id VARCHAR(36) NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_processed_events_event_id (event_id),
    INDEX idx_processed_events_subscriber_id (subscriber_id),
    UNIQUE INDEX idx_processed_events_unique (event_id, subscriber_id)
);

-- Comments
COMMENT ON TABLE event_store IS 'Persistent storage for all system events with correlation tracking';
COMMENT ON TABLE event_subscriptions IS 'Persistent event subscriptions for reliable event delivery';
COMMENT ON TABLE processed_events IS 'Tracking of processed events for idempotent handling';
