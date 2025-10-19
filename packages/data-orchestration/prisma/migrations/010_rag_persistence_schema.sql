-- RAG Persistence Schema
-- Knowledge Graph, Learning Data, and Observability Storage

-- ============================================================================
-- KNOWLEDGE GRAPH TABLES
-- ============================================================================

-- Graph Nodes (entities from contracts)
CREATE TABLE IF NOT EXISTS rag_graph_nodes (
    id VARCHAR(255) PRIMARY KEY,
    node_type VARCHAR(50) NOT NULL, -- contract, party, clause, term, amount, date
    tenant_id VARCHAR(255) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_graph_nodes_tenant (tenant_id),
    INDEX idx_graph_nodes_type (node_type),
    INDEX idx_graph_nodes_tenant_type (tenant_id, node_type)
);

-- Graph Relationships (connections between nodes)
CREATE TABLE IF NOT EXISTS rag_graph_relationships (
    id VARCHAR(255) PRIMARY KEY,
    relationship_type VARCHAR(100) NOT NULL,
    from_node_id VARCHAR(255) NOT NULL,
    to_node_id VARCHAR(255) NOT NULL,
    strength DECIMAL(3,2) DEFAULT 1.0,
    properties JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_node_id) REFERENCES rag_graph_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (to_node_id) REFERENCES rag_graph_nodes(id) ON DELETE CASCADE,
    INDEX idx_graph_rel_from (from_node_id),
    INDEX idx_graph_rel_to (to_node_id),
    INDEX idx_graph_rel_type (relationship_type)
);

-- ============================================================================
-- LEARNING SYSTEM TABLES
-- ============================================================================

-- User Feedback
CREATE TABLE IF NOT EXISTS rag_feedback (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    rating VARCHAR(20) NOT NULL, -- positive, negative
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_feedback_tenant (tenant_id),
    INDEX idx_feedback_user (user_id),
    INDEX idx_feedback_rating (rating),
    INDEX idx_feedback_created (created_at)
);

-- Interaction Metrics
CREATE TABLE IF NOT EXISTS rag_interactions (
    id VARCHAR(255) PRIMARY KEY,
    query_id VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    response_time INT NOT NULL, -- milliseconds
    relevance_score DECIMAL(3,2) NOT NULL,
    clicked BOOLEAN DEFAULT FALSE,
    time_spent INT DEFAULT 0, -- seconds
    follow_up_questions INT DEFAULT 0,
    sources_count INT DEFAULT 0,
    confidence DECIMAL(3,2) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_interactions_tenant (tenant_id),
    INDEX idx_interactions_query_id (query_id),
    INDEX idx_interactions_created (created_at)
);

-- Learning Insights (cached analysis results)
CREATE TABLE IF NOT EXISTS rag_learning_insights (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    insight_type VARCHAR(50) NOT NULL, -- pattern, strategy, quality_issue
    pattern VARCHAR(255),
    frequency DECIMAL(5,4),
    success_rate DECIMAL(3,2),
    avg_relevance DECIMAL(3,2),
    recommendations JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_insights_tenant (tenant_id),
    INDEX idx_insights_type (insight_type),
    INDEX idx_insights_created (created_at)
);

-- ============================================================================
-- OBSERVABILITY TABLES
-- ============================================================================

-- Distributed Traces
CREATE TABLE IF NOT EXISTS rag_traces (
    trace_id VARCHAR(255) PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration INT, -- milliseconds
    status VARCHAR(20) NOT NULL, -- pending, success, error
    query TEXT,
    retrieval_results INT,
    tokens_used INT,
    cost DECIMAL(10,6),
    error_message TEXT,
    error_stack TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_traces_tenant (tenant_id),
    INDEX idx_traces_operation (operation),
    INDEX idx_traces_status (status),
    INDEX idx_traces_start_time (start_time)
);

-- Trace Steps
CREATE TABLE IF NOT EXISTS rag_trace_steps (
    id VARCHAR(255) PRIMARY KEY,
    trace_id VARCHAR(255) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration INT NOT NULL, -- milliseconds
    status VARCHAR(20) NOT NULL, -- success, error
    metadata JSONB DEFAULT '{}',
    FOREIGN KEY (trace_id) REFERENCES rag_traces(trace_id) ON DELETE CASCADE,
    INDEX idx_trace_steps_trace (trace_id),
    INDEX idx_trace_steps_name (step_name)
);

-- Performance Metrics (aggregated)
CREATE TABLE IF NOT EXISTS rag_metrics (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- latency, accuracy, cost, errors, usage
    time_period VARCHAR(20) NOT NULL, -- minute, hour, day
    timestamp TIMESTAMP NOT NULL,
    p50_latency INT,
    p95_latency INT,
    p99_latency INT,
    avg_latency INT,
    relevance_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    user_satisfaction DECIMAL(3,2),
    total_cost DECIMAL(10,6),
    cost_per_query DECIMAL(10,6),
    tokens_used INT,
    total_errors INT,
    error_rate DECIMAL(5,4),
    total_queries INT,
    unique_users INT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metrics_tenant (tenant_id),
    INDEX idx_metrics_type (metric_type),
    INDEX idx_metrics_period (time_period),
    INDEX idx_metrics_timestamp (timestamp)
);

-- Alerts
CREATE TABLE IF NOT EXISTS rag_alerts (
    id VARCHAR(255) PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL, -- latency, accuracy, cost, error, degradation
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    message TEXT NOT NULL,
    tenant_id VARCHAR(255),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alerts_tenant (tenant_id),
    INDEX idx_alerts_type (alert_type),
    INDEX idx_alerts_severity (severity),
    INDEX idx_alerts_resolved (resolved),
    INDEX idx_alerts_created (created_at)
);

-- ============================================================================
-- SECURITY TABLES
-- ============================================================================

-- Access Policies
CREATE TABLE IF NOT EXISTS rag_access_policies (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]', -- ['read', 'write', 'delete', 'admin']
    contract_access VARCHAR(50) NOT NULL DEFAULT 'all', -- all, assigned, department
    data_filters JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_tenant (user_id, tenant_id),
    INDEX idx_policies_user (user_id),
    INDEX idx_policies_tenant (tenant_id)
);

-- Rate Limits
CREATE TABLE IF NOT EXISTS rag_rate_limits (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    queries_per_minute INT NOT NULL DEFAULT 10,
    queries_per_hour INT NOT NULL DEFAULT 100,
    queries_per_day INT NOT NULL DEFAULT 1000,
    current_minute INT DEFAULT 0,
    current_hour INT DEFAULT 0,
    current_day INT DEFAULT 0,
    last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_tenant_limit (user_id, tenant_id),
    INDEX idx_rate_limits_user (user_id),
    INDEX idx_rate_limits_tenant (tenant_id)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS rag_audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    result VARCHAR(20) NOT NULL, -- success, denied, error
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_tenant (tenant_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_result (result),
    INDEX idx_audit_created (created_at)
);

-- ============================================================================
-- MULTI-MODAL TABLES
-- ============================================================================

-- Tables extracted from contracts
CREATE TABLE IF NOT EXISTS rag_tables (
    id VARCHAR(255) PRIMARY KEY,
    contract_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    headers JSONB NOT NULL DEFAULT '[]',
    rows JSONB NOT NULL DEFAULT '[]',
    page INT,
    section VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tables_contract (contract_id),
    INDEX idx_tables_tenant (tenant_id)
);

-- Images extracted from contracts
CREATE TABLE IF NOT EXISTS rag_images (
    id VARCHAR(255) PRIMARY KEY,
    contract_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    ocr_text TEXT,
    description TEXT,
    page INT,
    image_type VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_images_contract (contract_id),
    INDEX idx_images_tenant (tenant_id),
    FULLTEXT idx_images_ocr (ocr_text)
);

-- ============================================================================
-- CONVERSATION HISTORY
-- ============================================================================

-- Conversations
CREATE TABLE IF NOT EXISTS rag_conversations (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversations_user (user_id),
    INDEX idx_conversations_tenant (tenant_id),
    INDEX idx_conversations_updated (updated_at)
);

-- Conversation Messages
CREATE TABLE IF NOT EXISTS rag_messages (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- user, assistant
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES rag_conversations(id) ON DELETE CASCADE,
    INDEX idx_messages_conversation (conversation_id),
    INDEX idx_messages_created (created_at)
);
