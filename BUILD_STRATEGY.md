# Build Strategy for Features 5 & 6

## Quick Start (Use This!)

### 1. Development Mode (On-Demand Compilation)
```bash
cd /workspaces/CLI-AI-RAW/apps/web
pnpm dev
```
- ✅ Pages compile **only when visited**
- ✅ API routes work immediately
- ✅ Fast reload on changes
- ✅ Turbopack enabled

### 2. Test Your New APIs
```bash
# In another terminal, test the APIs:

# Test relationship detection
curl http://localhost:3005/api/contracts/CONTRACT_ID/relationships \
  -H "X-Tenant-ID: YOUR_TENANT"

# Test hierarchy
curl "http://localhost:3005/api/contracts/CONTRACT_ID/hierarchy?action=tree" \
  -H "X-Tenant-ID: YOUR_TENANT"

# Test renewal radar
curl "http://localhost:3005/api/analytics/renewal-radar?action=radar" \
  -H "X-Tenant-ID: YOUR_TENANT"
```

### 3. Test UI Components
Visit in browser:
- `http://localhost:3005/contracts/CONTRACT_ID` - View contract with relationship graph
- The `RelationshipGraph` component will compile on first visit

## Production Build Strategy

### Option A: Full Build (When Ready)
```bash
# This takes 5-10 minutes but builds everything
pnpm build
```

### Option B: Build Specific Routes Only
```bash
# Build only API routes (faster)
cd apps/web
NEXT_BUILD=true pnpm next build --experimental-app-only

# Then manually copy API routes to server
```

### Option C: Docker Multi-Stage Build
```dockerfile
# Build in powerful CI environment
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm build  # Has 16GB+ RAM

# Copy only necessary files to production
FROM node:20-alpine AS runner
COPY --from=builder /app/apps/web/.next/standalone ./
```

## File Structure for Features 5 & 6

### Services (Already Compiled ✅)
```
packages/data-orchestration/src/services/
├── relationship-detection.service.ts    ✅
├── renewal-intelligence.service.ts      ✅
└── contract-hierarchy.service.ts        ✅
```

### APIs (Work in Dev Mode ✅)
```
apps/web/app/api/
├── contracts/[id]/relationships/route.ts    ✅
├── contracts/[id]/hierarchy/route.ts        ✅
└── analytics/renewal-radar/route.ts         ✅
```

### UI Components (Compile On-Demand)
```
apps/web/app/components/contracts/
└── relationship-graph.tsx    ✅ (Compiles when used)
```

## Testing Checklist

### Backend (Use Dev Mode)
- [ ] Relationship detection API responds
- [ ] Hierarchy API returns tree data
- [ ] Renewal radar API returns analytics
- [ ] Database tables created

### Frontend (Use Dev Mode)
- [ ] RelationshipGraph component renders
- [ ] AmendmentTimeline displays versions
- [ ] ImpactAnalysisPanel shows risks
- [ ] Breadcrumb navigation works

### Database
- [ ] `contract_relationships` table exists
- [ ] `contract_alerts` table exists
- [ ] Foreign keys to `contracts` work
- [ ] Indexes created for performance

## Performance Tips

1. **Use `pnpm dev`** for development (not build)
2. **Clear `.next/cache`** if builds get slow
3. **Use `--turbo`** flag (already enabled)
4. **Test APIs directly** with curl/Postman
5. **Build in CI/CD** with adequate resources

## Migration Commands (Run in Your Environment)

```bash
# 1. Fix previous failed migrations
npx prisma migrate resolve --rolled-back "20260301000000_enterprise_rag_indexes"

# 2. Apply our new migration
npx prisma migrate deploy

# Or run SQL directly
psql -d contracts -f packages/clients/db/migrations/20260227000000_add_relationships_and_alerts/migration.sql
```
