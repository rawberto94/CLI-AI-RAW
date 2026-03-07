# Contract Taxonomy Quick Reference

## Category IDs

| ID | Label | Common Aliases | Default Role |
|----|-------|---------------|--------------|
| `master_framework` | Master / Framework | MSA, Framework, Master Agreement | governing_agreement |
| `scope_work_authorization` | Scope / Work Authorization | SOW, Work Order, Task Order | execution_document |
| `purchase_supply` | Purchase / Supply | PO, Purchase Order, Supply Contract | execution_document |
| `services_delivery` | Services Delivery | PSA, Consulting, Managed Services | execution_document |
| `software_cloud` | Software / Cloud | SaaS, Subscription, License | execution_document |
| `performance_operations` | Performance / Operations | SLA, KPI, Service Credits | operational_appendix |
| `confidentiality_ip` | Confidentiality / IP | NDA, Confidentiality | standalone_agreement |
| `data_security_privacy` | Data / Security / Privacy | DPA, GDPR, SCC | compliance_attachment |
| `commercial_finance` | Commercial / Finance | Rate Card, Revenue Share | commercial_attachment |
| `corporate_legal_changes` | Corporate / Legal Changes | Amendment, Addendum | modification |

## Document Roles

| ID | Label | Description |
|----|-------|-------------|
| `governing_agreement` | Governing Agreement | Sets baseline terms; others reference it |
| `execution_document` | Execution Document | Authorizes specific work/purchase |
| `operational_appendix` | Operational Appendix | Performance/operational commitments |
| `compliance_attachment` | Compliance Attachment | Regulatory/security terms |
| `commercial_attachment` | Commercial Attachment | Pricing, rebates, guarantees |
| `modification` | Modification | Changes existing agreement |
| `standalone_agreement` | Standalone Agreement | Self-contained, not tied to MSA |

## Tag Dimensions

### Pricing Models

- `fixed_fee` | `time_and_materials` | `subscription`
- `milestone` | `unit_based` | `revenue_share`

### Delivery Models

- `consulting` | `managed_services`
- `outsourcing_bpo` | `outsourcing_ito`
- `staff_augmentation` | `software_saas` | `software_perpetual`

### Data Profiles

- `no_personal_data` | `personal_data`
- `special_category_data` | `cross_border_transfer`

### Risk Flags

- `auto_renewal` | `uncapped_liability`
- `broad_indemnity` | `customer_unilateral_termination`
- `audit_rights_broad` | `nonstandard_governing_law`

## Common Imports

```typescript
// Types
import {
  ContractCategoryId,
  ContractClassification,
  ContractTags,
  CONTRACT_TAXONOMY
} from 'data-orchestration/src/taxonomy';

// Utilities
import {
  getCategoryById,
  findCategoryByAlias,
  createClassification,
  formatCategoryLabel
} from 'data-orchestration/src/taxonomy';

// RAG Integration
import {
  generateTaxonomyContext,
  enrichContractForRAG,
  getSuggestedQuestions
} from 'data-orchestration/src/taxonomy';

// Classifier (web app)
import { 
  classifyContract,
  quickClassifyContract 
} from '@/lib/ai/contract-classifier-taxonomy';
```

## Quick Code Snippets

### Classify a Contract

```typescript
const result = await classifyContract({
  text: contractText,
  filename: file.name
});

const { category_id, subtype, role, confidence } = result.classification;
```

### Get Category Info

```typescript
const category = getCategoryById('master_framework');
console.log(category.label); // "Master / Framework"
console.log(category.subtypes); // ["Master Services Agreement", ...]
console.log(category.key_extractions); // ["parties", "term", ...]
```

### Find by Alias

```typescript
const category = findCategoryByAlias('MSA');
// Returns master_framework category
```

### Save Classification

```typescript
await prisma.contract.update({
  where: { id },
  data: {
    contractCategoryId: classification.category_id,
    contractSubtype: classification.subtype,
    documentRole: classification.role,
    classificationConf: classification.confidence,
    pricingModels: tags.pricing_models,
    riskFlags: tags.risk_flags
  }
});
```

### Query by Category

```typescript
// Single category
const contracts = await prisma.contract.findMany({
  where: {
    tenantId,
    contractCategoryId: 'master_framework'
  }
});

// Multiple categories
const contracts = await prisma.contract.findMany({
  where: {
    tenantId,
    contractCategoryId: { 
      in: ['master_framework', 'scope_work_authorization']
    }
  }
});
```

### Query by Tags

```typescript
// Pricing model
const subscriptions = await prisma.contract.findMany({
  where: {
    tenantId,
    pricingModels: {
      path: [],
      array_contains: ['subscription']
    }
  }
});

// Risk flags
const riskyContracts = await prisma.contract.findMany({
  where: {
    tenantId,
    riskFlags: {
      path: [],
      array_contains: ['auto_renewal']
    }
  }
});
```

### Migrate Contracts

```typescript
import { migrateTenantContracts } from 'data-orchestration/src/taxonomy';

// Dry run
const report = await migrateTenantContracts(tenantId, {
  dryRun: true
});

// Actual migration
await migrateTenantContracts(tenantId, {
  reclassify: false, // true for AI reclassification
  batchSize: 50
});
```

### Generate Chatbot Context

```typescript
import { 
  generateTaxonomySystemPrompt,
  getSuggestedQuestions 
} from 'data-orchestration/src/taxonomy';

// System prompt
const systemPrompt = generateTaxonomySystemPrompt();

// Suggested questions
const questions = getSuggestedQuestions(classification);
```

## Database Fields

### Contract Model

```typescript
{
  // Legacy (keep for backward compatibility)
  contractType: string | null
  
  // New Taxonomy
  contractCategoryId: string | null
  contractSubtype: string | null
  documentRole: string | null
  classificationConf: number | null
  classificationMeta: object | null
  classifiedAt: Date | null
  
  // Tags (JSON arrays)
  pricingModels: string[] | null
  deliveryModels: string[] | null
  dataProfiles: string[] | null
  riskFlags: string[] | null
}
```

## Confidence Thresholds

- **High Confidence**: > 0.8 - Trust classification
- **Medium Confidence**: 0.5 - 0.8 - Review recommended
- **Low Confidence**: < 0.5 - Manual verification required

## Common Patterns

### Display Category Badge

```tsx
<Badge color={getCategoryColor(contract.contractCategoryId)}>
  {formatCategoryLabel(contract.contractCategoryId)}
</Badge>
```

### Show Risk Alerts

```tsx
{contract.riskFlags?.includes('auto_renewal') && (
  <Alert severity="warning">
    This contract has auto-renewal. Review 90 days before expiry.
  </Alert>
)}
```

### Category-Specific Actions

```tsx
switch (contract.contractCategoryId) {
  case 'master_framework':
    // Show linked SOWs
    break;
  case 'data_security_privacy':
    // Show GDPR compliance check
    break;
  // ...
}
```

## Useful Queries

### Count by Category

```typescript
const stats = await prisma.contract.groupBy({
  by: ['contractCategoryId'],
  where: { tenantId },
  _count: true
});
```

### Find Unclassified

```typescript
const unclassified = await prisma.contract.findMany({
  where: {
    tenantId,
    contractCategoryId: null
  }
});
```

### Low Confidence Contracts

```typescript
const needsReview = await prisma.contract.findMany({
  where: {
    tenantId,
    classificationConf: { lt: 0.7 }
  }
});
```

### Expiring Contracts with Auto-Renewal

```typescript
const expiringSoon = await prisma.contract.findMany({
  where: {
    tenantId,
    expirationDate: {
      gte: new Date(),
      lte: addDays(new Date(), 90)
    },
    riskFlags: {
      path: [],
      array_contains: ['auto_renewal']
    }
  }
});
```

## Migration Commands

```bash
# Apply database migration
cd packages/clients/db
npx prisma migrate dev --name add_contract_taxonomy_fields

# Generate Prisma client
npx prisma generate

# Run migration script
pnpm tsx scripts/migrate-contracts-to-taxonomy.ts
```

## Testing

```bash
# Run taxonomy tests
pnpm test src/taxonomy

# Test classification
pnpm test contract-classifier-taxonomy
```

## Troubleshooting

### Classification too slow?

- Use `quickClassifyContract` instead of `classifyContract`
- Batch process multiple contracts
- Cache common classifications

### Low confidence scores?

- Check text extraction quality
- Include filename in classification
- Use AI reclassification in migration

### Query performance issues?

- Ensure GIN indexes are created for JSON fields
- Use pagination for large result sets
- Consider materialized views for analytics

## Resources

- 📖 [Full Documentation](./packages/data-orchestration/CONTRACT_TAXONOMY_README.md)
- 🔧 [Integration Guide](./TAXONOMY_INTEGRATION_GUIDE.md)
- 📝 [Implementation Summary](./TAXONOMY_IMPLEMENTATION_SUMMARY.md)
