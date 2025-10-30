# Quick Start: Event-Driven Data Flow

## 🚀 5-Minute Integration Guide

### Step 1: Add Events to Your Service (2 minutes)

```typescript
// In any service file
import { contractEvents, rateCardEvents } from '@/../../packages/data-orchestration/src/services/event-integration.helper';

// When you create/update data, just add one line:
async function updateContract(id: string, data: any) {
  const updated = await db.update(id, data);
  
  // 👇 Add this line - that's it!
  await contractEvents.updated(id, 'demo', data);
  
  return updated;
}
```

**What happens automatically:**
- ✅ Event emitted to all listeners
- ✅ Cache invalidated (contracts, analytics)
- ✅ Downstream services triggered
- ✅ Real-time UI updates sent

### Step 2: Add Real-Time Updates to Your Component (2 minutes)

```typescript
// In any React component
'use client';

import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';

export function MyComponent() {
  const [data, setData] = useState([]);
  
  // 👇 Add this hook - that's it!
  useRealTimeUpdates({
    onContractUpdated: (event) => {
      // Refresh your data
      refetch();
    },
    showToasts: true,
    autoRefresh: true
  });
  
  return <div>{/* your UI */}</div>;
}
```

**What happens automatically:**
- ✅ Connects to SSE endpoint
- ✅ Receives real-time events
- ✅ Shows toast notifications
- ✅ Auto-refreshes data
- ✅ Handles reconnection

### Step 3: Test It (1 minute)

1. Start your dev server
2. Open browser console
3. Make a change (edit contract, rate card, etc.)
4. Watch the magic:
   - Console shows: `[EventOrchestrator] Contract updated, triggering recalculations`
   - Toast appears: "Contract updated"
   - UI refreshes automatically
   - No polling, no manual refresh needed!

---

## 📋 Common Patterns

### Pattern 1: Service with Events

```typescript
import { rateCardEvents } from './event-integration.helper';

class MyService {
  async createRateCard(data: any) {
    const rateCard = await db.create(data);
    
    // Emit event with automatic cache invalidation
    await rateCardEvents.created(rateCard.id, data, 'demo');
    
    return rateCard;
  }
  
  async updateRateCard(id: string, data: any) {
    const updated = await db.update(id, data);
    
    // Triggers: benchmark recalc, opportunity analysis, cache clear
    await rateCardEvents.updated(id, data, 'demo');
    
    return updated;
  }
}
```

### Pattern 2: Component with Real-Time Updates

```typescript
'use client';

export function RateCardList() {
  const [rateCards, setRateCards] = useState([]);
  
  useRealTimeUpdates({
    // Handle specific events
    onRateCardCreated: (event) => {
      setRateCards(prev => [...prev, event.data]);
    },
    
    onRateCardUpdated: (event) => {
      setRateCards(prev => 
        prev.map(rc => 
          rc.id === event.data.id ? { ...rc, ...event.data } : rc
        )
      );
    },
    
    // Show notifications
    showToasts: true
  });
  
  return <div>{/* render rate cards */}</div>;
}
```

### Pattern 3: Listen to Specific Entity

```typescript
import { useEntityUpdates } from '@/hooks/useRealTimeUpdates';

export function ContractDetail({ contractId }: { contractId: string }) {
  const [contract, setContract] = useState(null);
  
  // Auto-refresh when THIS specific contract updates
  useEntityUpdates('contract', contractId, async () => {
    const fresh = await fetchContract(contractId);
    setContract(fresh);
  });
  
  return <div>{/* render contract */}</div>;
}
```

---

## 🎯 Available Event Helpers

### Contract Events
```typescript
import { contractEvents } from './event-integration.helper';

await contractEvents.created(contractId, tenantId, contract);
await contractEvents.updated(contractId, tenantId, changes);
await contractEvents.metadataUpdated(contractId, tenantId, changes);
await contractEvents.processingCompleted(contractId, tenantId);
```

### Rate Card Events
```typescript
import { rateCardEvents } from './event-integration.helper';

await rateCardEvents.created(id, data, tenantId);
await rateCardEvents.updated(id, data, tenantId);
await rateCardEvents.imported(count, tenantId, source);
await rateCardEvents.extracted(rateCardId, artifactId, contractId, tenantId);
```

### Artifact Events
```typescript
import { artifactEvents } from './event-integration.helper';

await artifactEvents.generated(artifactId, contractId, type, tenantId);
await artifactEvents.updated(artifactId, contractId, changes, tenantId);
```

### Benchmark Events
```typescript
import { benchmarkEvents } from './event-integration.helper';

await benchmarkEvents.calculated(benchmarkId, type, sourceRateCards, tenantId);
await benchmarkEvents.invalidated(tenantId, reason);
```

---

## 🔍 Debugging

### Check Event Flow
```typescript
// In browser console
window.addEventListener('contract:refresh', (e) => {
  console.log('Contract refresh triggered:', e.detail);
});
```

### Check SSE Connection
```typescript
// In your component
const { isConnected, lastEvent } = useRealTimeUpdates();

console.log('Connected:', isConnected);
console.log('Last event:', lastEvent);
```

### Check Cache Stats
```typescript
import { cacheInvalidationService } from './cache-invalidation.service';

const stats = cacheInvalidationService.getStats();
console.log('Cache stats:', stats);
```

### Check Lineage
```typescript
import { dataLineageTracker } from '../lineage/data-lineage';

const impact = dataLineageTracker.getImpactAnalysis('contract', contractId);
console.log('What will be affected:', impact);
```

---

## ✅ Checklist

**Backend Integration:**
- [ ] Import event helpers in your service
- [ ] Add event emissions after data changes
- [ ] Test events are firing (check console)

**Frontend Integration:**
- [ ] Add `useRealTimeUpdates` hook to components
- [ ] Handle specific events you care about
- [ ] Test real-time updates work

**Verification:**
- [ ] Make a change, see toast notification
- [ ] Check data refreshes automatically
- [ ] Verify no polling in network tab
- [ ] Check cache invalidates properly

---

## 🎉 You're Done!

Your app now has:
- ✅ Event-driven architecture
- ✅ Automatic cache invalidation
- ✅ Real-time UI updates
- ✅ Data lineage tracking
- ✅ Coordinated workflows

**No more:**
- ❌ Manual cache clearing
- ❌ Polling for updates
- ❌ Stale data
- ❌ Manual triggers
- ❌ Disconnected services

Everything flows automatically!
