# 🔄 Real Data Enablement Plan

**Status**: ⚠️ APIs Currently Using Mock Data  
**Reason**: `data-orchestration` package has TypeScript compilation errors  
**Impact**: Application fully functional with mock data, real database queries disabled

---

## 📊 Current Situation

### ✅ What's Working

- **All Pages**: Loading correctly (/, /dashboard, /contracts, /analytics)
- **Mock APIs**: Fully functional
  - `/api/contracts` → Returns 8 mock contracts
  - `/api/rate-cards` → Returns 10 mock rate card entries
  - `/api/healthz` → Returns healthy status
- **Memory**: Optimized at 0.9% (72MB RSS)
- **Zero Errors**: No module parse failures

### ⚠️ What's Disabled

- **Real Database Queries**: Rate cards and contracts using mock data
- **Service Layer**: `RateCardEntryService`, `AdvancedFilterService` not imported
- **Events Route**: `/api/events` disabled (SSE functionality)

---

## 🔧 Required Fixes for Real Data

### 1. **data-orchestration Package** (27 TypeScript Errors)

#### Type Errors (Prisma Schema Mismatches)

- **database.adaptor.ts** - Lines 89, 228: Tenant ID type conflicts
- **ai-insights-generator.service.ts** - Lines 356, 360: `benchmarkSnapshot` vs `benchmarkSnapshots`

#### Export/Import Errors

- **index.ts** - Duplicate exports (ArtifactSchema, ArtifactType, RateCard, etc.)
- **automated-reporting.service.ts** - Wrong service imports

#### Event Name Mismatches

- **artifact-change-propagation.service.ts** - Lines 79, 84, 102, 133, 150:
  - `ARTIFACT_BULK_UPDATED` → `ARTIFACT_UPDATED`
  - `RATE_CARD_ENTRY_UPDATED` → `RATE_CARD_UPDATED`
  - `ARTIFACT_PROPAGATION_*` → `PROPAGATION_*`

#### Validation Schema Issues

- **validation.schemas.ts** - Lines 54, 91: `.partial()` doesn't exist on ZodEffects

#### Missing File

- **rag-integration.service.ts** - Not in tsconfig file list

---

## 🚀 Implementation Steps

### Step 1: Fix Type Errors (15 minutes)

```bash
cd /workspaces/CLI-AI-RAW/packages/data-orchestration

# Fix Prisma type issues
nano src/dal/database.adaptor.ts
# Line 89: Add proper type casting for tenantId
# Line 228: Fix contractId type casting

# Fix benchmarkSnapshot naming
nano src/services/ai-insights-generator.service.ts
# Lines 356, 360: Change benchmarkSnapshot → benchmarkSnapshots
```

### Step 2: Fix Export/Import Issues (10 minutes)

```bash
# Fix duplicate exports
nano src/index.ts
# Remove duplicate re-exports or use explicit re-exporting

# Fix service imports
nano src/services/automated-reporting.service.ts
# Change to correct service class names
```

### Step 3: Fix Event Names (5 minutes)

```bash
nano src/services/artifact-change-propagation.service.ts
# Update event names to match Events enum
```

### Step 4: Fix Validation Schemas (5 minutes)

```bash
nano src/schemas/validation.schemas.ts
# Apply .partial() before .refine() or restructure validation
```

### Step 5: Add Missing File to tsconfig (2 minutes)

```bash
nano tsconfig.json
# Ensure src/**/*.ts is included or add rag-integration.service.ts explicitly
```

### Step 6: Rebuild Package (2 minutes)

```bash
pnpm run build
# Should compile with 0 errors
```

### Step 7: Enable Real Data in APIs (3 minutes)

```bash
# Edit rate-cards route
nano /workspaces/CLI-AI-RAW/apps/web/app/api/rate-cards/route.ts
# Line 250: Change `if (dataMode === 'mock' || true)` to `if (dataMode === 'mock')`
# Lines 3-6: Uncomment service imports

# Restart Next.js server
```

---

## ⚡ Quick Enable (If You Just Want Real Data NOW)

### Option A: Test with Database Directly

You can bypass the service layer temporarily:

```typescript
// In /apps/web/app/api/rate-cards/route.ts
const rateCards = await prisma.rateCardEntry.findMany({
  where: { tenantId },
  take: 50,
  orderBy: { createdAt: 'desc' }
});
```

### Option B: Use x-data-mode Header

The API already supports toggling:

```bash
# Mock data (current default)
curl http://localhost:3005/api/rate-cards

# Real data (once service layer fixed)
curl -H "x-data-mode: real" http://localhost:3005/api/rate-cards
```

---

## 📋 Effort Estimate

| Task | Time | Difficulty |
|------|------|-----------|
| Fix type errors | 15 min | ⭐⭐⭐ Medium |
| Fix exports/imports | 10 min | ⭐⭐ Easy |
| Fix event names | 5 min | ⭐ Very Easy |
| Fix validation schemas | 5 min | ⭐⭐ Easy |
| Add tsconfig entry | 2 min | ⭐ Very Easy |
| Rebuild & test | 5 min | ⭐ Very Easy |
| Enable in APIs | 3 min | ⭐ Very Easy |
| **TOTAL** | **~45 min** | |

---

## 🎯 Priority Recommendation

### For Development: ✅ **Keep Mock Data** (Current State)

- Application is fully functional
- No blockers for frontend development
- Fast page loads, no database dependencies
- Ideal for testing UI components

### For Production: 🔴 **Real Data Required**

- Need to fix all 27 TypeScript errors
- Rebuild data-orchestration package
- Re-enable service layer in API routes
- Test with real database queries

---

## 📞 Next Steps

**Choose your path:**

1. **Continue with Mock Data** → No action needed, everything works
2. **Enable Real Data Now** → I can fix the 27 errors and rebuild (45 min)
3. **Partial Fix** → Use direct Prisma queries in APIs (bypass service layer)

**What would you like to do?**
