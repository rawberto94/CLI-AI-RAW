/**
 * Production Metrics
 * Prometheus-compatible metrics for observability
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';

// Contract Processing Metrics
export const contractMetrics = {
  processed: new Counter({
    name: 'contracts_processed_total',
    help: 'Total number of contracts processed',
    labelNames: ['status', 'tenant', 'type'],
    registers: [register],
  }),

  processingDuration: new Histogram({
    name: 'contract_processing_duration_seconds',
    help: 'Contract processing duration in seconds',
    labelNames: ['tenant', 'type', 'worker'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
    registers: [register],
  }),

  artifactGenerationDuration: new Histogram({
    name: 'artifact_generation_duration_seconds',
    help: 'Artifact generation duration per type',
    labelNames: ['type', 'method', 'tenant'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [register],
  }),

  ocrDuration: new Histogram({
    name: 'ocr_processing_duration_seconds',
    help: 'OCR processing duration',
    labelNames: ['provider', 'tenant'],
    buckets: [1, 3, 5, 10, 20, 30, 60],
    registers: [register],
  }),

  errors: new Counter({
    name: 'contracts_errors_total',
    help: 'Total number of contract processing errors',
    labelNames: ['type', 'tenant', 'error_type'],
    registers: [register],
  }),
};

// AI/ML Metrics
export const aiMetrics = {
  llmRequests: new Counter({
    name: 'llm_requests_total',
    help: 'Total LLM API requests',
    labelNames: ['provider', 'model', 'tenant'],
    registers: [register],
  }),

  llmDuration: new Histogram({
    name: 'llm_request_duration_seconds',
    help: 'LLM request duration',
    labelNames: ['provider', 'model', 'tenant'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30],
    registers: [register],
  }),

  llmTokens: new Counter({
    name: 'llm_tokens_total',
    help: 'Total LLM tokens used',
    labelNames: ['provider', 'model', 'type', 'tenant'],
    registers: [register],
  }),

  llmErrors: new Counter({
    name: 'llm_errors_total',
    help: 'Total LLM errors',
    labelNames: ['provider', 'model', 'error_type'],
    registers: [register],
  }),
};

// Database Metrics
export const dbMetrics = {
  queries: new Counter({
    name: 'db_queries_total',
    help: 'Total database queries',
    labelNames: ['operation', 'model', 'tenant'],
    registers: [register],
  }),

  queryDuration: new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration',
    labelNames: ['operation', 'model'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
    registers: [register],
  }),

  connectionPoolSize: new Gauge({
    name: 'db_connection_pool_size',
    help: 'Database connection pool size',
    labelNames: ['state'],
    registers: [register],
  }),

  slowQueries: new Counter({
    name: 'db_slow_queries_total',
    help: 'Total slow queries (>1s)',
    labelNames: ['operation', 'model'],
    registers: [register],
  }),
};

// Queue Metrics
export const queueMetrics = {
  jobsAdded: new Counter({
    name: 'queue_jobs_added_total',
    help: 'Total jobs added to queues',
    labelNames: ['queue', 'tenant'],
    registers: [register],
  }),

  jobsCompleted: new Counter({
    name: 'queue_jobs_completed_total',
    help: 'Total jobs completed',
    labelNames: ['queue', 'tenant'],
    registers: [register],
  }),

  jobsFailed: new Counter({
    name: 'queue_jobs_failed_total',
    help: 'Total jobs failed',
    labelNames: ['queue', 'tenant', 'error_type'],
    registers: [register],
  }),

  jobDuration: new Histogram({
    name: 'queue_job_duration_seconds',
    help: 'Job processing duration',
    labelNames: ['queue', 'tenant'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
    registers: [register],
  }),

  queueSize: new Gauge({
    name: 'queue_size',
    help: 'Current queue size',
    labelNames: ['queue', 'state'],
    registers: [register],
  }),
};

// API Metrics
export const apiMetrics = {
  requests: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status', 'tenant'],
    registers: [register],
  }),

  requestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),

  responseSize: new Histogram({
    name: 'http_response_size_bytes',
    help: 'HTTP response size in bytes',
    labelNames: ['method', 'path'],
    buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
    registers: [register],
  }),
};

// Business Metrics
export const businessMetrics = {
  activeContracts: new Gauge({
    name: 'contracts_active_total',
    help: 'Total active contracts',
    labelNames: ['tenant'],
    registers: [register],
  }),

  contractValue: new Gauge({
    name: 'contracts_value_usd',
    help: 'Total contract value in USD',
    labelNames: ['tenant', 'status'],
    registers: [register],
  }),

  expiringContracts: new Gauge({
    name: 'contracts_expiring_30days',
    help: 'Contracts expiring in 30 days',
    labelNames: ['tenant'],
    registers: [register],
  }),

  savingsIdentified: new Counter({
    name: 'savings_identified_usd',
    help: 'Total savings identified in USD',
    labelNames: ['tenant', 'category'],
    registers: [register],
  }),
};

// Export metrics endpoint handler
export function getMetrics() {
  return register.metrics();
}

// Helper to track duration
export function trackDuration<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  return fn().finally(() => end());
}
