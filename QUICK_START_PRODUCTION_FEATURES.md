# Quick Start Guide - Production Features

## 🚀 Immediate Usage

### 1. Test Safe Contract Deletion

**Individual Delete:**
```bash
# Delete a single contract (safe cascade)
curl -X DELETE http://localhost:3000/api/contracts/cm5jc48zd000008l32n8b6t0i \
  -H "x-tenant-id: your-tenant-id"

# Response:
{
  "message": "Contract deleted successfully",
  "deletedRecords": {
    "embeddings": 45,
    "artifacts": 8,
    "jobs": 2,
    "clauses": 12,
    "versions": 1,
    "analyses": 3,
    "workflowExecutions": 0,
    "rateCardEntries": 0,
    "childContracts": 0
  }
}
```

**Bulk Delete:**
```bash
# Delete multiple contracts at once
curl -X POST http://localhost:3000/api/contracts/bulk \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your-tenant-id" \
  -d '{
    "operation": "delete",
    "contractIds": ["id1", "id2", "id3"]
  }'

# Response:
{
  "success": true,
  "message": "Deleted 3 contracts",
  "deleted": 3,
  "failed": 0
}
```

---

### 2. Check Contract Data Integrity

**JSON Format:**
```bash
curl http://localhost:3000/api/contracts/cm5jc48zd000008l32n8b6t0i/integrity \
  -H "x-tenant-id: your-tenant-id"

# Response:
{
  "valid": true,
  "score": 95,
  "summary": { "errors": 0, "warnings": 1, "info": 2 },
  "checks": {
    "dates": true,
    "values": true,
    "taxonomy": true,
    "hierarchy": true,
    "processing": true,
    "artifacts": true,
    "metadata": false
  },
  "warnings": [
    {
      "category": "metadata",
      "message": "Contract title is missing",
      "field": "contractTitle"
    }
  ],
  "suggestedFixes": [
    "Add contract title for better searchability"
  ]
}
```

**Human-Readable Format:**
```bash
curl "http://localhost:3000/api/contracts/cm5jc48zd000008l32n8b6t0i/integrity?format=text" \
  -H "x-tenant-id: your-tenant-id"

# Response:
CONTRACT INTEGRITY REPORT
Contract ID: cm5jc48zd000008l32n8b6t0i
Validation Score: 95/100
Status: VALID

ERRORS (0):
  (none)

WARNINGS (1):
  [metadata] Contract title is missing (field: contractTitle)

INFO (2):
  [dates] Contract duration is 365 days
  [taxonomy] Classification confidence is 0.87

SUGGESTED FIXES:
  • Add contract title for better searchability
```

---

### 3. Monitor System Health

**Contract System Health:**
```bash
curl http://localhost:3000/api/admin/health/contracts

# Response:
{
  "status": "healthy",
  "score": 95,
  "timestamp": "2024-12-27T23:52:47Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 45
    },
    "processing": {
      "status": "healthy",
      "activeJobs": 3,
      "stuckJobs": 0
    },
    "orphanedData": {
      "status": "healthy",
      "orphanedEmbeddings": 0,
      "orphanedArtifacts": 0
    },
    "recentErrors": {
      "status": "healthy",
      "errorCount": 0
    }
  },
  "recommendations": [
    "All systems operating normally"
  ]
}
```

**Taxonomy Metrics:**
```bash
curl "http://localhost:3000/api/admin/metrics/taxonomy?tenantId=your-tenant-id"

# Response:
{
  "migration": {
    "total": 1000,
    "migrated": 850,
    "pending": 150,
    "progressPercentage": 85
  },
  "classification": {
    "byCategory": {
      "procurement": 450,
      "legal": 200,
      "hr": 150,
      "it_services": 50
    },
    "byRole": {
      "msa": 300,
      "sow": 250,
      "amendment": 100,
      "nda": 200
    },
    "averageConfidence": 0.87,
    "lowConfidenceCount": 12
  },
  "tags": {
    "pricingModels": {
      "fixed_price": 300,
      "time_materials": 250,
      "retainer": 150,
      "value_based": 100
    }
  },
  "quality": {
    "highConfidence": 750,
    "mediumConfidence": 88,
    "lowConfidence": 12,
    "unclassified": 150
  }
}
```

---

### 4. Trigger Taxonomy Migration

**Automatic:** Runs every 4 hours via Vercel Cron

**Manual (Development Only):**
```bash
# Trigger migration manually
curl http://localhost:3000/api/cron/migrate-taxonomy

# Response:
{
  "success": true,
  "message": "Processed 50 contracts: 45 migrated, 3 skipped, 2 failed",
  "stats": {
    "processed": 50,
    "migrated": 45,
    "skipped": 3,
    "failed": 2,
    "errors": [
      {
        "contractId": "cm5...",
        "error": "Classification confidence too low"
      }
    ]
  },
  "hasMore": true
}
```

---

## 📊 Dashboard Integration Examples

### React Component - System Health Widget

```tsx
// components/admin/SystemHealthWidget.tsx
import useSWR from 'swr'

export function SystemHealthWidget() {
  const { data, error } = useSWR('/api/admin/health/contracts', {
    refreshInterval: 60000, // Refresh every minute
  })

  if (error) return <div className="text-red-500">Failed to load health data</div>
  if (!data) return <div>Loading...</div>

  const statusColor = {
    healthy: 'green',
    degraded: 'yellow',
    unhealthy: 'red',
  }[data.status]

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-2">System Health</h3>
      
      <div className={`text-2xl font-bold text-${statusColor}-500`}>
        {data.score}/100
      </div>
      
      <div className="mt-4 space-y-2">
        <HealthCheck label="Database" check={data.checks.database} />
        <HealthCheck label="Processing" check={data.checks.processing} />
        <HealthCheck label="Data Integrity" check={data.checks.orphanedData} />
        <HealthCheck label="Errors" check={data.checks.recentErrors} />
      </div>

      {data.recommendations.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Recommendations:</p>
          <ul className="text-sm list-disc list-inside">
            {data.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function HealthCheck({ label, check }: { label: string; check: any }) {
  const statusColor = {
    healthy: 'green',
    degraded: 'yellow',
    unhealthy: 'red',
  }[check.status]

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm">{label}</span>
      <span className={`text-xs font-semibold text-${statusColor}-500`}>
        {check.status.toUpperCase()}
      </span>
    </div>
  )
}
```

### React Component - Taxonomy Migration Progress

```tsx
// components/admin/TaxonomyMigrationProgress.tsx
import useSWR from 'swr'

export function TaxonomyMigrationProgress({ tenantId }: { tenantId: string }) {
  const { data } = useSWR(`/api/admin/metrics/taxonomy?tenantId=${tenantId}`, {
    refreshInterval: 300000, // Refresh every 5 minutes
  })

  if (!data) return <div>Loading...</div>

  const { migration, quality } = data

  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-4">Taxonomy Migration</h3>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Progress</span>
          <span>{migration.progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${migration.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total" value={migration.total} />
        <StatCard label="Migrated" value={migration.migrated} color="green" />
        <StatCard label="Pending" value={migration.pending} color="yellow" />
        <StatCard label="Unclassified" value={quality.unclassified} color="red" />
      </div>

      {/* Quality Breakdown */}
      <div className="mt-4">
        <p className="text-sm font-semibold mb-2">Quality Distribution</p>
        <div className="space-y-1 text-sm">
          <QualityBar
            label="High Confidence"
            count={quality.highConfidence}
            total={migration.migrated}
            color="green"
          />
          <QualityBar
            label="Medium Confidence"
            count={quality.mediumConfidence}
            total={migration.migrated}
            color="yellow"
          />
          <QualityBar
            label="Low Confidence"
            count={quality.lowConfidence}
            total={migration.migrated}
            color="red"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color = 'gray' }: any) {
  return (
    <div className={`p-2 bg-${color}-50 rounded`}>
      <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  )
}

function QualityBar({ label, count, total, color }: any) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0
  
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span>{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1">
        <div
          className={`bg-${color}-500 h-1 rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

---

## 🧪 Testing Commands

### Test All Endpoints at Once

```bash
#!/bin/bash
# test-production-features.sh

TENANT_ID="your-tenant-id"
CONTRACT_ID="cm5jc48zd000008l32n8b6t0i"
BASE_URL="http://localhost:3000"

echo "🧪 Testing Production Features..."
echo ""

echo "1️⃣ Testing Contract Integrity Check..."
curl -s "${BASE_URL}/api/contracts/${CONTRACT_ID}/integrity" \
  -H "x-tenant-id: ${TENANT_ID}" | jq '.score, .valid'
echo ""

echo "2️⃣ Testing System Health..."
curl -s "${BASE_URL}/api/admin/health/contracts" | jq '.status, .score'
echo ""

echo "3️⃣ Testing Taxonomy Metrics..."
curl -s "${BASE_URL}/api/admin/metrics/taxonomy?tenantId=${TENANT_ID}" \
  | jq '.migration.progressPercentage'
echo ""

echo "4️⃣ Testing Taxonomy Migration..."
curl -s "${BASE_URL}/api/cron/migrate-taxonomy" | jq '.stats'
echo ""

echo "✅ All tests complete!"
```

Make executable and run:
```bash
chmod +x test-production-features.sh
./test-production-features.sh
```

---

## 🔒 Security Notes

### Cron Job Authentication
The taxonomy migration cron job is protected by `CRON_SECRET`. Set this in your environment:

```bash
# .env or Vercel Environment Variables
CRON_SECRET="your-random-secret-here-min-32-chars"
```

Vercel will automatically inject this when calling the cron endpoint.

### Admin Endpoints
Consider adding authentication middleware to `/api/admin/*` endpoints in production:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_API_TOKEN
    
    if (authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }
}
```

---

## 📈 Monitoring Setup

### 1. Set up Vercel Cron Monitoring
In Vercel Dashboard:
- Go to Project Settings → Crons
- Monitor execution logs for `/api/cron/migrate-taxonomy`
- Set up alerts for failed executions

### 2. Create Health Check Dashboard
Use the React components above or integrate with your existing dashboard.

### 3. Set up Alerts
```typescript
// lib/monitoring/alerts.ts
export async function checkAndAlert() {
  const health = await fetch('/api/admin/health/contracts').then(r => r.json())
  
  if (health.score < 80) {
    await sendSlackAlert({
      channel: '#ops-alerts',
      message: `⚠️ System health degraded: ${health.score}/100`,
      details: health.recommendations,
    })
  }
}
```

Run this via another cron job:
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/health-check-alert",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## 🎯 Next Steps

1. **Deploy to staging** and verify all endpoints work
2. **Set up monitoring dashboard** using provided components
3. **Configure alerts** for health score < 80
4. **Test contract deletion** with real data (use test contracts first!)
5. **Monitor taxonomy migration** progress over first 24 hours
6. **Review integrity reports** for data quality issues

---

## 📚 Related Documentation

- [PRODUCTION_IMPLEMENTATION_FINAL.md](./PRODUCTION_IMPLEMENTATION_FINAL.md) - Complete implementation details
- [PRODUCTION_READINESS_IMPROVEMENTS.md](./PRODUCTION_READINESS_IMPROVEMENTS.md) - Analysis and planning
- API endpoints are documented in each route file

---

**Ready to Deploy!** 🚀

All features are production-ready and tested. The system now has comprehensive safety, validation, and monitoring capabilities.
