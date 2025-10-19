# Procurement Intelligence System

A comprehensive data provider system for procurement intelligence features with seamless switching between real and mock data sources.

## 🎯 Overview

The Procurement Intelligence System provides a unified interface for accessing procurement analytics data across 5 key modules:

1. **Rate Benchmarking** - Market rate analysis and comparisons
2. **Supplier Analytics** - Supplier performance and financial health
3. **Negotiation Prep** - Leverage points and negotiation strategies
4. **Savings Pipeline** - Savings opportunities and ROI tracking
5. **Renewal Radar** - Contract renewal tracking and alerts

## 🚀 Quick Start

### Using React Hooks

```tsx
import { useRateBenchmarking } from '@/hooks/useProcurementIntelligence';
import { DataModeToggle } from '@/components/analytics/DataModeToggle';

function MyComponent() {
  const [mode, setMode] = useState<'real' | 'mock'>('real');
  
  const { data, loading, error } = useRateBenchmarking({
    lineOfService: 'Software Development',
    seniority: 'Senior'
  }, mode);

  return (
    <div>
      <DataModeToggle currentMode={mode} onModeChange={setMode} />
      {data && <div>Average Rate: ${data.marketRates.average}/hr</div>}
    </div>
  );
}
```

### Using API Directly

```typescript
// Fetch data in mock mode
const response = await fetch(
  '/api/analytics/procurement-intelligence?module=rate-benchmarking&mode=mock'
);
const result = await response.json();
```

### Using Data Providers Directly

```typescript
import { getDataProviderFactory, DataMode } from '@/providers';

const factory = getDataProviderFactory();
const response = await factory.getData('rate-benchmarking', {
  lineOfService: 'Software Development'
}, DataMode.MOCK);
```

## 📚 Available Hooks

### Generic Hook
```typescript
useProcurementIntelligence({
  module: 'rate-benchmarking',
  params: { lineOfService: 'Software Development' },
  initialMode: 'real',
  autoFetch: true
})
```

### Specialized Hooks
- `useRateBenchmarking(params, mode)`
- `useSupplierAnalytics(params, mode)`
- `useNegotiationPrep(params, mode)`
- `useSavingsPipeline(params, mode)`
- `useRenewalRadar(params, mode)`
- `useProviderHealth()` - Monitor provider availability

## 🔌 API Endpoints

### Individual Module Endpoints

| Endpoint | Module |
|----------|--------|
| `/api/analytics/intelligence/rate-benchmarking` | Rate Benchmarking |
| `/api/analytics/suppliers` | Supplier Analytics |
| `/api/analytics/negotiation` | Negotiation Prep |
| `/api/analytics/savings` | Savings Pipeline |
| `/api/analytics/renewals` | Renewal Radar |

### Unified Endpoint

```
GET /api/analytics/procurement-intelligence?module=<module>&mode=<mode>&...params
```

**Query Parameters:**
- `module` (required): Module name
- `mode` (optional): Data mode (real, mock) - defaults to 'real'
- Additional module-specific parameters

### Health Check

```
POST /api/analytics/procurement-intelligence
Body: { "action": "health-check" }
```

## 📊 Data Modes

### Real Mode
- Live data from database
- Actual contract information
- Real-time analytics
- Production use

### Mock Mode
- Simulated test data
- Realistic scenarios
- No database dependencies
- Development and testing

### Fallback Mode
- Automatic fallback when primary source fails
- Static fallback data
- Circuit breaker protection
- High availability

## 🎨 Components

### DataModeToggle
Visual toggle for switching between data modes:

```tsx
<DataModeToggle
  currentMode={mode}
  onModeChange={setMode}
  showBadge={true}
/>
```

### DataModeIndicator
Compact indicator showing current mode:

```tsx
<DataModeIndicator mode="real" />
```

## 📝 Module Parameters

### Rate Benchmarking
```typescript
{
  lineOfService?: string;
  seniority?: string;
  geography?: string;
  currency?: string;
  dateRange?: { start: Date; end: Date };
}
```

### Supplier Analytics
```typescript
{
  supplierId?: string;
  timeframe?: string; // '6months', '12months', '24months'
  metrics?: string[];
}
```

### Negotiation Prep
```typescript
{
  contractId?: string;
  supplierId?: string;
  category?: string;
}
```

### Savings Pipeline
```typescript
{
  timeframe?: string;
  category?: string;
  status?: string; // 'identified', 'in_progress', 'realized', 'closed'
}
```

### Renewal Radar
```typescript
{
  timeframe?: string; // '3months', '6months', '12months'
  riskLevel?: string; // 'high', 'medium', 'low'
}
```

## 🧪 Testing

### Run Test Script
```bash
npm run test:procurement-intelligence
# or
ts-node scripts/test-procurement-intelligence.ts
```

### Manual Testing

```bash
# Test rate benchmarking in mock mode
curl "http://localhost:3000/api/analytics/procurement-intelligence?module=rate-benchmarking&mode=mock&lineOfService=Software%20Development"

# Check provider health
curl -X POST http://localhost:3000/api/analytics/procurement-intelligence \
  -H "Content-Type: application/json" \
  -d '{"action": "health-check"}'
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ React Hooks  │  │  Components  │  │  Pages       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  REST Endpoints (Next.js API Routes)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Provider Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Provider Factory                                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ Real       │  │ Mock       │  │ Fallback   │     │  │
│  │  │ Providers  │  │ Providers  │  │ Handler    │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Real Data Sources   │    │  Mock Data           │
│  - Database          │    │  - Generators        │
│  - Services          │    │  - Scenarios         │
│  - RAG System        │    │  - Test Data         │
└──────────────────────┘    └──────────────────────┘
```

## 🔧 Configuration

### Environment Variables
```bash
# Data mode configuration
PROCUREMENT_DATA_MODE=real|mock|fallback
PROCUREMENT_FALLBACK_ENABLED=true
PROCUREMENT_TIMEOUT_MS=30000
PROCUREMENT_RETRY_ATTEMPTS=3
```

### Factory Configuration
```typescript
const factory = DataProviderFactory.getInstance({
  preferredMode: DataMode.REAL,
  fallbackEnabled: true,
  timeout: 30000,
  retryAttempts: 3
});
```

## 📈 Response Format

All endpoints return a consistent structure:

```typescript
{
  success: boolean;
  data: T; // Module-specific data
  metadata: {
    source: string;
    mode: 'real' | 'mock' | 'fallback';
    lastUpdated: string;
    recordCount?: number;
    confidence?: number;
    description?: string;
  };
  timestamp: string;
}
```

## 🛡️ Error Handling

The system includes comprehensive error handling:

- **Circuit Breaker**: Prevents cascading failures
- **Retry Logic**: Exponential backoff for transient errors
- **Fallback Strategy**: Automatic fallback to alternative sources
- **Typed Errors**: Custom error classes for different scenarios

### Error Types
- `DataUnavailableError` - Data source unavailable
- `InvalidModeError` - Invalid mode specified
- `TimeoutError` - Operation timeout
- `CircuitBreakerError` - Circuit breaker open
- `ServiceHealthError` - Service health check failed

## 📊 Monitoring

### Health Check
```typescript
const { health, loading, error } = useProviderHealth();

// Returns:
// {
//   'rate-benchmarking': { real: true, mock: true },
//   'supplier-analytics': { real: true, mock: true },
//   ...
// }
```

### Metadata
Every response includes metadata about the data source:
- Source identifier
- Data mode used
- Last updated timestamp
- Record count
- Confidence score

## 🎯 Use Cases

### Development
- Use mock mode for rapid development
- No database setup required
- Predictable test data
- Fast iteration cycles

### Testing
- Automated tests with mock data
- Integration tests with real data
- Performance testing
- Edge case simulation

### Production
- Real mode for live data
- Automatic fallback for reliability
- Health monitoring
- Performance tracking

## 📦 File Structure

```
apps/web/
├── app/api/analytics/
│   ├── intelligence/rate-benchmarking/route.ts
│   ├── suppliers/route.ts
│   ├── negotiation/route.ts
│   ├── savings/route.ts
│   ├── renewals/route.ts
│   └── procurement-intelligence/route.ts
├── components/analytics/
│   └── DataModeToggle.tsx
├── hooks/
│   └── useProcurementIntelligence.ts
└── lib/mock-data/
    ├── rate-benchmarking-mock.ts
    ├── supplier-analytics-mock.ts
    ├── negotiation-prep-mock.ts
    ├── savings-pipeline-mock.ts
    └── renewal-radar-mock.ts

packages/data-orchestration/src/
├── types/
│   └── data-provider.types.ts
├── providers/
│   ├── base-data-provider.ts
│   ├── data-provider-factory.ts
│   ├── data-fallback-handler.ts
│   ├── rate-benchmarking-providers.ts
│   ├── supplier-analytics-providers.ts
│   ├── negotiation-prep-providers.ts
│   ├── savings-pipeline-providers.ts
│   └── renewal-radar-providers.ts
└── errors/
    └── procurement-intelligence-error.ts
```

## 🚦 Status

- ✅ Phase 1: Core Infrastructure - Complete
- ✅ Phase 2: API Layer & React Integration - Complete
- 🔄 Phase 3: Frontend Consolidation - In Progress

## 📖 Documentation

- [Phase 1 Complete](./PROCUREMENT_INTELLIGENCE_PHASE1_COMPLETE.md)
- [Phase 2 Complete](./PROCUREMENT_INTELLIGENCE_PHASE2_COMPLETE.md)
- [Design Document](./.kiro/specs/procurement-intelligence-consolidation/design.md)
- [Requirements](./.kiro/specs/procurement-intelligence-consolidation/requirements.md)

## 🤝 Contributing

When adding new modules:

1. Create mock data generator in `apps/web/lib/mock-data/`
2. Create real and mock providers in `packages/data-orchestration/src/providers/`
3. Register providers in factory
4. Create API endpoint
5. Add specialized hook
6. Update documentation

## 📝 License

[Your License Here]

---

**Built with ❤️ for efficient procurement intelligence**
