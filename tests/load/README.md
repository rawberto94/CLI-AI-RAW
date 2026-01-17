# Load Testing with K6

This directory contains K6 load testing scripts for the Contigo platform.

## Prerequisites

Install K6:
```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Test Types

### 1. Smoke Test (`k6-smoke.js`)
Quick sanity check to verify the system works under minimal load.

```bash
k6 run k6-smoke.js --env BASE_URL=http://localhost:3000
```

**When to use:** Before deployments, after infrastructure changes.

### 2. Load Test (`k6-load.js`)
Simulate normal and peak traffic conditions.

```bash
k6 run k6-load.js \
  --env BASE_URL=http://localhost:3000 \
  --env API_TOKEN=your-api-token
```

**Stages:**
- 2 min ramp up to 50 VUs
- 5 min sustained at 50 VUs
- 2 min ramp up to 100 VUs
- 5 min sustained at 100 VUs
- 2 min cool down

### 3. Stress Test (`k6-stress.js`)
Find the breaking point of the system.

```bash
k6 run k6-stress.js --env BASE_URL=http://localhost:3000
```

**Stages:**
- Progressively increases from 100 to 400 VUs
- Identifies when the system starts to degrade

## Running with Docker

```bash
docker run -i grafana/k6 run - <k6-smoke.js \
  -e BASE_URL=http://host.docker.internal:3000
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run Load Tests
  uses: grafana/k6-action@v0.3.0
  with:
    filename: tests/load/k6-smoke.js
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
```

## Thresholds

| Metric | Smoke | Load | Stress |
|--------|-------|------|--------|
| P95 Response Time | < 500ms | < 2000ms | < 10000ms |
| Error Rate | < 1% | < 5% | < 15% |
| Availability | > 99.9% | > 99% | > 85% |

## Results

Test results are saved to `results/`:
- `smoke-summary.json` - Smoke test results
- `load-summary.json` - Load test results  
- `load-summary.html` - HTML report
- `stress-summary.json` - Stress test results

## Grafana Cloud Integration

For continuous monitoring, integrate with Grafana Cloud K6:

```bash
K6_CLOUD_TOKEN=your-token k6 cloud k6-load.js
```

## Custom Scenarios

For multi-tenant testing, set tenant-specific variables:

```bash
k6 run k6-load.js \
  --env BASE_URL=http://localhost:3000 \
  --env TENANT_ID=tenant-123 \
  --env API_TOKEN=tenant-token
```
