# Load Testing Suite

This directory contains load testing scripts for the Contract Intelligence Platform.

## Overview

The load testing suite validates system performance under various load conditions to ensure production readiness.

## Test Files

### 1. `production-readiness-load-test.ts`

**Primary load test suite for production readiness validation**

Tests:

- ✅ Concurrent User Load (100+ users)
- ✅ SSE Connection Scaling (100+ connections)
- ✅ Database Performance Under Load
- ✅ API Response Time Verification (<200ms P95)
- ✅ Mixed Workload (Read/Write operations)
- ✅ Sustained Load Test (60 seconds)

**Requirements Covered:**

- Requirement 8.1: Integration tests for critical workflows
- Requirement 7.1: Support at least 100 concurrent SSE connections

**Performance Targets:**

- Page Load Time: <2 seconds
- API Response Time: <200ms (P95)
- Concurrent Users: 100+
- SSE Connections: 100+
- Success Rate: >95%

### 2. `rate-card-load-test.ts`

Load tests specific to rate card functionality.

### 3. `enhanced-rate-card-load-test.ts`

Advanced load tests for rate card engine enhancements.

## Running Load Tests

### Prerequisites

1. Ensure the application is running:

```bash
npm run dev
```

2. Set environment variables (optional):

```bash
export TEST_BASE_URL=http://localhost:3005
export TEST_TENANT_ID=your-tenant-id
```

### Run Production Readiness Load Tests

```bash
# From project root
npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts

# Or with custom URL
TEST_BASE_URL=http://localhost:3000 npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts
```

### Run All Load Tests

```bash
# Run production readiness tests
npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts

# Run rate card tests
npx tsx packages/data-orchestration/test/load/rate-card-load-test.ts

# Run enhanced rate card tests
npx tsx packages/data-orchestration/test/load/enhanced-rate-card-load-test.ts
```

## Test Results

Each test provides detailed metrics:

- **Total Operations**: Number of operations performed
- **Successful Operations**: Number of successful operations
- **Failed Operations**: Number of failed operations
- **Success Rate**: Percentage of successful operations
- **Total Duration**: Total time taken for all operations
- **Average Duration**: Average time per operation
- **Operations/sec**: Throughput (operations per second)
- **P50 Latency**: 50th percentile latency
- **P95 Latency**: 95th percentile latency
- **P99 Latency**: 99th percentile latency
- **Target Metrics**: Expected vs actual performance

## Performance Targets

### API Response Times

- **Target**: <200ms (P95)
- **Critical**: <500ms (P99)

### Page Load Times

- **Target**: <2 seconds
- **Critical**: <5 seconds

### Concurrent Users

- **Target**: 100+ concurrent users
- **Critical**: 50+ concurrent users

### SSE Connections

- **Target**: 100+ concurrent connections
- **Critical**: 50+ concurrent connections

### Success Rate

- **Target**: >95%
- **Critical**: >90%

## Interpreting Results

### ✅ PASSED

All performance targets met. System is production-ready.

### ❌ FAILED

One or more targets not met. Review:

1. Database query optimization
2. Connection pool configuration
3. Cache hit rates
4. Network latency
5. Resource utilization (CPU, memory)

## Troubleshooting

### High Latency (P95 > 200ms)

- Check database query performance
- Review connection pool settings
- Verify cache configuration
- Check for N+1 queries

### Low Success Rate (<95%)

- Check error logs
- Review rate limiting configuration
- Verify database connection limits
- Check for timeout issues

### SSE Connection Failures

- Review connection manager configuration
- Check max connection limits
- Verify event bus performance
- Review reconnection logic

### Database Performance Issues

- Add missing indexes
- Optimize slow queries
- Increase connection pool size
- Enable query caching

## Best Practices

1. **Run tests in staging environment** before production
2. **Monitor system resources** during tests (CPU, memory, connections)
3. **Run tests multiple times** to ensure consistency
4. **Test during peak hours** to simulate real conditions
5. **Gradually increase load** to find breaking points
6. **Document results** for future reference

## CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Load Tests
  run: |
    npm run dev &
    sleep 10
    npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts
```

## Monitoring During Tests

Monitor these metrics during load tests:

- CPU utilization
- Memory usage
- Database connections
- Cache hit/miss ratio
- Network throughput
- Error rates
- Response times

## Next Steps

After successful load tests:

1. ✅ Document results
2. ✅ Update performance baselines
3. ✅ Configure monitoring alerts
4. ✅ Plan capacity scaling
5. ✅ Schedule regular load tests

## Support

For issues or questions:

- Review test output for specific failures
- Check application logs
- Review monitoring dashboards
- Consult the design document: `.kiro/specs/production-readiness/design.md`
