# Rate Card Schema Migration Plan

## Overview

The rate card API routes have been implemented using `@ts-ignore` comments for models that exist in the schema but have field name mismatches. This document outlines the required schema updates to align with API usage.

## Current Status

### ✅ Models That Exist

- `RateCardSupplier`
- `RateCardEntry`
- `BenchmarkSnapshot`
- `MarketRateIntelligence`
- `RateSavingsOpportunity`
- `RateComparison`
- `SupplierBenchmark`
- `RateCardBaseline`
- `BaselineComparison`

### ❌ Field Mismatches to Fix

## 1. RateSavingsOpportunity Model

### Issues Found in API Routes:

- `/api/rate-cards/dashboard/financial/route.ts`
- `/api/rate-cards/dashboard/performance/route.ts`
- `/api/rate-cards/dashboard/trends/route.ts`

### Current Schema Fields:

```prisma
model RateSavingsOpportunity {
  annualSavings         Decimal  // Line 1476
  actualSavings         Decimal? // Line 1500
}
```

### API Routes Expect:

```typescript
annualSavingsPotential  // Used in queries
actualSavingsRealized   // Used in queries
```

### Required Changes:

```prisma
model RateSavingsOpportunity {
  // OLD: annualSavings
  annualSavingsPotential  Decimal  @db.Decimal(15, 2)
  
  // OLD: actualSavings  
  actualSavingsRealized   Decimal? @db.Decimal(15, 2)
}
```

## 2. BenchmarkSnapshot Model

### Issues Found in API Routes:

- `/api/rate-cards/dashboard/financial/route.ts`
- `/api/rate-cards/dashboard/performance/route.ts`

### Current Schema Has:

- ✅ `percentileRank` - Correct
- ❓ Need to verify `rateValue` and `marketMedian` fields

### API Routes Expect:

```typescript
rateValue: true,      // The actual rate being benchmarked
marketMedian: true,   // Market median for comparison
percentileRank: true, // Already exists
```

### Required Changes:

The `BenchmarkSnapshot` model needs to add these fields if missing:

```prisma
model BenchmarkSnapshot {
  // Add if missing:
  rateValue        Decimal  @db.Decimal(10, 2)  // The rate being benchmarked
  marketMedian     Decimal  @db.Decimal(10, 2)  // Market median rate
  
  // Already exists:
  percentileRank   Int     // 0-100
  median           Decimal @db.Decimal(10, 2)
}
```

## 3. BenchmarkSnapshot - Relationship Fix

### Current Schema:

```prisma
model BenchmarkSnapshot {
  rateCardEntry  RateCardEntry @relation(fields: [rateCardEntryId], references: [id], onDelete: Cascade)
}
```

The `rateValue` should reference the `RateCardEntry.dailyRateUSD` at snapshot time, or store a copy.

### Recommended Approach:

Store a snapshot copy of the rate value at the time of benchmarking:

```prisma
model BenchmarkSnapshot {
  rateCardEntryId  String
  rateValue        Decimal  @db.Decimal(10, 2)  // Snapshot of dailyRateUSD at time of benchmark
  marketMedian     Decimal  @db.Decimal(10, 2)  // Calculated market median
  
  // ... rest of fields
  
  rateCardEntry    RateCardEntry @relation(fields: [rateCardEntryId], references: [id], onDelete: Cascade)
}
```

## Migration Steps

### Step 1: Create Migration File

```sql
-- Migration: 016_rate_card_field_alignment.sql

-- Update RateSavingsOpportunity field names
ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "annualSavings" TO "annualSavingsPotential";

ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "actualSavings" TO "actualSavingsRealized";

-- Add missing fields to BenchmarkSnapshot
ALTER TABLE benchmark_snapshots 
  ADD COLUMN IF NOT EXISTS "rateValue" DECIMAL(10, 2);

ALTER TABLE benchmark_snapshots 
  ADD COLUMN IF NOT EXISTS "marketMedian" DECIMAL(10, 2);

-- Backfill rateValue from related RateCardEntry
UPDATE benchmark_snapshots bs
SET "rateValue" = rce."dailyRateUSD"
FROM rate_card_entries rce
WHERE bs."rateCardEntryId" = rce.id
  AND bs."rateValue" IS NULL;

-- Backfill marketMedian from median field (if they should be same)
UPDATE benchmark_snapshots 
SET "marketMedian" = "median"
WHERE "marketMedian" IS NULL;

-- Make fields NOT NULL after backfill
ALTER TABLE benchmark_snapshots 
  ALTER COLUMN "rateValue" SET NOT NULL;

ALTER TABLE benchmark_snapshots 
  ALTER COLUMN "marketMedian" SET NOT NULL;
```

### Step 2: Update Schema File

Update `/packages/clients/db/schema.prisma`:

```prisma
model RateSavingsOpportunity {
  id                      String              @id @default(cuid())
  tenantId                String
  rateCardEntryId         String
  
  // Opportunity Details
  title                   String
  description             String
  category                SavingsCategory
  
  // Financial Impact
  currentAnnualCost       Decimal             @db.Decimal(15, 2)
  projectedAnnualCost     Decimal             @db.Decimal(15, 2)
  annualSavingsPotential  Decimal             @db.Decimal(15, 2)  // RENAMED
  savingsPercentage       Decimal             @db.Decimal(5, 2)
  
  // Effort & Risk
  effort                  EffortLevel
  risk                    RiskLevel
  confidence              Decimal             @db.Decimal(3, 2)
  
  // Recommendations
  recommendedAction       String
  alternativeSuppliers    Json?
  negotiationPoints       Json?
  
  // Timeline
  implementationTime      String?
  expectedRealization     DateTime?
  
  // Status
  status                  OpportunityStatus   @default(IDENTIFIED)
  assignedTo              String?
  reviewedBy              String?
  reviewedAt              DateTime?
  implementedAt           DateTime?
  
  actualSavingsRealized   Decimal?            @db.Decimal(15, 2)  // RENAMED
  
  createdAt               DateTime            @default(now())
  updatedAt               DateTime            @updatedAt
  
  rateCardEntry           RateCardEntry       @relation(fields: [rateCardEntryId], references: [id])
  
  @@index([tenantId])
  @@index([status])
  @@index([annualSavingsPotential(sort: Desc)])  // UPDATE INDEX
  @@index([category])
  @@map("rate_savings_opportunities")
}

model BenchmarkSnapshot {
  id                    String            @id @default(cuid())
  tenantId              String
  rateCardEntryId       String
  
  // Snapshot Metadata
  snapshotDate          DateTime          @default(now())
  periodStart           DateTime
  periodEnd             DateTime
  
  // Benchmark Cohort Definition
  cohortDefinition      Json
  cohortSize            Int
  
  // Rate Values (ADDED)
  rateValue             Decimal           @db.Decimal(10, 2)  // Snapshot of rate at benchmark time
  marketMedian          Decimal           @db.Decimal(10, 2)  // Market median for comparison
  
  // Statistical Analysis
  average               Decimal           @db.Decimal(10, 2)
  median                Decimal           @db.Decimal(10, 2)
  mode                  Decimal?          @db.Decimal(10, 2)
  standardDeviation     Decimal           @db.Decimal(10, 2)
  
  percentile25          Decimal           @db.Decimal(10, 2)
  percentile50          Decimal           @db.Decimal(10, 2)
  percentile75          Decimal           @db.Decimal(10, 2)
  percentile90          Decimal           @db.Decimal(10, 2)
  percentile95          Decimal           @db.Decimal(10, 2)
  
  min                   Decimal           @db.Decimal(10, 2)
  max                   Decimal           @db.Decimal(10, 2)
  
  // Position Analysis
  positionInMarket      String
  percentileRank        Int
  
  // Savings Analysis
  potentialSavings      Decimal?          @db.Decimal(10, 2)
  savingsToMedian       Decimal?          @db.Decimal(10, 2)
  savingsToP25          Decimal?          @db.Decimal(10, 2)
  
  // Market Intelligence
  marketTrend           String?
  trendPercentage       Decimal?          @db.Decimal(5, 2)
  
  competitorCount       Int
  competitorAverage     Decimal?          @db.Decimal(10, 2)
  
  rateCardEntry         RateCardEntry     @relation(fields: [rateCardEntryId], references: [id], onDelete: Cascade)
  
  @@index([tenantId])
  @@index([rateCardEntryId])
  @@index([snapshotDate])
  @@map("benchmark_snapshots")
}
```

### Step 3: Run Migration Commands

```bash
cd /workspaces/CLI-AI-RAW

# Create the migration file
cat > packages/clients/db/migrations/016_rate_card_field_alignment.sql << 'EOF'
-- Migration: 016_rate_card_field_alignment
-- Aligns field names between schema and API routes

-- Update RateSavingsOpportunity field names
ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "annualSavings" TO "annualSavingsPotential";

ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "actualSavings" TO "actualSavingsRealized";

-- Add missing fields to BenchmarkSnapshot
ALTER TABLE benchmark_snapshots 
  ADD COLUMN IF NOT EXISTS "rateValue" DECIMAL(10, 2);

ALTER TABLE benchmark_snapshots 
  ADD COLUMN IF NOT EXISTS "marketMedian" DECIMAL(10, 2);

-- Backfill rateValue from related RateCardEntry
UPDATE benchmark_snapshots bs
SET "rateValue" = rce."dailyRateUSD"
FROM rate_card_entries rce
WHERE bs."rateCardEntryId" = rce.id
  AND bs."rateValue" IS NULL;

-- Backfill marketMedian from median field
UPDATE benchmark_snapshots 
SET "marketMedian" = "median"
WHERE "marketMedian" IS NULL;

-- Make fields NOT NULL after backfill (only if we have data)
-- ALTER TABLE benchmark_snapshots ALTER COLUMN "rateValue" SET NOT NULL;
-- ALTER TABLE benchmark_snapshots ALTER COLUMN "marketMedian" SET NOT NULL;
EOF

# Apply the migration
docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts -f /migrations/016_rate_card_field_alignment.sql

# OR if migrations folder isn't mounted:
cat packages/clients/db/migrations/016_rate_card_field_alignment.sql | docker exec -i contract-intelligence-postgres-dev psql -U postgres -d contracts

# Update Prisma schema
# (Edit packages/clients/db/schema.prisma as shown above)

# Regenerate Prisma client
cd packages/clients/db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts" npx prisma generate

# Push schema updates
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/contracts" npx prisma db push
```

### Step 4: Remove @ts-ignore Comments

After migration, remove `@ts-ignore` comments from:

- `/apps/web/app/api/rate-cards/dashboard/financial/route.ts`
- `/apps/web/app/api/rate-cards/dashboard/performance/route.ts`
- `/apps/web/app/api/rate-cards/dashboard/trends/route.ts`

### Step 5: Test

```bash
# Run tests
npm run test:rate-card-integration

# Start server and verify
npm run dev
```

## Verification Checklist

- [ ] Migration SQL created
- [ ] Schema file updated
- [ ] Prisma client regenerated
- [ ] Migration applied to database
- [ ] Database columns verified
- [ ] @ts-ignore comments removed
- [ ] TypeScript compilation passes
- [ ] API routes tested
- [ ] No runtime errors

## Rollback Plan

If issues occur:

```sql
-- Rollback: Rename fields back
ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "annualSavingsPotential" TO "annualSavings";

ALTER TABLE rate_savings_opportunities 
  RENAME COLUMN "actualSavingsRealized" TO "actualSavings";

-- Remove added fields
ALTER TABLE benchmark_snapshots DROP COLUMN IF EXISTS "rateValue";
ALTER TABLE benchmark_snapshots DROP COLUMN IF EXISTS "marketMedian";
```

## Notes

1. **Data Preservation**: All renames preserve existing data
2. **Backward Compatibility**: Old field names will break - update all references
3. **Index Updates**: Indexes on renamed fields need updating
4. **Service Layer**: Ensure all service files use new field names
5. **Frontend**: Check if any frontend code references these fields

## Timeline

- **Preparation**: 30 minutes (review and create migration)
- **Execution**: 5 minutes (run migration)
- **Testing**: 30 minutes (verify all routes work)
- **Total**: ~1-2 hours

## Risk Assessment

- **Risk Level**: LOW
  - Simple field renames
  - Additive changes only
  - Can rollback easily
  - No data loss

## Post-Migration Tasks

1. Update API documentation
2. Update service layer if needed
3. Update integration tests
4. Document new field names in README
5. Communicate changes to team
