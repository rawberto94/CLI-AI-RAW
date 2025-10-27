# Procurement Taxonomy & Baseline Management System

## Overview

This document describes the procurement taxonomy and baseline management features added to the contract intelligence platform. These features enable:

1. **Standardized Categorization**: Classify contracts using a hierarchical indirect procurement taxonomy
2. **Baseline Comparison**: Compare actual rates against target/historical/industry benchmarks
3. **Savings Calculation**: Calculate savings opportunities based on baseline deviations
4. **Strategic Analysis**: Analyze spending patterns by procurement category

## Database Schema

### ProcurementCategory Model

```prisma
model ProcurementCategory {
  id            String   @id @default(cuid())
  tenantId      String
  categoryL1    String   // Top-level category (e.g., "IT Infrastructure")
  categoryL2    String   // Sub-category (e.g., "Software")
  categoryPath  String   // Full path: "IT Infrastructure/Software"
  displayName   String   // Display name
  description   String?  // Category description
  keywords      String[] // Keywords for matching (e.g., ["saas", "software", "license"])
  
  // Configuration
  isIndirectSpend   Boolean @default(true)
  spendType         String  @default("INDIRECT") // INDIRECT, DIRECT, CAPEX
  enableBenchmarking Boolean @default(true)
  isActive          Boolean @default(true)
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  contracts Contract[]
  
  @@unique([tenantId, categoryL1, categoryL2])
  @@index([tenantId, categoryL1])
  @@index([tenantId, categoryPath])
}
```

### BaselineRate Model

```prisma
model BaselineRate {
  id               String         @id @default(cuid())
  tenantId         String
  rateCardEntryId  String
  baselineType     BaselineType   // TARGET, HISTORICAL_BEST, INDUSTRY_AVERAGE, INTERNAL_BENCHMARK
  dailyRateUSD     Float
  effectiveDate    DateTime       @default(now())
  confidence       Float          @default(0.8) // 0.0 - 1.0
  status           BaselineStatus @default(ACTIVE)
  notes            String?
  metadata         Json?
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  tenant        Tenant         @relation(fields: [tenantId], references: [id])
  rateCardEntry RateCardEntry  @relation("RateBaselines", fields: [rateCardEntryId], references: [id])
  
  @@index([tenantId, baselineType])
  @@index([rateCardEntryId, status])
}

enum BaselineType {
  TARGET              // Strategic target rate
  HISTORICAL_BEST     // Best rate achieved historically
  INDUSTRY_AVERAGE    // Industry benchmark
  INTERNAL_BENCHMARK  // Internal corporate standard
}

enum BaselineStatus {
  DRAFT    // Draft baseline
  ACTIVE   // Active baseline
  ARCHIVED // Archived baseline
  EXPIRED  // Expired baseline
}
```

### Contract Model Extensions

```prisma
model Contract {
  // ... existing fields ...
  
  // Procurement Classification
  procurementCategoryId String?
  procurementCategory   ProcurementCategory? @relation(...)
}
```

## Procurement Taxonomy

### Category Structure

The system uses a 2-level hierarchy (L1 → L2):

```
Business Costs
├── Business costs

Corporate Insurance
├── Insurances

Employee Expenses
├── Employee Education
├── Employee Events
├── Employee expenses
└── Employees Benefits

Facility Management
├── Catering
├── Cleaning
├── FM Services
├── Mail
├── Maintenance & Repair
├── Personal facilities
├── Security
└── Workplace

IT Infrastructure
├── Corporate Voice
├── Data Lines
├── Hardware / Network
├── Mobile Voice
└── Software

Market Data Services
├── Bloomberg
├── Market Data Other
├── Ratings
├── SIX Financial Information
└── Thomas Reuters/ Datastream

Marketing
├── Events & Fairs
├── Marketing & Communications
├── Marketing Services
├── Memberships & Donations
├── Printed Materials
├── Promotional Materials
└── Sponsoring

Professional Services
├── Business Consulting
├── HR Services
├── IT Professional Services
├── Legal Services
├── Tax & Audit Services
└── Translation

Real Estate
├── Relocation
├── Rent Building
├── Rent Parking
└── Utilities

Travel
├── Air travel
├── Company Cars
├── Hotel
├── Public Transport
└── Rental Cars
```

**Total Categories**: 12 L1 categories, 50 L2 subcategories

### Seeding Taxonomy Data

Run the seed script to populate the taxonomy:

```bash
# Using environment variable
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/contracts'
npx tsx scripts/seed-procurement-taxonomy.ts demo

# Or specify different tenant
npx tsx scripts/seed-procurement-taxonomy.ts <tenant-id>
```

**Output Example**:
```
🚀 Starting procurement taxonomy seed for tenant: demo

🌱 Seeding procurement taxonomy...
  ✅ Created: Business costs/Business costs
  ✅ Created: IT Infrastructure/Software
  ✅ Created: Professional Services/IT Professional Services
  ... (50 categories)

📊 Summary:
  Created: 50
  Updated: 0
  Skipped: 0
  Total:   50

📁 Category L1 count: 12
  IT Infrastructure: 7 subcategories
  Professional Services: 6 subcategories
  Marketing: 7 subcategories
  ...
```

## Baseline Management

### Baseline Types

1. **TARGET**: Strategic target rate for negotiations
2. **HISTORICAL_BEST**: Best rate achieved in past contracts
3. **INDUSTRY_AVERAGE**: External market benchmark (e.g., Gartner, IDC)
4. **INTERNAL_BENCHMARK**: Internal corporate standard across divisions

### Baseline Import

#### API Endpoint

```
POST /api/baselines/import
```

**Request Body**:
```json
{
  "baselines": [
    {
      "role": "Software Developer",
      "seniority": "Senior",
      "country": "US",
      "dailyRateUSD": 800,
      "baselineType": "TARGET",
      "confidence": 0.9,
      "notes": "Target rate for FY2025"
    },
    {
      "role": "Data Scientist",
      "seniority": "Senior",
      "country": "US",
      "dailyRateUSD": 1000,
      "baselineType": "INDUSTRY_AVERAGE",
      "confidence": 0.7,
      "notes": "Gartner industry benchmark 2024"
    }
  ],
  "updateExisting": true
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "imported": 15,
    "updated": 5,
    "failed": 0,
    "errors": [],
    "baselineIds": ["clx123...", "clx456..."]
  },
  "message": "Imported 15, updated 5, failed 0"
}
```

#### CSV Format

For bulk imports, prepare CSV with these columns:

```csv
role,seniority,country,dailyRateUSD,baselineType,confidence,notes
Software Developer,Senior,US,800,TARGET,0.9,Target rate for FY2025
Software Developer,Mid-Level,US,600,TARGET,0.9,Target rate for FY2025
Business Consultant,Senior,US,1200,HISTORICAL_BEST,1.0,Best rate Q2 2024
Data Scientist,Senior,US,1000,INDUSTRY_AVERAGE,0.7,Gartner benchmark 2024
```

### Baseline Comparison

#### Single Rate Comparison

```
GET /api/baselines/compare/{rateCardId}
```

**Response**:
```json
{
  "success": true,
  "rateCardId": "clx123...",
  "comparisons": [
    {
      "rateCardEntryId": "clx123...",
      "actualRate": 950,
      "baselineRate": 800,
      "baselineType": "TARGET",
      "deviation": 150,
      "deviationPercentage": 18.75,
      "savingsOpportunity": 150,
      "status": "ABOVE_BASELINE"
    },
    {
      "actualRate": 950,
      "baselineRate": 900,
      "baselineType": "INDUSTRY_AVERAGE",
      "deviation": 50,
      "deviationPercentage": 5.56,
      "savingsOpportunity": 50,
      "status": "ABOVE_BASELINE"
    }
  ],
  "summary": {
    "totalBaselines": 2,
    "maxSavingsOpportunity": 150,
    "aboveBaseline": 2,
    "atBaseline": 0,
    "belowBaseline": 0
  }
}
```

#### Bulk Comparison

```
POST /api/baselines/bulk-compare
```

**Request**:
```json
{
  "minDeviationPercentage": 5,
  "baselineTypes": ["TARGET", "HISTORICAL_BEST"]
}
```

**Response**:
```json
{
  "success": true,
  "totalEntries": 45,
  "entriesWithBaselines": 32,
  "totalSavingsOpportunity": 8750.50,
  "comparisons": [
    {
      "entryId": "clx123...",
      "role": "Software Developer",
      "seniority": "Senior",
      "actualRate": 950,
      "comparisons": [
        {
          "baselineType": "TARGET",
          "deviation": 150,
          "deviationPercentage": 18.75,
          "savingsOpportunity": 150
        }
      ],
      "maxSavings": 150
    }
  ]
}
```

### Baseline Statistics

```
GET /api/baselines/import
```

**Response**:
```json
{
  "success": true,
  "statistics": {
    "totalBaselines": 125,
    "activeBaselines": 98,
    "byType": [
      { "type": "TARGET", "count": 45, "avgRate": 850.50 },
      { "type": "HISTORICAL_BEST", "count": 30, "avgRate": 780.25 },
      { "type": "INDUSTRY_AVERAGE", "count": 15, "avgRate": 920.75 },
      { "type": "INTERNAL_BENCHMARK", "count": 8, "avgRate": 800.00 }
    ]
  }
}
```

## Testing

### Test Baseline System

Run comprehensive tests:

```bash
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/contracts'
node scripts/test-baselines.mjs
```

**Test Coverage**:
1. ✅ Baseline import (create/update)
2. ✅ Baseline statistics
3. ✅ Single rate comparison
4. ✅ Bulk comparison with savings calculation
5. ✅ Archive old baselines

**Expected Output**:
```
🚀 Starting Baseline Management System Tests

📥 TEST 1: Baseline Import

✅ Import Result:
   Imported: 7
   Updated:  0
   Failed:   0
   Baseline IDs: 7

📊 TEST 2: Baseline Statistics

✅ Statistics:
   Total Baselines:  7
   Active Baselines: 7

   By Type:
     TARGET: 3 (avg: $600.00/day)
     HISTORICAL_BEST: 2 (avg: $975.00/day)
     INDUSTRY_AVERAGE: 2 (avg: $950.00/day)

🔍 TEST 3: Single Rate Comparison

Testing: Software Developer (Senior)
Actual Rate: $950/day

✅ Comparisons (3 baselines):

   TARGET:
     Baseline: $800.00/day
     Deviation: $150.00 (18.8%)
     Status: ABOVE_BASELINE
     💰 Savings: $150.00/day

   HISTORICAL_BEST:
     Baseline: $750.00/day
     Deviation: $200.00 (26.7%)
     Status: ABOVE_BASELINE
     💰 Savings: $200.00/day

   INDUSTRY_AVERAGE:
     Baseline: $900.00/day
     Deviation: $50.00 (5.6%)
     Status: ABOVE_BASELINE
     💰 Savings: $50.00/day

📈 TEST 4: Bulk Baseline Comparison

✅ Bulk Comparison Results:
   Total Entries:        45
   With Baselines:       12
   Total Savings Opp:    $3250.75/day

   Top 5 Savings Opportunities:

   1. Software Developer (Senior)
      Actual Rate: $950.00/day
      Max Savings: $200.00/day
        vs HISTORICAL_BEST: 26.7% above

🗄️  TEST 5: Archive Old Baselines

✅ Archived 0 old baselines

✅ All tests completed successfully!
```

## Use Cases

### 1. Contract Categorization

When uploading a contract:

```typescript
// Auto-categorize based on keywords
const contract = await prisma.contract.create({
  data: {
    title: "Microsoft 365 Subscription",
    // ... other fields ...
    procurementCategory: {
      connect: {
        tenantId_categoryL1_categoryL2: {
          tenantId: "demo",
          categoryL1: "IT Infrastructure",
          categoryL2: "Software"
        }
      }
    }
  }
});
```

### 2. Import Target Rates

Before negotiations:

```bash
# Prepare target rates CSV
cat > targets.csv << EOF
role,seniority,country,dailyRateUSD,baselineType,confidence,notes
Software Developer,Senior,US,800,TARGET,0.9,FY2025 target
Data Scientist,Senior,US,900,TARGET,0.9,FY2025 target
EOF

# Convert to JSON and import via API
curl -X POST http://localhost:3005/api/baselines/import \
  -H "Content-Type: application/json" \
  -d @targets.json
```

### 3. Analyze Savings Opportunities

```bash
# Get all savings opportunities > 10% deviation
curl -X POST http://localhost:3005/api/baselines/bulk-compare \
  -H "Content-Type: application/json" \
  -d '{"minDeviationPercentage": 10, "baselineTypes": ["TARGET"]}'
```

### 4. Spending Analysis by Category

```sql
-- Total spending by L1 category
SELECT 
  pc.categoryL1,
  COUNT(c.id) as contract_count,
  SUM(c.totalValue) as total_spend
FROM contracts c
JOIN procurement_categories pc ON c.procurementCategoryId = pc.id
WHERE c.tenantId = 'demo'
GROUP BY pc.categoryL1
ORDER BY total_spend DESC;
```

## Integration Points

### 1. Contract Upload Flow

```
Upload Contract
    ↓
Extract Rate Cards
    ↓
Auto-Categorize (using keywords)
    ↓
Link to Procurement Category
    ↓
Compare against Baselines
    ↓
Generate Savings Opportunities
```

### 2. Benchmarking Engine

The existing `RateCardBenchmarkingService` can be extended:

```typescript
// Calculate savings vs baselines
const baselineService = new BaselineManagementService(prisma);
const benchmarkService = new RateCardBenchmarkingService(prisma);

// Get market benchmark
const marketBench = await benchmarkService.calculateBenchmark(rateCardId);

// Get baseline comparison
const baselineComp = await baselineService.compareAgainstBaselines(rateCardId);

// Combined analysis
const analysis = {
  marketBenchmark: marketBench,
  baselineComparison: baselineComp,
  totalSavingsOpportunity: baselineComp.reduce((sum, c) => sum + c.savingsOpportunity, 0)
};
```

### 3. Dashboard Widgets

**Recommended Additions**:

1. **Category Spending Breakdown** (Pie chart by L1)
2. **Baseline Deviation Heatmap** (Role × Baseline Type)
3. **Top Savings Opportunities** (Sorted by deviation $)
4. **Compliance Rate** (% of rates within target baseline)

## Migration Applied

```
✔ Generated Prisma Client
✔ Migration: 20251024080328_add_taxonomy_and_baselines

Changes:
  + ProcurementCategory table
  + BaselineRate table
  + BaselineType enum
  + BaselineStatus enum
  + OpportunityPriority enum
  + Contract.procurementCategoryId field
  + RateCardEntry baseline relations
```

## Next Steps

1. **UI Components**:
   - Baseline import form with CSV upload
   - Category selector dropdown (hierarchical)
   - Baseline comparison dashboard
   - Savings opportunity table

2. **Automation**:
   - Auto-categorize contracts using AI + keyword matching
   - Scheduled baseline updates from external sources
   - Alert notifications for high-deviation rates

3. **Analytics**:
   - Trending: savings over time
   - Supplier performance vs baselines
   - Category-level spending insights

4. **Advanced Features**:
   - Machine learning for auto-categorization
   - External API integration (Gartner, IDC benchmarks)
   - Multi-currency baseline support
   - Regional baseline variations

## API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/baselines/import` | POST | Import baseline rates (bulk) |
| `/api/baselines/import` | GET | Get baseline statistics |
| `/api/baselines/compare/{id}` | GET | Compare single rate vs baselines |
| `/api/baselines/bulk-compare` | POST | Compare all rates vs baselines |

## Files Added/Modified

**New Files**:
- `/packages/clients/db/schema.prisma` (extended)
- `/packages/data-orchestration/src/services/baseline-management.service.ts`
- `/apps/web/app/api/baselines/import/route.ts`
- `/apps/web/app/api/baselines/compare/[rateCardId]/route.ts`
- `/apps/web/app/api/baselines/bulk-compare/route.ts`
- `/scripts/seed-procurement-taxonomy.ts`
- `/scripts/test-baselines.mjs`
- `/PROCUREMENT_TAXONOMY_BASELINE_SYSTEM.md` (this file)

**Migration**:
- `/packages/clients/db/migrations/20251024080328_add_taxonomy_and_baselines/`

## Support

For questions or issues:
1. Check test output: `node scripts/test-baselines.mjs`
2. Review database: `psql -d contracts -c "SELECT * FROM procurement_categories LIMIT 10;"`
3. Check API logs in Next.js console
4. Verify Prisma Client regenerated: `pnpm --filter clients-db build`
