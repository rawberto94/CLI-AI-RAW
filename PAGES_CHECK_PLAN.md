# Comprehensive Pages Check Plan

## Date: October 7, 2025

## Status: ✅ IN PROGRESS

## Issues Fixed

### 1. ✅ TypeScript Compilation Errors - FIXED

- **File**: `apps/web/lib/errors/error-messages.ts`
- **Issue**: Smart quotes (Unicode apostrophes) instead of ASCII apostrophes
- **Fixed Lines**: 50, 63, 78, 79, 93, 107, 108, 127, 154, 192, 193, 206
- **Status**: All smart quotes replaced with proper escaped apostrophes

### 2. ✅ JSX in TypeScript File - FIXED

- **File**: `apps/web/lib/performance/lazy-components.ts`
- **Issue**: JSX syntax in `.ts` file without React import
- **Action**: Renamed to `.tsx` and added React import
- **Status**: File now properly configured for JSX

### 3. ✅ Tooltip Content Smart Quotes - FIXED

- **File**: `apps/web/lib/tooltips/content.ts`
- **Issue**: Smart quotes in tooltip content
- **Fixed Lines**: 24, 49, 86, 97, 121, 161
- **Status**: All smart quotes replaced

## All Page Files (49 total)

### Core Pages (✅ = Checked)

1. ✅ `apps/web/app/page.tsx` - Main dashboard
2. ✅ `apps/web/app/contracts/page.tsx` - Contracts list
3. ✅ `apps/web/app/contracts/[id]/page.tsx` - Contract details
4. ✅ `apps/web/app/contracts/upload/page.tsx` - Contract upload

### Rate Cards Pages (✅ = Checked)

5. ✅ `apps/web/app/rate-cards/page.tsx` - Rate cards list
6. ✅ `apps/web/app/rate-cards/[id]/page.tsx` - Rate card details
7. ✅ `apps/web/app/rate-cards/new/page.tsx` - New rate card

### Benchmarking Pages (✅ = Checked)

8. ✅ `apps/web/app/benchmarks/page.tsx` - Benchmarks overview
9. ✅ `apps/web/app/benchmarks/compare/page.tsx` - Rate comparison

### Import Pages (✅ = Checked)

10. ✅ `apps/web/app/import/rate-cards/page.tsx` - Rate card import
11. ✅ `apps/web/app/import/rate-cards/wizard/page.tsx` - Import wizard
12. ✅ `apps/web/app/import/history/page.tsx` - Import history
13. ✅ `apps/web/app/import/templates/page.tsx` - Import templates

### Analytics Pages (✅ = Checked)

14. ✅ `apps/web/app/analytics/page.tsx` - Analytics overview
15. ✅ `apps/web/app/analytics/compliance/page.tsx` - Compliance analytics
16. ✅ `apps/web/app/analytics/portfolio/page.tsx` - Portfolio analytics
17. ✅ `apps/web/app/analytics/risk/page.tsx` - Risk analytics

### Use Cases Pages (✅ = Checked)

18. ✅ `apps/web/app/use-cases/page.tsx` - Use cases overview
19. ✅ `apps/web/app/use-cases/rate-benchmarking/page.tsx` - Rate benchmarking
20. ✅ `apps/web/app/use-cases/compliance-check/page.tsx` - Compliance check
21. ✅ `apps/web/app/use-cases/cross-contract-intelligence/page.tsx` - Cross-contract
22. ✅ `apps/web/app/use-cases/negotiation-prep/page.tsx` - Negotiation prep
23. ✅ `apps/web/app/use-cases/renewal-radar/page.tsx` - Renewal radar
24. ✅ `apps/web/app/use-cases/savings-pipeline/page.tsx` - Savings pipeline
25. ✅ `apps/web/app/use-cases/sievo-integration/page.tsx` - Sievo integration
26. ✅ `apps/web/app/use-cases/supplier-snapshots/page.tsx` - Supplier snapshots

### Other Pages (✅ = Checked)

27. ✅ `apps/web/app/ai-intelligence/page.tsx` - AI intelligence
28. ✅ `apps/web/app/api-docs/page.tsx` - API documentation
29. ✅ `apps/web/app/bpo-demo/page.tsx` - BPO demo
30. ✅ `apps/web/app/compliance/page.tsx` - Compliance overview
31. ✅ `apps/web/app/cross-contract-analysis/page.tsx` - Cross-contract analysis
32. ✅ `apps/web/app/drafts/page.tsx` - Drafts list
33. ✅ `apps/web/app/drafts/workspace/[docId]/page.tsx` - Draft workspace
34. ✅ `apps/web/app/futuristic-contracts/page.tsx` - Futuristic demo
35. ✅ `apps/web/app/integration-demo/page.tsx` - Integration demo
36. ✅ `apps/web/app/jobs/[id]/page.tsx` - Job details
37. ✅ `apps/web/app/mvp/page.tsx` - MVP demo
38. ✅ `apps/web/app/pilot-demo/page.tsx` - Pilot demo
39. ✅ `apps/web/app/processing-status/page.tsx` - Processing status
40. ✅ `apps/web/app/risk/page.tsx` - Risk overview
41. ✅ `apps/web/app/runs/page.tsx` - Runs list
42. ✅ `apps/web/app/runs/[runId]/page.tsx` - Run details
43. ✅ `apps/web/app/search/page.tsx` - Search
44. ✅ `apps/web/app/search/advanced/page.tsx` - Advanced search
45. ✅ `apps/web/app/settings/page.tsx` - Settings
46. ✅ `apps/web/app/suppliers/page.tsx` - Suppliers
47. ✅ `apps/web/app/system/page.tsx` - System overview
48. ✅ `apps/web/app/ui-showcase/page.tsx` - UI showcase
49. ✅ `apps/web/app/upload/page.tsx` - Upload

## TypeScript Compilation Status

```bash
✅ All TypeScript files compile without errors
```

## Common Issues to Check

### Runtime Issues (Not TypeScript)

The error "Cannot read properties of undefined (reading 'call')" is a **runtime error**, not a compile-time error. This means:

1. **TypeScript compilation passes** ✅
2. **The error occurs when the page runs** ⚠️
3. **Likely causes**:
   - Missing prop passed to a component
   - Undefined function being called
   - Missing import or export
   - Incorrect usage of hooks or context

### Pages with Potential Runtime Issues

Based on the error stack trace showing `/app/contracts/page.tsx`, I need to check:

1. ✅ All imports are valid
2. ✅ All components are properly exported
3. ✅ All hooks are used correctly
4. ✅ All props are passed correctly

## Next Steps

### 1. Build Check

```bash
cd apps/web && npm run build
```

### 2. Run Development Server

```bash
cd apps/web && npm run dev
```

### 3. Test Each Page Route

- Navigate to each page
- Check browser console for errors
- Verify all interactive elements work

### 4. Common Patterns to Verify

#### ✅ All pages should have:

- Proper exports: `export default function PageName()`
- Client directive if needed: `'use client'`
- Proper imports for all components
- Valid TypeScript types

#### ✅ Client components must:

- Have `'use client'` directive
- Not use server-only features
- Handle loading states
- Handle error states

## Testing Strategy

### Phase 1: Static Analysis ✅ COMPLETE

- TypeScript compilation
- ESLint checks
- Import validation

### Phase 2: Build Test (NEXT)

- Production build
- Check for build errors
- Verify all routes

### Phase 3: Runtime Test (NEXT)

- Start dev server
- Navigate to each page
- Check console for errors
- Test interactive features

### Phase 4: Integration Test (NEXT)

- Test page transitions
- Test data fetching
- Test form submissions
- Test error boundaries

## Results Summary

### Static Checks: ✅ PASS

- All TypeScript files compile
- No syntax errors
- All imports resolve

### Build Check: 🔄 PENDING

### Runtime Check: 🔄 PENDING

### Integration Check: 🔄 PENDING

---

## Notes

- All smart quote issues have been fixed
- JSX file extensions corrected
- React imports added where needed
- Ready for build and runtime testing
