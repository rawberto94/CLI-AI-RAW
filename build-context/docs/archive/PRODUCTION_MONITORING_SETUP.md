# Production Monitoring Setup

## Metrics Collection

### Prometheus Metrics Endpoint

**URL**: `GET /api/metrics`

Returns Prometheus-compatible metrics in text format.

### Available Metrics

#### Contract Processing

- `contracts_processed_total` - Total contracts processed
- `contract_processing_duration_seconds` - Processing time histogram
- `artifact_generation_duration_seconds` - Artifact generation time
- `ocr_processing_duration_seconds` - OCR processing time
- `contracts_errors_total` - Processing errors

#### AI/ML Operations

- `llm_requests_total` - Total LLM API calls
- `llm_request_duration_seconds` - LLM latency
- `llm_tokens_total` - Token usage (input/output)
- `llm_errors_total` - LLM failures

#### Database

- `db_queries_total` - Total queries
- `db_query_duration_seconds` - Query latency
- `db_connection_pool_size` - Connection pool metrics
- `db_slow_queries_total` - Slow queries (>1s)

#### Queue System

- `queue_jobs_added_total` - Jobs enqueued
- `queue_jobs_completed_total` - Jobs completed
- `queue_jobs_failed_total` - Job failures
- `queue_job_duration_seconds` - Job processing time
- `queue_size` - Current queue depth

#### API Performance

- `http_requests_total` - HTTP requests
- `http_request_duration_seconds` - Request latency
- `http_response_size_bytes` - Response sizes

#### Business Metrics

- `contracts_active_total` - Active contracts
- `contracts_value_usd` - Total contract value
- `contracts_expiring_30days` - Contracts expiring soon
- `savings_identified_usd` - Savings opportunities

## Prometheus Configuration

### prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'contract-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 10s
```

### Docker Compose

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources

volumes:
  prometheus_data:
  grafana_data:
```

## Grafana Dashboards

### Contract Processing Dashboard

**Panels**:

- Total contracts processed (counter)
- Processing rate (contracts/min)
- Average processing time
- Error rate
- Top tenants by volume

**Queries**:

```promql
# Processing rate
rate(contracts_processed_total[5m])

# Average processing time
rate(contract_processing_duration_seconds_sum[5m]) / rate(contract_processing_duration_seconds_count[5m])

# Error rate
rate(contracts_errors_total[5m]) / rate(contracts_processed_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(contract_processing_duration_seconds_bucket[5m]))
```

### AI/ML Dashboard

**Panels**:

- LLM requests per second
- Token consumption (by model)
- LLM latency (p50, p95, p99)
- Error rate by provider
- Cost estimation

**Queries**:

```promql
# Requests per second by model
rate(llm_requests_total[1m])

# Token usage
rate(llm_tokens_total[5m])

# 99th percentile latency
histogram_quantile(0.99, rate(llm_request_duration_seconds_bucket[5m]))
```

### Database Dashboard

**Panels**:

- Query rate
- Slow query count
- Connection pool utilization
- Query latency by operation
- Top slow queries

**Queries**:

```promql
# Query rate
rate(db_queries_total[1m])

# Slow queries
increase(db_slow_queries_total[5m])

# Connection pool usage
db_connection_pool_size{state="active"} / (db_connection_pool_size{state="active"} + db_connection_pool_size{state="idle"})
```

### Queue Dashboard

**Panels**:

- Jobs processed per minute
- Queue depth by queue
- Job failure rate
- Processing time distribution
- Backlog age

**Queries**:

```promql
# Processing rate
rate(queue_jobs_completed_total[1m])

# Failure rate
rate(queue_jobs_failed_total[1m]) / rate(queue_jobs_added_total[1m])

# Queue depth
queue_size{state="waiting"}
```

## Alerting Rules

### alerts.yml

```yaml
groups:
  - name: contract_processing
    interval: 30s
    rules:
      - alert: HighProcessingErrorRate
        expr: rate(contracts_errors_total[5m]) / rate(contracts_processed_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High contract processing error rate"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"

      - alert: SlowContractProcessing
        expr: histogram_quantile(0.95, rate(contract_processing_duration_seconds_bucket[5m])) > 300
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow contract processing"
          description: "95th percentile processing time is {{ $value }}s"

      - alert: LLMServiceDown
        expr: rate(llm_errors_total[5m]) / rate(llm_requests_total[5m]) > 0.20
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High LLM error rate"
          description: "LLM error rate is {{ $value | humanizePercentage }}"

      - alert: QueueBacklog
        expr: queue_size{state="waiting"} > 1000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Large queue backlog"
          description: "Queue {{ $labels.queue }} has {{ $value }} waiting jobs"

      - alert: DatabaseSlowQueries
        expr: rate(db_slow_queries_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Many slow database queries"
          description: "{{ $value }} slow queries/sec detected"
```

## Usage Example

### In Worker

```typescript
import { contractMetrics, trackDuration } from '@/lib/metrics';

async function processContract(contractId: string, tenantId: string) {
  const timer = contractMetrics.processingDuration.startTimer({
    tenant: tenantId,
    type: 'SOW',
    worker: 'ocr-artifact-worker'
  });

  try {
    // Process contract
    await doProcessing();
    
    contractMetrics.processed.inc({
      status: 'success',
      tenant: tenantId,
      type: 'SOW'
    });
  } catch (error) {
    contractMetrics.errors.inc({
      type: 'processing',
      tenant: tenantId,
      error_type: error.name
    });
    throw error;
  } finally {
    timer();
  }
}
```

### In AI Service

```typescript
import { aiMetrics, trackDuration } from '@/lib/metrics';

async function callLLM(prompt: string, tenant: string) {
  return trackDuration(
    aiMetrics.llmDuration,
    { provider: 'anthropic', model: 'claude-3-5-sonnet', tenant },
    async () => {
      aiMetrics.llmRequests.inc({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        tenant
      });

      const response = await anthropic.messages.create({ /* ... */ });

      aiMetrics.llmTokens.inc({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        type: 'input',
        tenant
      }, response.usage.input_tokens);

      aiMetrics.llmTokens.inc({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        type: 'output',
        tenant
      }, response.usage.output_tokens);

      return response;
    }
  );
}
```

### In Queue Worker

```typescript
import { queueMetrics } from '@/lib/metrics';

queueWorker.on('completed', (job) => {
  queueMetrics.jobsCompleted.inc({
    queue: job.queueName,
    tenant: job.data.tenantId
  });
});

queueWorker.on('failed', (job, error) => {
  queueMetrics.jobsFailed.inc({
    queue: job.queueName,
    tenant: job.data.tenantId,
    error_type: error.name
  });
});
```

## Setup Instructions

1. **Install Dependencies**:

   ```bash
   pnpm add prom-client
   ```

2. **Start Prometheus & Grafana**:

   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

3. **Access Dashboards**:
   - Prometheus: <http://localhost:9090>
   - Grafana: <http://localhost:3001> (admin/admin)

4. **Import Dashboards**:
   - In Grafana, import dashboard JSONs from `/grafana/dashboards/`

5. **Configure Alertmanager** (optional):
   - Connect to Slack/PagerDuty/Email
   - Configure alert routing rules

## Next Steps

- [ ] Add Sentry for error tracking
- [ ] Implement OpenTelemetry traces
- [ ] Add APM (Application Performance Monitoring)
- [ ] Create custom business metric dashboards
- [ ] Set up log aggregation (Loki/ELK)
