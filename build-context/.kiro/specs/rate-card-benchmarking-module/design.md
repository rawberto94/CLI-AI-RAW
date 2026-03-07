# Design Document

## Overview

The Rate Card Benchmarking Module is a comprehensive procurement intelligence system that transforms how organizations manage and optimize consultant/contractor rates. The system leverages existing database schema (RateCardEntry, RateCardSupplier, BenchmarkSnapshot, etc.) and builds upon established services (RateCardBenchmarkingEngine, BaselineManagementService) to create a complete end-to-end solution.

The module integrates seamlessly with the existing contract processing pipeline, extracting rates automatically from uploaded contracts while also supporting manual entry and bulk CSV uploads. It provides real-time benchmarking, market intelligence, and AI-powered negotiation assistance to drive procurement savings.

**Key Innovation**: Unlike traditional rate card systems that simply store data, this module provides actionable intelligence through automated benchmarking, savings opportunity detection, and AI-powered negotiation recommendations.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Rate Card Benchmarking Module                │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │ Ingestion│              │Analytics│              │   UI    │
   │  Layer   │              │ Engine  │              │  Layer  │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                         │                         │
   ┌────▼────────────┐      ┌────▼────────────┐      ┌────▼────────────┐
   │ • PDF Extract   │      │ • Benchmarking  │      │ • Dashboard     │
   │ • Manual Entry  │      │ • Market Intel  │      │ • Entry Forms   │
   │ • CSV Upload    │      │ • Savings Detect│      │ • Comparison    │
   │ • API Import    │      │ • Trend Analysis│      │ • Reports       │
   └─────────────────┘      └─────────────────┘      └─────────────────┘
                                  │
                         ┌────────▼────────┐
                         │  Database Layer │
                         │  (Prisma/Postgres)│
                         └─────────────────┘
```

### Data Flow Architecture

```
Contract Upload → Text Extraction → AI Rate Extraction → Role Standardization
                                                                │
                                                                ▼
Manual Entry → Form Validation → Currency Conversion → Rate Card Entry
                                                                │
                                                                ▼
CSV Upload → Parsing → Validation → Batch Processing → Rate Card Entry
                                                                │
                                                                ▼
                                                    ┌───────────┴───────────┐
                                                    │                       │
                                              Benchmark                Baseline
                                              Calculation              Comparison
                                                    │                       │
                                                    ▼                       ▼
                                              Market Position         Variance
                                              Savings Analysis        Analysis
                                                    │                       │
                                                    └───────────┬───────────┘
                                                                │
                                                                ▼
                                                    Savings Opportunity
                                                        Detection
                                                                │
                                                                ▼
                                                        Dashboard & Reports
```

### Integration Points

1. **Contract Processing Pipeline**
   - Hooks into existing contract upload flow
   - Triggers rate extraction after text extraction
   - Links rate cards to source contracts

2. **Artifact System**
   - Rate cards can be generated as artifacts
   - Integrates with artifact versioning
   - Supports artifact editing workflow

3. **Analytics Hub**
   - Feeds data to procurement analytics
   - Provides savings metrics
   - Contributes to cost optimization dashboards

4. **Search & Discovery**
   - Rate cards indexed for full-text search
   - Semantic search across roles and suppliers
   - Quick filters and saved searches

## Components and Interfaces

### 1. Data Ingestion Components

#### 1.1 AI Rate Extraction Service

**Location**: `packages/data-orchestration/src/services/rate-card-extraction.service.ts`

```typescript
export class RateCardExtractionService {
  /**
   * Extract rate cards from contract text using GPT-4
   */
  async extractFromContract(
    contractId: string,
    contractText: string
  ): Promise<ExtractionResult>

  /**
   * Standardize role name using AI
   */
  async standardizeRole(
    roleOriginal: string,
    context?: RoleContext
  ): Promise<StandardizedRole>

  /**
   * Validate and enrich extracted data
   */
  async validateExtraction(
    extraction: ExtractionResult
  ): Promise<ValidationResult>
}

interface ExtractionResult {
  rates: ExtractedRate[];
  supplierInfo: SupplierInfo;
  contractContext: ContractContext;
  confidence: number;
  warnings: string[];
}

interface ExtractedRate {
  roleOriginal: string;
  roleStandardized: string;
  seniority: SeniorityLevel;
  dailyRate: number;
  currency: string;
  location: string;
  lineOfService: string;
  skills: string[];
  confidence: number;
}
```

#### 1.2 Manual Entry Service

**Location**: `packages/data-orchestration/src/services/rate-card-entry.service.ts`

```typescript
export class RateCardEntryService {
  /**
   * Create new rate card entry with validation
   */
  async createEntry(
    data: RateCardEntryInput,
    tenantId: string,
    userId: string
  ): Promise<RateCardEntry>

  /**
   * Update existing rate card entry
   */
  async updateEntry(
    id: string,
    data: Partial<RateCardEntryInput>
  ): Promise<RateCardEntry>

  /**
   * Get role suggestions based on input
   */
  async getRoleSuggestions(
    partial: string,
    tenantId: string
  ): Promise<RoleSuggestion[]>

  /**
   * Get supplier suggestions
   */
  async getSupplierSuggestions(
    partial: string,
    tenantId: string
  ): Promise<SupplierSuggestion[]>
}

interface RateCardEntryInput {
  source: RateCardSource;
  contractId?: string;
  
  // Supplier
  supplierName: string;
  supplierTier: SupplierTier;
  supplierCountry: string;
  
  // Role
  roleOriginal: string;
  roleStandardized?: string; // Auto-suggested
  seniority: SeniorityLevel;
  lineOfService: string;
  roleCategory: string;
  
  // Rate
  dailyRate: number;
  currency: string;
  
  // Geography
  country: string;
  region: string;
  city?: string;
  
  // Context
  effectiveDate: Date;
  expiryDate?: Date;
  volumeCommitted?: number;
  isNegotiated: boolean;
  negotiationNotes?: string;
  
  // Additional
  skills?: string[];
  certifications?: string[];
  additionalInfo?: any;
}
```

#### 1.3 Bulk Import Service

**Location**: `packages/data-orchestration/src/services/rate-card-bulk-import.service.ts`

```typescript
export class RateCardBulkImportService {
  /**
   * Parse and validate CSV file
   */
  async parseCSV(
    file: File,
    tenantId: string
  ): Promise<ParseResult>

  /**
   * Preview import with validation
   */
  async previewImport(
    data: ParsedRow[],
    tenantId: string
  ): Promise<ImportPreview>

  /**
   * Execute bulk import
   */
  async executeBulkImport(
    data: ParsedRow[],
    tenantId: string,
    userId: string,
    options: ImportOptions
  ): Promise<ImportResult>

  /**
   * Generate CSV template
   */
  generateTemplate(): string
}

interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

interface ImportPreview {
  validEntries: PreviewEntry[];
  invalidEntries: InvalidEntry[];
  duplicates: DuplicateEntry[];
  newSuppliers: string[];
  summary: ImportSummary;
}

interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  failed: number;
  errors: ImportError[];
  rateCardIds: string[];
}
```

### 2. Analytics Components

#### 2.1 Benchmarking Engine

**Location**: `packages/data-orchestration/src/services/rate-card-benchmarking.service.ts` (existing, enhanced)

```typescript
export class RateCardBenchmarkingEngine {
  /**
   * Calculate comprehensive benchmark for rate
   */
  async calculateBenchmark(
    rateCardEntryId: string
  ): Promise<BenchmarkResult>

  /**
   * Batch calculate benchmarks
   */
  async batchCalculateBenchmarks(
    rateCardIds: string[]
  ): Promise<BatchBenchmarkResult>

  /**
   * Get best rate for role-geography combination
   */
  async getBestRate(
    criteria: BestRateCriteria
  ): Promise<BestRateResult>

  /**
   * Calculate savings vs best rate
   */
  async calculateSavingsVsBest(
    rateCardEntryId: string
  ): Promise<SavingsVsBestResult>
}

interface BestRateCriteria {
  roleStandardized: string;
  seniority: SeniorityLevel;
  country: string;
  lineOfService?: string;
}

interface BestRateResult {
  bestRate: number;
  bestRateEntry: RateCardEntry;
  supplierName: string;
  effectiveDate: Date;
  cohortSize: number;
  confidence: number;
}

interface SavingsVsBestResult {
  currentRate: number;
  bestRate: number;
  dailySavings: number;
  savingsPercentage: number;
  annualSavings?: number;
  recommendation: string;
}
```

#### 2.2 Market Intelligence Service

**Location**: `packages/data-orchestration/src/services/market-intelligence.service.ts`

```typescript
export class MarketIntelligenceService {
  /**
   * Calculate market intelligence for segment
   */
  async calculateMarketIntelligence(
    criteria: MarketSegmentCriteria
  ): Promise<MarketIntelligence>

  /**
   * Get trending roles
   */
  async getTrendingRoles(
    tenantId: string,
    period: TimePeriod
  ): Promise<TrendingRole[]>

  /**
   * Get geographic rate comparison
   */
  async getGeographicComparison(
    role: string,
    seniority: SeniorityLevel,
    countries: string[]
  ): Promise<GeographicComparison>

  /**
   * Get supplier competitiveness ranking
   */
  async getSupplierRanking(
    tenantId: string,
    criteria?: RankingCriteria
  ): Promise<SupplierRanking[]>
}

interface MarketSegmentCriteria {
  roleStandardized: string;
  seniority: SeniorityLevel;
  country?: string;
  lineOfService?: string;
  periodMonths: number;
}

interface TrendingRole {
  role: string;
  seniority: SeniorityLevel;
  currentAverage: number;
  previousAverage: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  sampleSize: number;
}

interface GeographicComparison {
  role: string;
  seniority: SeniorityLevel;
  byCountry: Array<{
    country: string;
    averageRate: number;
    medianRate: number;
    sampleSize: number;
    percentDifference: number;
  }>;
  insights: string[];
}
```

#### 2.3 Savings Opportunity Service

**Location**: `packages/data-orchestration/src/services/savings-opportunity.service.ts`

```typescript
export class SavingsOpportunityService {
  /**
   * Detect all savings opportunities for tenant
   */
  async detectOpportunities(
    tenantId: string,
    options?: DetectionOptions
  ): Promise<SavingsOpportunity[]>

  /**
   * Get opportunity details with recommendations
   */
  async getOpportunityDetails(
    opportunityId: string
  ): Promise<OpportunityDetails>

  /**
   * Update opportunity status
   */
  async updateOpportunityStatus(
    opportunityId: string,
    status: OpportunityStatus,
    notes?: string
  ): Promise<void>

  /**
   * Track realized savings
   */
  async trackRealizedSavings(
    opportunityId: string,
    actualSavings: number
  ): Promise<void>
}

interface DetectionOptions {
  minSavingsAmount?: number;
  minSavingsPercent?: number;
  categories?: SavingsCategory[];
  maxRisk?: RiskLevel;
}

interface OpportunityDetails extends SavingsOpportunity {
  rateCardEntry: RateCardEntry;
  benchmarkData: BenchmarkSnapshot;
  alternativeSuppliers: SupplierOption[];
  negotiationBrief: NegotiationBrief;
  implementationPlan: ImplementationStep[];
}
```

#### 2.4 Negotiation Assistant Service

**Location**: `packages/data-orchestration/src/services/negotiation-assistant.service.ts`

```typescript
export class NegotiationAssistantService {
  /**
   * Generate negotiation brief for rate
   */
  async generateNegotiationBrief(
    rateCardEntryId: string
  ): Promise<NegotiationBrief>

  /**
   * Get talking points
   */
  async getTalkingPoints(
    rateCardEntryId: string
  ): Promise<TalkingPoint[]>

  /**
   * Suggest target rates
   */
  async suggestTargetRates(
    rateCardEntryId: string
  ): Promise<RateTargets>

  /**
   * Find alternative suppliers
   */
  async findAlternatives(
    rateCardEntryId: string
  ): Promise<SupplierAlternative[]>
}

interface NegotiationBrief {
  currentSituation: {
    currentRate: number;
    supplierName: string;
    contractExpiry?: Date;
    volumeCommitted?: number;
  };
  marketPosition: {
    percentileRank: number;
    position: string;
    marketMedian: number;
    marketP25: number;
  };
  targetRates: RateTargets;
  leverage: LeveragePoint[];
  alternatives: SupplierAlternative[];
  talkingPoints: TalkingPoint[];
  risks: NegotiationRisk[];
  recommendedStrategy: string;
}

interface RateTargets {
  aggressive: number;
  realistic: number;
  fallback: number;
  justification: string;
}

interface TalkingPoint {
  point: string;
  supportingData: string;
  impact: string;
  priority: number;
}
```

### 3. UI Components

#### 3.1 Dashboard Component

**Location**: `apps/web/components/rate-cards/RateCardDashboard.tsx`

```typescript
export function RateCardDashboard() {
  // KPI Cards
  - Total Rate Cards Tracked
  - Total Suppliers
  - Geographic Coverage
  - Service Line Coverage
  
  // Financial Metrics
  - Total Annual Spend
  - Total Savings Identified
  - Total Savings Realized
  - Average Rate vs Market
  
  // Charts
  - Rate Distribution by Role
  - Supplier Competitiveness
  - Savings Pipeline
  - Trend Analysis
  
  // Quick Actions
  - Add Rate Card
  - Upload CSV
  - Extract from Contract
  - View Opportunities
}
```

#### 3.2 Entry Form Component

**Location**: `apps/web/components/rate-cards/RateCardEntryForm.tsx`

```typescript
export function RateCardEntryForm({
  mode: 'create' | 'edit';
  initialData?: RateCardEntry;
  onSuccess: (entry: RateCardEntry) => void;
}) {
  // Form Sections
  1. Source Selection (Manual, Contract, Import)
  2. Supplier Information (with autocomplete)
  3. Role Information (original + standardized)
  4. Rate Information (with currency conversion)
  5. Geographic Information
  6. Contract Context
  7. Additional Details
  
  // Features
  - Real-time validation
  - AI role standardization
  - Currency conversion preview
  - Duplicate detection
  - Benchmark preview
}
```

#### 3.3 Comparison Tool Component

**Location**: `apps/web/components/rate-cards/RateComparisonTool.tsx`

```typescript
export function RateComparisonTool() {
  // Features
  - Multi-select rate cards
  - Side-by-side comparison
  - Visual difference indicators
  - Percentage variance
  - Best rate highlighting
  - Export comparison
  - Save comparison
  - Share with team
  
  // Comparison Types
  - Supplier vs Supplier
  - Year over Year
  - Role vs Role
  - Region vs Region
  - Custom
}
```

#### 3.4 Benchmarking View Component

**Location**: `apps/web/components/rate-cards/BenchmarkingView.tsx`

```typescript
export function BenchmarkingView({
  rateCardId: string;
}) {
  // Sections
  1. Market Position Card
     - Percentile rank
     - Position badge
     - Visual percentile bar
  
  2. Statistical Analysis
     - Mean, Median, Mode
     - Standard Deviation
     - Percentile distribution
     - Box plot visualization
  
  3. Savings Analysis
     - Savings to median
     - Savings to P25
     - Annual savings projection
     - Best rate comparison
  
  4. Trend Analysis
     - Historical trend chart
     - MoM, QoQ, YoY changes
     - Forecast
  
  5. Cohort Information
     - Sample size
     - Competitor count
     - Date range
     - Confidence score
}
```

#### 3.5 Negotiation Assistant Component

**Location**: `apps/web/components/rate-cards/NegotiationAssistant.tsx`

```typescript
export function NegotiationAssistant({
  rateCardId: string;
}) {
  // Sections
  1. Current Situation Summary
  2. Market Position Analysis
  3. Target Rate Recommendations
  4. Leverage Points
  5. Alternative Suppliers
  6. Talking Points
  7. Risk Assessment
  8. Recommended Strategy
  
  // Actions
  - Generate PDF Brief
  - Email Brief
  - Schedule Follow-up
  - Track Negotiation
}
```

## Data Models

### Core Models (Existing Schema)

The system uses the existing Prisma schema models:

1. **RateCardEntry** - Main rate card record
2. **RateCardSupplier** - Supplier information
3. **BenchmarkSnapshot** - Historical benchmark data
4. **MarketRateIntelligence** - Aggregated market data
5. **RateSavingsOpportunity** - Identified savings
6. **RateComparison** - Saved comparisons
7. **SupplierBenchmark** - Supplier performance
8. **RateCardBaseline** - Target/baseline rates
9. **BaselineComparison** - Baseline variance tracking
10. **ProcurementCategory** - Taxonomy for classification

### Extended Models (New)

#### Rate Card Filter Preset

```prisma
model RateCardFilterPreset {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String
  name        String
  description String?
  filters     Json     // Saved filter criteria
  isShared    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([tenantId, userId])
  @@map("rate_card_filter_presets")
}
```

#### Rate Card Note

```prisma
model RateCardNote {
  id             String   @id @default(cuid())
  rateCardEntryId String
  userId         String
  note           String
  isInternal     Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  rateCardEntry  RateCardEntry @relation(fields: [rateCardEntryId], references: [id], onDelete: Cascade)
  
  @@index([rateCardEntryId])
  @@map("rate_card_notes")
}
```

## Error Handling

### Extraction Errors

```typescript
class RateExtractionError extends Error {
  constructor(
    message: string,
    public contractId: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RateExtractionError';
  }
}

// Handle gracefully
try {
  await extractRateCards(contractId);
} catch (error) {
  if (error instanceof RateExtractionError) {
    // Log for review
    await logExtractionFailure(error);
    // Notify user
    await notifyUser({
      type: 'extraction_failed',
      contractId: error.contractId,
      message: 'Rate extraction failed. Please try manual entry.',
    });
  }
}
```

### Validation Errors

```typescript
interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

class RateCardValidationError extends Error {
  constructor(
    message: string,
    public errors: ValidationError[]
  ) {
    super(message);
    this.name = 'RateCardValidationError';
  }
}

// Return validation errors to UI
if (validationErrors.length > 0) {
  return {
    success: false,
    errors: validationErrors,
  };
}
```

### Benchmark Calculation Errors

```typescript
// Handle insufficient data gracefully
try {
  const benchmark = await calculateBenchmark(rateCardId);
} catch (error) {
  if (error.message.includes('Insufficient data')) {
    // Show warning instead of error
    return {
      success: true,
      warning: 'Limited benchmark data available',
      cohortSize: 2,
      confidence: 'LOW',
    };
  }
  throw error;
}
```

## Testing Strategy

### Unit Tests

1. **Rate Extraction**
   - Test AI extraction with sample contracts
   - Test role standardization
   - Test currency conversion
   - Test validation logic

2. **Benchmarking**
   - Test statistical calculations
   - Test percentile calculations
   - Test market position determination
   - Test savings calculations

3. **Bulk Import**
   - Test CSV parsing
   - Test validation rules
   - Test duplicate detection
   - Test batch processing

### Integration Tests

1. **End-to-End Flows**
   - Contract upload → extraction → save → benchmark
   - Manual entry → validation → save → benchmark
   - CSV upload → parse → validate → import → benchmark

2. **API Tests**
   - Test all API endpoints
   - Test authentication/authorization
   - Test error handling
   - Test rate limiting

### Performance Tests

1. **Benchmark Calculation**
   - Test with 1000+ rate cards
   - Test cohort query performance
   - Test batch calculation performance

2. **Bulk Import**
   - Test with 10,000+ row CSV
   - Test memory usage
   - Test transaction handling

### User Acceptance Tests

1. **Procurement Workflows**
   - Add rate card manually
   - Extract from contract
   - Upload CSV
   - Compare rates
   - Generate negotiation brief
   - Track savings opportunity

## Security Considerations

### Data Access Control

```typescript
// Tenant isolation
WHERE tenantId = currentUser.tenantId

// Role-based permissions
if (!hasPermission(user, 'rate_cards:view')) {
  throw new UnauthorizedError();
}

// Field-level security
if (rateCard.isConfidential && !hasPermission(user, 'rate_cards:view_confidential')) {
  delete rateCard.negotiationNotes;
  delete rateCard.additionalInfo;
}
```

### Data Encryption

- Sensitive fields encrypted at rest
- Negotiation notes encrypted
- Supplier contact information encrypted
- API keys for FX services encrypted

### Audit Logging

```typescript
// Log all rate card operations
await auditLog.create({
  tenantId,
  userId,
  action: 'RATE_CARD_CREATED',
  resource: rateCardId,
  details: {
    supplier: supplierName,
    role: roleStandardized,
    rate: dailyRate,
  },
});
```

## Performance Optimization

### Database Indexes

```sql
-- Existing indexes from schema
CREATE INDEX idx_rate_card_entries_tenant_role_country 
  ON rate_card_entries(tenant_id, role_standardized, country);

CREATE INDEX idx_rate_card_entries_daily_rate_usd 
  ON rate_card_entries(daily_rate_usd);

-- Additional indexes for filtering
CREATE INDEX idx_rate_card_entries_effective_date 
  ON rate_card_entries(effective_date DESC);

CREATE INDEX idx_rate_card_entries_line_of_service 
  ON rate_card_entries(line_of_service);
```

### Caching Strategy

```typescript
// Cache benchmark results
const cacheKey = `benchmark:${rateCardId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const benchmark = await calculateBenchmark(rateCardId);
await redis.setex(cacheKey, 3600, JSON.stringify(benchmark)); // 1 hour TTL

// Cache market intelligence
const marketKey = `market:${role}:${country}:${period}`;
// TTL: 24 hours
```

### Query Optimization

```typescript
// Use select to limit fields
const rates = await prisma.rateCardEntry.findMany({
  where: criteria,
  select: {
    id: true,
    dailyRateUSD: true,
    roleStandardized: true,
    supplierName: true,
  },
});

// Use pagination
const rates = await prisma.rateCardEntry.findMany({
  where: criteria,
  take: 50,
  skip: page * 50,
  orderBy: { createdAt: 'desc' },
});

// Use aggregation for statistics
const stats = await prisma.rateCardEntry.aggregate({
  where: criteria,
  _avg: { dailyRateUSD: true },
  _count: true,
  _min: { dailyRateUSD: true },
  _max: { dailyRateUSD: true },
});
```

### Background Jobs

```typescript
// Queue benchmark calculations
await queue.add('calculate-benchmark', {
  rateCardId,
  priority: 'normal',
});

// Batch process benchmarks nightly
await queue.add('batch-calculate-benchmarks', {
  tenantId,
  schedule: '0 2 * * *', // 2 AM daily
});

// Update market intelligence weekly
await queue.add('update-market-intelligence', {
  schedule: '0 3 * * 0', // 3 AM Sunday
});
```

## Deployment Considerations

### Environment Variables

```env
# AI Services
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Currency Conversion
FX_API_KEY=...
FX_API_URL=https://api.exchangerate-api.io/v4/latest/

# Feature Flags
ENABLE_RATE_CARD_EXTRACTION=true
ENABLE_BULK_IMPORT=true
ENABLE_NEGOTIATION_ASSISTANT=true

# Performance
BENCHMARK_CACHE_TTL=3600
MARKET_INTEL_CACHE_TTL=86400
MAX_BULK_IMPORT_ROWS=10000
```

### Database Migrations

```bash
# Run migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed

# Backfill benchmarks for existing rates
npm run backfill:benchmarks
```

### Monitoring

```typescript
// Track key metrics
metrics.gauge('rate_cards.total', totalRateCards);
metrics.gauge('rate_cards.suppliers', totalSuppliers);
metrics.gauge('savings_opportunities.total', totalOpportunities);
metrics.gauge('savings_opportunities.value', totalSavingsValue);

// Track performance
metrics.histogram('benchmark.calculation_time', duration);
metrics.histogram('extraction.processing_time', duration);
metrics.histogram('bulk_import.rows_per_second', rowsPerSecond);

// Track errors
metrics.increment('extraction.errors');
metrics.increment('benchmark.errors');
metrics.increment('bulk_import.errors');
```

This design provides a comprehensive, production-ready architecture that integrates seamlessly with your existing system while adding powerful new capabilities for rate card management and procurement optimization.
