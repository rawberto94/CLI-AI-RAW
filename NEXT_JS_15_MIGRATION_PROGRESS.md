# Next.js 15 Migration Progress

## Summary
Successfully migrated from **677 TypeScript errors to 397 errors** (41% reduction, 280 errors fixed).

## Changes Applied

### 1. Async Params Migration (Next.js 15 Breaking Change)
- **Tool Used**: `@next/codemod@canary next-async-request-api`
- **Files Modified**: 52 route handlers
- **Errors Fixed**: ~87 errors related to params API
- **Change Pattern**:
  ```typescript
  // Before:
  export async function GET(req, { params }: { params: { id: string } }) {
    const id = params.id;
  }
  
  // After:
  export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
  }
  ```

### 2. Data-Orchestration Package Import Fixes
- **Files Modified**: 107+ files across the app
- **Errors Fixed**: ~190 import-related errors
- **Changes**:
  - ❌ Old: `from '@/packages/data-orchestration/src/services/...'`
  - ❌ Old: `from '@/../../packages/data-orchestration/src/services/...'`
  - ❌ Old: `from 'data-orchestration/src/services/...'`
  - ❌ Old: `from '../../../../../packages/data-orchestration/src/services/...'`
  - ✅ New: `from 'data-orchestration/services'`

- **Type Exports Added**:
  - Added `export * from "./data-provider.types";` to `/packages/data-orchestration/src/types/index.ts`
  - This exports `DataMode` type used by analytics pages

### 3. Bulk Update Route Manual Fix
- **File**: `app/api/contracts/[id]/artifacts/bulk-update/route.ts`
- **Fix**: Manually updated params to async (missed by codemod)

## Remaining Issues (397 errors)

### Category Breakdown

1. **Prisma Schema Type Mismatches** (~150 errors)
   - Missing properties: `name`, `completeness`, `validationResults`, `contract`, `rateAmount`, `annualSavings`
   - Type incompatibilities with Decimal types
   - Wrong include/select properties (e.g., `benchmarkSnapshot` vs `benchmarkSnapshots`)
   - **Root Cause**: Prisma schema may have changed or needs regeneration

2. **Service Method Signature Mismatches** (~80 errors)
   - Functions expecting 0 arguments but receiving 1-2
   - Missing methods: `getComplianceEngine()` on `AnalyticalIntelligenceService`
   - **Examples**:
     - `app/analytics/negotiation/page.tsx(43,26): Expected 0 arguments, but got 2`
     - `app/api/analytics/compliance/route.ts(12,37): Property 'getComplianceEngine' does not exist`

3. **Missing Hook Exports** (~8 errors)
   - `DataMode` not exported from `@/hooks/useProcurementIntelligence`
   - Affects: negotiation, renewals, savings, suppliers analytics pages

4. **Data Provider Issues** (~30 errors)
   - Missing `metadata` property on provider responses
   - Type mismatches in provider factory returns

5. **Data-Orchestration Package Build Errors** (~25 errors)
   - Package itself has TypeScript errors preventing build
   - Can't generate proper .d.ts files
   - Errors include:
     - Missing Prisma properties
     - Zod validation type mismatches
     - Circular dependency issues

## Next Steps (Prioritized)

### HIGH PRIORITY
1. **Regenerate Prisma Client**
   ```bash
   cd packages/clients/db
   pnpm prisma generate
   ```
   - Should fix ~150 Prisma type mismatch errors
   - Critical for database type safety

2. **Fix Data-Orchestration Package Build**
   - Address ~25 TypeScript errors in the package itself
   - Enable proper type definitions export
   - This will help web app get correct types

3. **Export DataMode from useProcurementIntelligence Hook**
   ```typescript
   export { DataMode } from 'data-orchestration/types';
   ```
   - Fixes ~8 errors in analytics pages

### MEDIUM PRIORITY
4. **Fix Service Method Signatures**
   - Review and align method calls with actual service implementations
   - Add missing `getComplianceEngine()` method or remove usage
   - Fix argument count mismatches

5. **Fix Provider Response Types**
   - Add `metadata` property to provider response interfaces
   - Align actual implementation with expected type

### LOW PRIORITY
6. **SearchParams Migration** (if needed)
   - Check if Next.js 15 also requires async searchParams
   - May need another codemod run

7. **Headers/Cookies Migration** (if needed)
   - Check if any files use `headers()` or `cookies()` without await
   - Next.js 15 may require these to be async too

## Commands Used

```bash
# 1. Run Next.js 15 async params codemod
npx @next/codemod@canary next-async-request-api .

# 2. Fix import paths (multiple patterns)
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/packages/data-orchestration/src/services|from 'data-orchestration/services|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]@/../../packages/data-orchestration/src/services|from 'data-orchestration/services|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]data-orchestration/src/services|from 'data-orchestration/services|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"]\.\./\.\./\.\./\.\./\.\./packages/data-orchestration/src/services|from 'data-orchestration/services|g" {} \;
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from 'data-orchestration/services/[^']*'|from 'data-orchestration/services'|g" {} \;

# 3. Fix type imports
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from ['\"].*packages/data-orchestration/src/types|from 'data-orchestration/types|g" {} \;

# 4. Fix provider imports
find app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from 'data-orchestration/providers/data-provider-factory'|from 'data-orchestration'|g" {} \;
```

## Error Trend

| Stage | Errors | Fixed | % Reduction |
|-------|--------|-------|-------------|
| Initial | 677 | - | - |
| After Codemod | 590 | 87 | 13% |
| After Import Fixes | 397 | 280 | 41% |
| **Target** | **0** | **677** | **100%** |

## Files Modified

### Route Handlers (52 files)
All route handlers with dynamic params have been updated to use async params pattern.

### Import Path Fixes (107+ files)
All imports from data-orchestration package have been standardized to use proper package exports.

### Type Export (1 file)
- `/packages/data-orchestration/src/types/index.ts` - Added data-provider.types export

### Tsconfig (1 file)
- `/packages/data-orchestration/tsconfig.json` - Added `"types": []` to prevent uuid type resolution issues

## Blockers

1. **Data-Orchestration Package Won't Build**
   - Has its own ~25 TypeScript errors
   - Can't generate proper type definitions
   - Web app may be using stale or incorrect types

2. **Prisma Schema Drift**
   - Code expects properties that don't exist in Prisma types
   - May indicate schema needs updating or client needs regeneration

## Success Criteria

- [ ] All 397 TypeScript errors resolved
- [ ] Next.js dev server starts without errors
- [ ] Production build succeeds (`pnpm build`)
- [ ] No type errors in critical paths (contracts, rate-cards, analytics)
- [ ] Data-orchestration package builds successfully
- [ ] All tests pass

## Resources

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [Next.js Codemods](https://nextjs.org/docs/app/building-your-application/upgrading/codemods)
- [Async Request APIs RFC](https://github.com/vercel/next.js/discussions/54075)
