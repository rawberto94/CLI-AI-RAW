# Implementation Checklist - What's Missing

## Status: 4 Steps to Complete

All code is written. You just need to wire it together.

---

## ❌ Step 1: Add Prisma Schema Model (5 minutes)

**File to Edit**: `packages/clients/db/schema.prisma`

**Action**: Add this model at the end of the file:

```prisma
model CostSavingsOpportunity {
  id                          String   @id @default(uuid())
  artifactId                  String
  contractId                  String
  tenantId                    String
  
  category                    String
  title                       String
  description                 String?  @db.Text
  
  potentialSavingsAmount      Decimal  @db.Decimal(15, 2)
  potentialSavingsCurrency    String   @default("USD") @db.VarChar(3)
  potentialSavingsPercentage  Decimal? @db.Decimal(5, 2)
  timeframe                   String?  @db.VarChar(20)
  
  confidence                  String   @db.VarChar(20)
  effort                      String   @db.VarChar(20)
  priority                    Int      @default(3)
  
  actionItems                 Json?    @default("[]")
  implementationTimeline      String?  @db.VarChar(100)
  risks                       Json?    @default("[]")
  
  status                      String   @default("identified") @db.VarChar(20)
  implementedAt               DateTime?
  actualSavings               Decimal? @db.Decimal(15, 2)
  notes                       String?  @db.Text
  
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
  createdBy                   String?
  updatedBy                   String?
  
  contract  Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  
  @@index([contractId])
  @@index([tenantId])
  @@index([status])
  @@index([category])
  @@index([confidence])
  @@index([potentialSavingsAmount(sort: Desc)])
  @@index([tenantId, status])
  @@map("cost_savings_opportunities")
}
```

**Also add to Contract model**:
```prisma
model Contract {
  // ...existing fields...
  costSavings  CostSavingsOpportunity[]
}
```

---

## ❌ Step 2: Generate Prisma Client (1 minute)

**Commands**:
```bash
cd packages/clients/db
pnpm prisma generate
```

This will regenerate the Prisma client with the new model.

---

## ❌ Step 3: Run Database Migration (1 minute)

**Option A - Using Prisma**:
```bash
pnpm db:migrate
```

**Option B - Manual SQL**:
```bash
psql -d your_database_name -f packages/data-orchestration/prisma/migrations/012_cost_savings_opportunities.sql
```

This creates the `cost_savings_opportunities` table in your database.

---

## ❌ Step 4: Integrate Cost Savings Storage (10 minutes)

**File to Edit**: `packages/data-orchestration/src/services/enhanced-artifact.service.ts`

**Find**: The section where artifacts are generated (look for `generateArtifact` or similar)

**Add**: After FINANCIAL or RISK artifact is generated:

```typescript
// After generating FINANCIAL or RISK artifact
if (artifactType === 'FINANCIAL' || artifactType === 'RISK') {
  try {
    // Import at top of file
    // import { costSavingsAnalyzerService } from './cost-savings-analyzer.service';
    
    // Get all existing artifacts for this contract
    const existingArtifacts = await this.getContractArtifacts(contractId);
    
    // Analyze cost savings
    const costSavings = await costSavingsAnalyzerService.analyzeCostSavings({
      overview: existingArtifacts.OVERVIEW?.data,
      financial: existingArtifacts.FINANCIAL?.data,
      rates: existingArtifacts.RATES?.data,
      clauses: existingArtifacts.CLAUSES?.data,
      risk: existingArtifacts.RISK?.data
    });
    
    // Update artifact with cost savings summary
    await prisma.artifact.update({
      where: { id: artifact.id },
      data: {
        metadata: {
          ...artifact.metadata,
          costSavingsData: costSavings,
          costSavingsTotal: costSavings.totalPotentialSavings.amount,
          costSavingsCount: costSavings.opportunities.length
        }
      }
    });
    
    // Store individual opportunities
    for (const opp of costSavings.opportunities) {
      await prisma.costSavingsOpportunity.create({
        data: {
          artifactId: artifact.id,
          contractId: contractId,
          tenantId: tenantId,
          category: opp.category,
          title: opp.title,
          description: opp.description,
          potentialSavingsAmount: opp.potentialSavings.amount,
          potentialSavingsCurrency: opp.potentialSavings.currency,
          potentialSavingsPercentage: opp.potentialSavings.percentage,
          timeframe: opp.potentialSavings.timeframe,
          confidence: opp.confidence,
          effort: opp.effort,
          priority: opp.priority,
          actionItems: opp.actionItems,
          implementationTimeline: opp.implementationTimeline,
          risks: opp.risks
        }
      });
    }
    
    console.log(`Stored ${costSavings.opportunities.length} cost savings opportunities`);
  } catch (error) {
    console.error('Failed to analyze/store cost savings:', error);
    // Don't fail artifact generation if cost savings fails
  }
}
```

---

## ✅ Optional: Add Tenant ID to Environment (1 minute)

**File**: `.env` or `.env.local`

**Add**:
```bash
NEXT_PUBLIC_TENANT_ID=default-tenant
```

In production, replace with proper authentication/session-based tenant context.

---

## Testing After Implementation

### 1. Verify Database
```bash
psql -d your_database_name -c "\d cost_savings_opportunities"
```
Should show the table structure.

### 2. Upload a Contract
```bash
pnpm dev
# Navigate to http://localhost:3000
# Upload a contract PDF
```

### 3. Check Dashboard
- Navigate to main dashboard
- Should see Cost Savings Widget with data (after upload completes)
- Click "View All" to see full analytics

### 4. Check Analytics Page
- Navigate to `/analytics/artifacts`
- Should see real metrics
- Should see cost savings total

### 5. Check Database
```bash
psql -d your_database_name -c "SELECT COUNT(*) FROM cost_savings_opportunities;"
```
Should show opportunities created.

---

## Summary

### What's Complete ✅
- All 6 artifacts improved
- All UI components created
- All API endpoints implemented
- Database migration SQL created
- Frontend wired to APIs

### What's Missing ❌
1. Prisma schema model (5 min)
2. Generate Prisma client (1 min)
3. Run database migration (1 min)
4. Add cost savings storage code (10 min)

### Total Time: ~20 minutes

### Then: 100% Working! 🎉

Once these 4 steps are done:
- Upload contract → Artifacts generated
- Cost savings automatically analyzed
- Dashboard shows real data
- Analytics page shows real metrics
- Everything works end-to-end
