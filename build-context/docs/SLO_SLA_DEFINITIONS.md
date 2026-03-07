# Service Level Objectives (SLO) & Service Level Agreements (SLA)

## Overview

This document defines the Service Level Objectives (SLOs), Service Level Indicators (SLIs), and error budgets for the Contigo platform. These metrics guide reliability engineering decisions and customer commitments.

---

## Service Level Indicators (SLIs)

### 1. Availability

**Definition**: Percentage of time the service is operational and accessible.

```
Availability = (Total Time - Downtime) / Total Time × 100%
```

**Measurement**:

- Synthetic monitoring: Health check every 30 seconds from multiple regions
- Real user monitoring: Successful page loads / Total page loads
- API monitoring: Successful requests (2xx/3xx) / Total requests

### 2. Latency

**Definition**: Time to first byte (TTFB) and total response time.

| Metric | Definition |
|--------|------------|
| P50 Latency | Median response time |
| P95 Latency | 95th percentile response time |
| P99 Latency | 99th percentile response time |

**Measurement**: Application Performance Monitoring (APM) via OpenTelemetry

### 3. Error Rate

**Definition**: Percentage of requests resulting in errors.

```
Error Rate = (5xx Errors + Client Timeout) / Total Requests × 100%
```

**Measurement**: Application logs, Prometheus metrics

### 4. Throughput

**Definition**: Requests processed per second.

**Measurement**: Load balancer metrics, application metrics

---

## Service Level Objectives (SLOs)

### Tier 1: Core API Services

| SLI | Objective | Measurement Window |
|-----|-----------|-------------------|
| Availability | 99.9% | Monthly |
| P50 Latency | < 200ms | Rolling 5 min |
| P95 Latency | < 500ms | Rolling 5 min |
| P99 Latency | < 2000ms | Rolling 5 min |
| Error Rate | < 0.1% | Rolling 1 hour |

### Tier 2: Background Processing

| SLI | Objective | Measurement Window |
|-----|-----------|-------------------|
| Availability | 99.5% | Monthly |
| Job Processing Time (P95) | < 5 min | Rolling 1 hour |
| Failed Job Rate | < 1% | Daily |

### Tier 3: AI/ML Services

| SLI | Objective | Measurement Window |
|-----|-----------|-------------------|
| Availability | 99.0% | Monthly |
| P50 Latency | < 5s | Rolling 5 min |
| P95 Latency | < 30s | Rolling 5 min |
| Error Rate | < 5% | Rolling 1 hour |

---

## Error Budgets

### Concept

Error budget = 100% - SLO target

For a 99.9% availability SLO:

- Error budget = 0.1% = 43.2 minutes/month

### Monthly Error Budgets

| Service Tier | SLO | Error Budget (minutes/month) | Error Budget (hours/year) |
|--------------|-----|------------------------------|---------------------------|
| Tier 1 (Core API) | 99.9% | 43.2 min | 8.76 hours |
| Tier 2 (Background) | 99.5% | 216 min | 43.8 hours |
| Tier 3 (AI/ML) | 99.0% | 432 min | 87.6 hours |

### Error Budget Policy

| Budget Remaining | Action |
|------------------|--------|
| > 50% | Normal development velocity |
| 25-50% | Increase testing, reduce risky deployments |
| 10-25% | Feature freeze, focus on reliability |
| < 10% | All hands on reliability, incident response only |
| Exhausted | Service review, post-mortem required |

---

## Prometheus Alerting Rules

```yaml
# slo-alerts.yml
groups:
  - name: slo_alerts
    interval: 30s
    rules:
      # Availability Alert - 5 minute burn rate
      - alert: HighErrorBurnRate5m
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > (1 - 0.999) * 14.4
        for: 2m
        labels:
          severity: critical
          slo: availability
        annotations:
          summary: "High error burn rate (5m window)"
          description: "Error rate burning through monthly budget 14.4x faster than sustainable"

      # Availability Alert - 1 hour burn rate
      - alert: HighErrorBurnRate1h
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > (1 - 0.999) * 6
        for: 15m
        labels:
          severity: warning
          slo: availability
        annotations:
          summary: "Elevated error burn rate (1h window)"
          description: "Error rate burning through monthly budget 6x faster than sustainable"

      # Latency SLO - P95
      - alert: HighLatencyP95
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 0.5
        for: 10m
        labels:
          severity: warning
          slo: latency
        annotations:
          summary: "P95 latency exceeds 500ms SLO"
          description: "95th percentile latency is {{ $value | humanizeDuration }}"

      # Latency SLO - P99
      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 2
        for: 10m
        labels:
          severity: critical
          slo: latency
        annotations:
          summary: "P99 latency exceeds 2s SLO"
          description: "99th percentile latency is {{ $value | humanizeDuration }}"

      # Error Budget Burn
      - alert: ErrorBudgetBurnHigh
        expr: |
          (
            1 - (
              sum(increase(http_requests_total{status!~"5.."}[30d]))
              / sum(increase(http_requests_total[30d]))
            )
          ) / 0.001 > 0.5
        for: 1h
        labels:
          severity: warning
          slo: error_budget
        annotations:
          summary: "50% of monthly error budget consumed"
          description: "{{ $value | humanizePercentage }} of error budget used"

      - alert: ErrorBudgetBurnCritical
        expr: |
          (
            1 - (
              sum(increase(http_requests_total{status!~"5.."}[30d]))
              / sum(increase(http_requests_total[30d]))
            )
          ) / 0.001 > 0.9
        for: 1h
        labels:
          severity: critical
          slo: error_budget
        annotations:
          summary: "90% of monthly error budget consumed"
          description: "Feature freeze recommended. {{ $value | humanizePercentage }} of budget used"
```

---

## SLO Dashboard Queries

### Grafana Dashboard Panels

```promql
# Current Availability (30 day window)
1 - (
  sum(increase(http_requests_total{status=~"5.."}[30d]))
  / sum(increase(http_requests_total[30d]))
)

# Error Budget Remaining
1 - (
  (1 - (sum(increase(http_requests_total{status!~"5.."}[30d])) / sum(increase(http_requests_total[30d]))))
  / 0.001
)

# P50 Latency
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P95 Latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# P99 Latency
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Requests per second
sum(rate(http_requests_total[5m]))
```

---

## Customer SLA Tiers

### Enterprise Plan

| Metric | Commitment | Credits |
|--------|------------|---------|
| Monthly Uptime | 99.9% | 10% credit per 0.1% below SLA |
| Support Response (P1) | 15 minutes | - |
| Support Response (P2) | 1 hour | - |
| Support Response (P3) | 4 hours | - |
| Scheduled Maintenance | 4 hours/month max | Advance notice 72h |

### Business Plan

| Metric | Commitment | Credits |
|--------|------------|---------|
| Monthly Uptime | 99.5% | 10% credit per 0.5% below SLA |
| Support Response (P1) | 1 hour | - |
| Support Response (P2) | 4 hours | - |
| Support Response (P3) | 1 business day | - |
| Scheduled Maintenance | 8 hours/month max | Advance notice 48h |

### Starter Plan

| Metric | Commitment |
|--------|------------|
| Monthly Uptime | 99.0% (best effort) |
| Support Response | 1 business day |

---

## SLA Credit Calculation

```typescript
function calculateSLACredit(
  actualUptime: number,
  slaTarget: number,
  monthlyBill: number
): number {
  if (actualUptime >= slaTarget) {
    return 0;
  }
  
  const shortfall = slaTarget - actualUptime;
  const creditPercentage = Math.min(shortfall * 100, 30); // Cap at 30%
  
  return monthlyBill * (creditPercentage / 100);
}

// Example: 99.7% uptime vs 99.9% SLA on $1000/month
// Shortfall: 0.2%
// Credit: 20% of $1000 = $200
```

---

## Incident Classification

| Severity | Impact | SLO Impact | Response Time |
|----------|--------|------------|---------------|
| P1 - Critical | Service unavailable for all users | Burns >10% monthly budget/hour | Immediate |
| P2 - High | Major feature unavailable | Burns >1% monthly budget/hour | 15 min |
| P3 - Medium | Minor feature degraded | Burns <1% monthly budget/hour | 1 hour |
| P4 - Low | Cosmetic issues | Minimal | 4 hours |

---

## Reporting

### Weekly SLO Report

Generated every Monday:

- Current 30-day availability
- Error budget remaining
- P95/P99 latency trends
- Notable incidents
- Upcoming maintenance windows

### Monthly SLA Report (Customer-Facing)

Generated first business day of month:

- Previous month uptime percentage
- Any SLA credits owed
- Incident summary
- Planned improvements

---

## Review Process

| Review Type | Frequency | Participants |
|-------------|-----------|--------------|
| SLO Review | Weekly | SRE team |
| Error Budget Review | Bi-weekly | Engineering + Product |
| SLA Compliance | Monthly | Leadership + Customer Success |
| SLO Adjustment | Quarterly | All stakeholders |

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-16 | Platform Team | Initial version |
