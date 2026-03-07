# Load Testing Quick Start Guide

## 🚀 Quick Start

### 1. Start the Application
```bash
npm run dev
```

### 2. Run Load Tests

**Linux/Mac:**
```bash
./scripts/run-load-tests.sh
```

**Windows:**
```powershell
.\scripts\run-load-tests.ps1
```

**Direct (any platform):**
```bash
npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts
```

## 📊 What Gets Tested

| Test | Target | Duration |
|------|--------|----------|
| Concurrent Users | 100+ users | ~10s |
| SSE Connections | 100+ connections | ~15s |
| Database Performance | 500 operations | ~20s |
| API Response Times | <200ms P95 | ~15s |
| Mixed Workload | 500 operations | ~20s |
| Sustained Load | 60 seconds | 60s |

**Total Test Time**: ~2-3 minutes

## ✅ Success Criteria

All tests must pass:
- ✓ 100+ concurrent users handled
- ✓ 100+ SSE connections supported
- ✓ API response time <200ms (P95)
- ✓ Success rate >95%
- ✓ Sustained performance for 60s

## 📈 Sample Output

```
🚀 Starting Production Readiness Load Tests

Target: 100+ concurrent users, <2s page load, <200ms API response

👥 Test 1: Concurrent User Load (100+ users)
   Target: Handle 100+ concurrent users

   Results:
   ├─ Total Operations: 120
   ├─ Successful: 118
   ├─ Failed: 2
   ├─ Success Rate: 98.33%
   ├─ P95 Latency: 145.23ms
   ├─ Target: Concurrent Users 100
   ├─ Actual: 118.00
   └─ Status: ✅ PASSED

...

📋 PRODUCTION READINESS LOAD TEST SUMMARY
══════════════════════════════════════════

Total Tests: 6
Passed: 6 ✅
Failed: 0 ❌
Overall Success Rate: 97.85%

✅ All production readiness load tests passed!
   System is ready for production deployment.
```

## 🔧 Custom Configuration

### Change Base URL
```bash
# Linux/Mac
./scripts/run-load-tests.sh --url http://localhost:3000

# Windows
.\scripts\run-load-tests.ps1 -Url http://localhost:3000

# Environment variable
export TEST_BASE_URL=http://localhost:3000
npx tsx packages/data-orchestration/test/load/production-readiness-load-test.ts
```

## ❌ Troubleshooting

### Server Not Running
```
✗ Server is not running at http://localhost:3005
```
**Fix**: Run `npm run dev` first

### Tests Failing
1. Check server logs for errors
2. Verify database is running
3. Check system resources (CPU, memory)
4. Review specific test failures in output

### High Latency
- Optimize database queries
- Check connection pool settings
- Review cache configuration

### Low Success Rate
- Check error logs
- Review rate limiting
- Verify database connection limits

## 📚 More Information

- Full documentation: `packages/data-orchestration/test/load/README.md`
- Implementation details: `.kiro/specs/production-readiness/LOAD_TESTING_COMPLETE.md`
- Design document: `.kiro/specs/production-readiness/design.md`

## 🎯 Next Steps After Passing

1. Document baseline metrics
2. Configure monitoring alerts
3. Schedule regular load tests
4. Plan capacity scaling
5. Deploy to production!
