# Design Document

## Overview

This design consolidates procurement intelligence features by leveraging the extensive existing infrastructure discovered in the repository audit. The system already has:

- **Complete Backend Services**: 40+ services including analytical engines, rate card intelligence, and data orchestration
- **Comprehensive Database Schema**: Enhanced rate card tables with line-of-service, seniority, geographic, and skill taxonomies
- **Existing API Routes**: Analytics endpoints under `/api/analytics/intelligence/`

**The consolidation focuses on:**
1. Adding a mock data layer for demo purposes
2. Unifying duplicate frontend components and routes
3. Creating a data provider pattern to seamlessly switch between real and mock data
4. Cleaning up redundant code in `/app/use-cases/` and `/components/use-cases/`

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  /analytics/rate-benchmarking                               │
│  /analytics/suppliers                                        │
│  /analytics/negotiation                                      │
│  /analytics/savings                                          │
│  /analytics/renewals                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                     API Layer                                │
│  /api/analytics/rate-benchmarking/*                         │
│  /api/analytics/suppliers/*                                 │
│  /api/analytics/negotiation/*                               │
│  /api/analytics/savings/*                                   │
│  /api/analytics/renewals/*                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Service Layer                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Provider Pattern (Real/Mock Toggle)            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Rate Card    │  │  Supplier    │  │  Negotiation │    │
│  │ Service      │  │  Service     │  │  Service     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │  Savings     │  │  Renewal     │                       │
│  │  Service     │  │  Service     │                       │
│  └──────────────┘  └──────────────┘                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Real Data    │  │  Mock Data   │  │  Cache       │    │
│  │ Providers    │  │  Providers   │  │  Layer       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                Database & Storage                            │
│  - RateCard & RateCardEntry tables                          │
│  - Contract & ContractArtifact tables                       │
│  - Analytical Intelligence tables                           │
│  - Mock data JSON files                                     │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Data Provider Pattern

```typescript
// Core interface for all data providers
interface IDataProvider<T> {
  mode: 'real' | 'mock';
  isAvailable(): Promise<boolean>;
  getData(params: any): Promise<T>;
  getMetadata(): DataSourceMetadata;
}

interface DataSourceMetadata {
  source: 'database' | 'mock' | 'hybrid';
  lastUpdated: Date;
  recordCount: number;
  confidence: number;
}

// Factory for creating appropriate provider
class DataProviderFactory {
  static create<T>(
    feature: string,
    mode: 'real' | 'mock' | 'auto'
  ): IDataProvider<T> {
    if (mode === 'mock' || (mode === 'auto' && !hasRealData())) {
      return new MockDataProvider<T>(feature);
    }
    return new RealDataProvider<T>(feature);
  }
}
```

### 2. Rate Card Benchmarking Service

```typescript
interface RateCardBenchmarkingService {
  // Get market rates for a role/location
  getMarketRates(params: {
    role: string;
    level: string;
    location: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<MarketRateData>;

  // Get historical trends
  getRateTrends(params: {
    role: string;
    timeframe: '3m' | '6m' | '12m';
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<RateTrendData>;

  // Compare against benchmarks
  compareToBenchmark(params: {
    currentRate: number;
    role: string;
    location: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<BenchmarkComparison>;

  // Get geographic rate distribution
  getGeographicRates(params: {
    role: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<GeographicRateData[]>;
}

interface MarketRateData {
  role: string;
  location: string;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  average: number;
  sampleSize: number;
  metadata: DataSourceMetadata;
}
```

### 3. Supplier Analytics Service

```typescript
interface SupplierAnalyticsService {
  // Get supplier overview
  getSupplierOverview(params: {
    supplierId?: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<SupplierOverview[]>;

  // Get detailed supplier metrics
  getSupplierMetrics(params: {
    supplierId: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<SupplierMetrics>;

  // Compare suppliers
  compareSuppliers(params: {
    supplierIds: string[];
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<SupplierComparison>;

  // Get supplier performance trends
  getPerformanceTrends(params: {
    supplierId: string;
    timeframe: '3m' | '6m' | '12m';
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<PerformanceTrendData>;
}

interface SupplierMetrics {
  supplierId: string;
  supplierName: string;
  financialHealth: {
    score: number;
    creditRating: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  performance: {
    deliveryScore: number;
    qualityScore: number;
    responsivenessScore: number;
    overallScore: number;
  };
  contractMetrics: {
    totalValue: number;
    activeContracts: number;
    averageContractValue: number;
    relationshipDuration: number;
  };
  metadata: DataSourceMetadata;
}
```

### 4. Negotiation Preparation Service

```typescript
interface NegotiationPreparationService {
  // Generate negotiation pack
  generateNegotiationPack(params: {
    contractId?: string;
    role: string;
    currentRate: number;
    supplier: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<NegotiationPack>;

  // Get negotiation scenarios
  getScenarios(params: {
    currentRate: number;
    marketRate: number;
    relationshipYears: number;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<NegotiationScenario[]>;

  // Generate talking points
  generateTalkingPoints(params: {
    scenario: 'conservative' | 'moderate' | 'aggressive';
    leverage: NegotiationLeverage;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<string[]>;

  // Calculate negotiation leverage
  calculateLeverage(params: {
    volume: number;
    relationshipYears: number;
    performanceScore: number;
    alternatives: number;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<NegotiationLeverage>;
}

interface NegotiationPack {
  summary: {
    currentRate: number;
    targetRate: number;
    potentialSavings: number;
    confidence: number;
  };
  marketIntelligence: MarketRateData;
  supplierMetrics: SupplierMetrics;
  scenarios: NegotiationScenario[];
  talkingPoints: string[];
  leverage: NegotiationLeverage;
  metadata: DataSourceMetadata;
}
```

### 5. Savings Pipeline Service

```typescript
interface SavingsPipelineService {
  // Get pipeline overview
  getPipelineOverview(params: {
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<SavingsPipelineOverview>;

  // Get opportunities by stage
  getOpportunitiesByStage(params: {
    stage: 'identified' | 'in_progress' | 'realized';
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<SavingsOpportunity[]>;

  // Create savings opportunity
  createOpportunity(params: {
    title: string;
    category: string;
    value: number;
    probability: number;
    targetDate: Date;
    contractId?: string;
  }): Promise<SavingsOpportunity>;

  // Update opportunity progress
  updateOpportunity(params: {
    opportunityId: string;
    progress: number;
    status: string;
    notes?: string;
  }): Promise<SavingsOpportunity>;

  // Calculate ROI
  calculateROI(params: {
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<ROIMetrics>;
}

interface SavingsPipelineOverview {
  summary: {
    totalIdentified: number;
    totalInProgress: number;
    totalRealized: number;
    conversionRate: number;
  };
  byCategory: CategoryBreakdown[];
  timeline: TimelineData[];
  opportunities: SavingsOpportunity[];
  metadata: DataSourceMetadata;
}
```

### 6. Renewal Radar Service

```typescript
interface RenewalRadarService {
  // Get upcoming renewals
  getUpcomingRenewals(params: {
    daysAhead: 30 | 60 | 90;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<RenewalContract[]>;

  // Get renewal alerts
  getAlerts(params: {
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<RenewalAlert[]>;

  // Generate renewal pack
  generateRenewalPack(params: {
    contractId: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<RenewalPack>;

  // Detect auto-renewal clauses
  detectAutoRenewal(params: {
    contractId: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<AutoRenewalInfo>;

  // Calculate savings opportunity
  calculateRenewalSavings(params: {
    contractId: string;
    mode?: 'real' | 'mock' | 'auto';
  }): Promise<RenewalSavingsOpportunity>;
}

interface RenewalContract {
  contractId: string;
  contractName: string;
  supplier: string;
  value: number;
  endDate: Date;
  daysRemaining: number;
  autoRenewal: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  savingsOpportunity: number;
  metadata: DataSourceMetadata;
}
```

## Data Models

### Database Schema Extensions

```sql
-- Savings opportunities tracking
CREATE TABLE IF NOT EXISTS savings_opportunities (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,
  value DECIMAL(15, 2) NOT NULL,
  probability INT NOT NULL,
  expected_value DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  progress INT DEFAULT 0,
  target_date DATE,
  contract_id VARCHAR(255),
  owner VARCHAR(255),
  next_steps TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

-- Renewal tracking
CREATE TABLE IF NOT EXISTS renewal_tracking (
  id VARCHAR(255) PRIMARY KEY,
  contract_id VARCHAR(255) NOT NULL,
  renewal_date DATE NOT NULL,
  notification_sent_90 BOOLEAN DEFAULT FALSE,
  notification_sent_60 BOOLEAN DEFAULT FALSE,
  notification_sent_30 BOOLEAN DEFAULT FALSE,
  auto_renewal_detected BOOLEAN DEFAULT FALSE,
  savings_opportunity DECIMAL(15, 2),
  negotiation_pack_generated BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  UNIQUE KEY unique_contract_renewal (contract_id, renewal_date)
);

-- Supplier performance tracking
CREATE TABLE IF NOT EXISTS supplier_performance (
  id VARCHAR(255) PRIMARY KEY,
  supplier_name VARCHAR(500) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  delivery_score DECIMAL(5, 2),
  quality_score DECIMAL(5, 2),
  responsiveness_score DECIMAL(5, 2),
  overall_score DECIMAL(5, 2),
  contract_count INT DEFAULT 0,
  total_value DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_supplier_period (supplier_name, period_start, period_end)
);
```

### Mock Data Structure

```typescript
// Mock data files location: apps/web/lib/mock-data/

interface MockDataRegistry {
  rateCards: {
    roles: RoleRateData[];
    trends: TrendData[];
    geographic: GeographicData[];
  };
  suppliers: {
    overview: SupplierOverview[];
    metrics: Record<string, SupplierMetrics>;
    performance: Record<string, PerformanceTrendData>;
  };
  negotiations: {
    scenarios: NegotiationScenario[];
    leverage: LeverageData[];
    talkingPoints: Record<string, string[]>;
  };
  savings: {
    opportunities: SavingsOpportunity[];
    pipeline: SavingsPipelineOverview;
    roi: ROIMetrics;
  };
  renewals: {
    contracts: RenewalContract[];
    alerts: RenewalAlert[];
    packs: Record<string, RenewalPack>;
  };
}
```

## Error Handling

### Error Types

```typescript
class ProcurementIntelligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public feature: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ProcurementIntelligenceError';
  }
}

// Specific error types
class DataUnavailableError extends ProcurementIntelligenceError {
  constructor(feature: string) {
    super(
      `Real data unavailable for ${feature}, falling back to mock data`,
      'DATA_UNAVAILABLE',
      feature,
      true
    );
  }
}

class InvalidModeError extends ProcurementIntelligenceError {
  constructor(mode: string) {
    super(
      `Invalid data mode: ${mode}. Must be 'real', 'mock', or 'auto'`,
      'INVALID_MODE',
      'system',
      false
    );
  }
}
```

### Fallback Strategy

```typescript
class DataFallbackHandler {
  async getData<T>(
    provider: IDataProvider<T>,
    fallbackProvider: IDataProvider<T>,
    params: any
  ): Promise<{ data: T; metadata: DataSourceMetadata }> {
    try {
      const data = await provider.getData(params);
      return {
        data,
        metadata: provider.getMetadata()
      };
    } catch (error) {
      console.warn(`Primary provider failed, using fallback:`, error);
      const data = await fallbackProvider.getData(params);
      return {
        data,
        metadata: {
          ...fallbackProvider.getMetadata(),
          source: 'mock',
          warning: 'Using fallback data due to primary source failure'
        }
      };
    }
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('RateCardBenchmarkingService', () => {
  it('should use real data when available', async () => {
    const service = new RateCardBenchmarkingService('real');
    const result = await service.getMarketRates({
      role: 'Software Engineer',
      level: 'Senior',
      location: 'Zurich'
    });
    expect(result.metadata.source).toBe('database');
  });

  it('should fallback to mock data when real data unavailable', async () => {
    const service = new RateCardBenchmarkingService('auto');
    // Simulate database unavailable
    const result = await service.getMarketRates({
      role: 'Software Engineer',
      level: 'Senior',
      location: 'Zurich'
    });
    expect(result.metadata.source).toBe('mock');
  });

  it('should respect explicit mock mode', async () => {
    const service = new RateCardBenchmarkingService('mock');
    const result = await service.getMarketRates({
      role: 'Software Engineer',
      level: 'Senior',
      location: 'Zurich'
    });
    expect(result.metadata.source).toBe('mock');
  });
});
```

### Integration Tests

```typescript
describe('Cross-Feature Integration', () => {
  it('should create savings opportunity from rate benchmarking', async () => {
    const rateSvc = new RateCardBenchmarkingService('real');
    const savingsSvc = new SavingsPipelineService('real');

    const benchmark = await rateSvc.compareToBenchmark({
      currentRate: 1200,
      role: 'Software Engineer',
      location: 'Zurich'
    });

    if (benchmark.variance > 10) {
      const opportunity = await savingsSvc.createOpportunity({
        title: 'Rate optimization opportunity',
        category: 'Rate Benchmarking',
        value: benchmark.potentialSavings,
        probability: 75,
        targetDate: new Date()
      });

      expect(opportunity.id).toBeDefined();
      expect(opportunity.value).toBe(benchmark.potentialSavings);
    }
  });
});
```

## Migration Plan

### Phase 1: Create New Structure (Week 1)

1. Create new service layer with data provider pattern
2. Implement real data providers for each feature
3. Implement mock data providers for each feature
4. Create new API routes under `/api/analytics/*`
5. Create new page routes under `/analytics/*`

### Phase 2: Migrate Components (Week 2)

1. Create unified components in `/components/analytics/*`
2. Migrate rate benchmarking components
3. Migrate supplier analytics components
4. Migrate negotiation prep components
5. Migrate savings pipeline components
6. Migrate renewal radar components

### Phase 3: Integration & Testing (Week 3)

1. Implement cross-feature data flow
2. Add comprehensive unit tests
3. Add integration tests
4. Performance testing with real data
5. UI/UX testing in both modes

### Phase 4: Cleanup & Documentation (Week 4)

1. Remove duplicate code from `/components/use-cases/*`
2. Remove duplicate pages from `/app/use-cases/*`
3. Add redirects from old routes to new routes
4. Update documentation
5. Create migration guide for users

## Performance Considerations

### Caching Strategy

```typescript
class ProcurementDataCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: Record<string, number> = {
    rateCards: 3600000, // 1 hour
    suppliers: 1800000, // 30 minutes
    negotiations: 300000, // 5 minutes
    savings: 600000, // 10 minutes
    renewals: 3600000 // 1 hour
  };

  async get<T>(key: string, feature: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttl[feature]) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

### Query Optimization

- Use database indexes on frequently queried fields
- Implement pagination for large result sets
- Use aggregation queries instead of multiple individual queries
- Cache expensive calculations (percentiles, trends)
- Lazy load detailed data only when needed

## Security Considerations

- Validate all input parameters
- Implement rate limiting on API endpoints
- Ensure proper authentication/authorization
- Sanitize data before display
- Log all data access for audit trails
- Encrypt sensitive data in transit and at rest
