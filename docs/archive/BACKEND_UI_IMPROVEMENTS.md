# Backend & UI Integration Improvements

## Overview

This document summarizes the improvements made to integrate the frontend with backend APIs, eliminating static mock data and enabling real-time data fetching.

---

## New Files Created

### 1. `/apps/web/hooks/useApiData.ts`

Generic API data fetching hooks with built-in caching, refresh, and error handling.

**Exports:**

- `useApiData<T>` - Generic hook for fetching any API endpoint
- `useMutation<T,V>` - Hook for POST/PUT/DELETE operations
- `useDashboardStats` - Pre-configured hook for `/api/dashboard/stats`
- `useApprovals` - Pre-configured hook for `/api/approvals`
- `useRenewals` - Pre-configured hook for `/api/renewals`
- `useGovernance` - Pre-configured hook for `/api/governance`
- `useContractHealth` - Pre-configured hook for `/api/intelligence/health`
- `useForecast` - Pre-configured hook for `/api/forecast`

**Features:**

- AbortController for request cancellation
- Configurable refresh intervals
- isStale tracking for cache invalidation
- Error state management
- Loading states

### 2. `/apps/web/app/api/intelligence/route.ts`

Intelligence hub summary endpoint.

**GET Response:**

```json
{
  "healthScores": { "healthy": 18, "atRisk": 4, "critical": 2, "averageScore": 72 },
  "insights": [...],
  "recentActivity": [...],
  "aiCapabilities": { "semanticSearch": true, "riskPrediction": true, ... }
}
```

**POST Actions:**

- `refresh-scores` - Recalculate health scores
- `dismiss-insight` - Dismiss an AI insight
- `act-on-insight` - Take action on an insight

### 3. `/apps/web/app/api/dashboard/widgets/route.ts`

Aggregated widget data endpoint for efficient dashboard loading.

**GET Response:**

```json
{
  "approvals": { "pending": 4, "urgent": 1, "change": 2 },
  "renewals": { "upcoming": 5, "urgent": 1, "value": 2450000 },
  "intelligence": { "healthScore": 72, "alertCount": 6, "criticalCount": 2 },
  "governance": { "complianceScore": 94, "violations": 3, "pendingReviews": 7 },
  "contracts": { "active": 24, "processing": 3, "change": 3 }
}
```

---

## Files Updated

### 1. `/apps/web/components/dashboard/CrossModuleWidgets.tsx`

**Changes:**

- Added `WidgetSkeleton` loading component with color variants
- **IntelligenceWidget**: Now fetches from `/api/intelligence/health`
- **ApprovalsWidget**: Now fetches from `/api/approvals`
- **RenewalsWidget**: Now fetches from `/api/renewals`
- **GovernanceWidget**: Now fetches from `/api/governance`
- **QuickStatsRow**: Now fetches from `/api/dashboard/widgets`

**Loading States:**
All widgets now show animated skeleton loaders while data is being fetched.

**Error Handling:**
Graceful fallback to sensible defaults if API calls fail.

### 2. `/apps/web/components/dashboard/ProfessionalDashboard.tsx`

**Changes:**

- Added `useDashboardData()` hook that fetches from multiple APIs:
  - `/api/dashboard/stats` - Main dashboard statistics
  - `/api/approvals?limit=5` - Recent approvals
  - `/api/renewals?limit=3` - Upcoming renewals
- Maps API responses to dashboard metrics
- Maintains mock data as fallback for API failures

---

## API Integration Pattern

All widgets follow a consistent pattern:

```tsx
function Widget({ initialData }: WidgetProps) {
  const [data, setData] = useState(initialData ?? defaults);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return;
    
    async function fetchData() {
      try {
        const res = await fetch('/api/endpoint');
        const json = await res.json();
        if (json.success) {
          setData(mapApiToState(json.data));
        }
      } catch (err) {
        // Keep defaults on error
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialData]);

  if (loading) return <WidgetSkeleton />;
  
  return <WidgetUI data={data} />;
}
```

---

## Benefits

1. **Real Data**: Widgets now display actual data from the database when available
2. **Loading States**: Users see smooth skeleton animations while data loads
3. **Error Resilience**: Graceful fallback to defaults prevents broken UIs
4. **Server Rendering Ready**: Can pass initial data from server for SSR
5. **Reduced API Calls**: Aggregated `/api/dashboard/widgets` endpoint
6. **Consistent UX**: All widgets use same loading/error patterns

---

## Testing

Verify the APIs are working:

```bash
# Dashboard stats
curl http://localhost:3005/api/dashboard/stats

# Aggregated widget data
curl http://localhost:3005/api/dashboard/widgets

# Intelligence summary
curl http://localhost:3005/api/intelligence

# Approvals
curl http://localhost:3005/api/approvals

# Renewals
curl http://localhost:3005/api/renewals

# Governance
curl http://localhost:3005/api/governance
```

---

## Future Improvements

1. **Add SWR or React Query**: Replace custom hooks with a mature caching library
2. **WebSocket Updates**: Real-time data push instead of polling
3. **Optimistic Updates**: Update UI immediately on mutations
4. **Request Deduplication**: Prevent duplicate requests for same data
5. **Stale-While-Revalidate**: Show cached data while fetching fresh data

