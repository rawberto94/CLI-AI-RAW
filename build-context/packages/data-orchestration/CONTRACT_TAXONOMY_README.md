# Contract Taxonomy System

A comprehensive contract classification and management system for enterprise contract lifecycle management (CLM).

## Overview

The Contract Taxonomy System provides:

- **10 Contract Categories** covering all major contract types
- **7 Document Roles** defining how contracts function in the hierarchy
- **4 Tag Dimensions** for additional classification (pricing, delivery, data, risk)
- **50+ Subtypes** for granular classification
- **AI-powered classification** using GPT-4
- **Full TypeScript type safety** with Zod validation
- **Database integration** with Prisma
- **RAG/Chatbot integration** for intelligent contract queries
- **Migration utilities** for existing contracts

## Quick Start

### 1. Import the Taxonomy

```typescript
import {
  CONTRACT_TAXONOMY,
  getCategoryById,
  classifyContract,
  generateTaxonomyContext
} from 'data-orchestration/src/taxonomy';
```

### 2. Explore the Taxonomy

```typescript
// Get all categories
const categories = CONTRACT_TAXONOMY.contract_categories;
console.log(`${categories.length} categories available`);

// Get specific category
const category = getCategoryById('master_framework');
console.log(`${category.label}: ${category.description}`);
console.log(`Subtypes: ${category.subtypes.join(', ')}`);
console.log(`Key fields: ${category.key_extractions.join(', ')}`);
```

### 3. Classify a Contract

```typescript
import { classifyContract } from '@/lib/ai/contract-classifier-taxonomy';

const result = await classifyContract({
  text: contractText,
  filename: 'MSA-2024.pdf'
});

console.log(`Category: ${result.classification.category_id}`);
console.log(`Subtype: ${result.classification.subtype}`);
console.log(`Role: ${result.classification.role}`);
console.log(`Confidence: ${result.classification.confidence * 100}%`);

// Access tags
console.log(`Pricing: ${result.tags.pricing_models.join(', ')}`);
console.log(`Risk Flags: ${result.tags.risk_flags.join(', ')}`);
```

### 4. Update Database

```typescript
await prisma.contract.update({
  where: { id: contractId },
  data: {
    contractCategoryId: result.classification.category_id,
    contractSubtype: result.classification.subtype,
    documentRole: result.classification.role,
    classificationConf: result.classification.confidence,
    classificationMeta: result.classification,
    pricingModels: result.tags.pricing_models,
    deliveryModels: result.tags.delivery_models,
    dataProfiles: result.tags.data_profiles,
    riskFlags: result.tags.risk_flags,
    classifiedAt: new Date()
  }
});
```

## Contract Categories

### 1. Master / Framework (`master_framework`)

Governing terms that apply across multiple future orders/work.

**Subtypes:**

- Master Services Agreement (MSA)
- Framework Agreement
- Master Agreement
- General Terms & Conditions (GTC)
- Master Purchase Agreement

**Key Fields:** parties, effective_date, term, renewal, governing_law, liability_cap, indemnities, ip_ownership, confidentiality, payment_terms

### 2. Scope / Work Authorization (`scope_work_authorization`)

Documents that authorize and define a specific scope, deliverables, timeline, acceptance, and commercials.

**Subtypes:**

- Statement of Work (SOW)
- Work Order
- Task Order
- Change Order / Variation Order
- Order Form

**Key Fields:** scope, deliverables, milestones, acceptance, fees, payment_schedule, sla_references, term, renewal, dependencies, assumptions

### 3. Purchase / Supply (`purchase_supply`)

Buying goods or supply chain relationships.

**Subtypes:**

- Purchase Order (PO)
- Supply Agreement
- Manufacturing Agreement
- OEM Agreement
- Logistics / Transportation Agreement
- Warehousing Agreement
- Quality Agreement

**Key Fields:** items, quantities, unit_prices, delivery_terms, incoterms, warranties, returns, payment_terms, governing_law, limitation_of_liability

### 4. Services Delivery (`services_delivery`)

Services agreements where delivery terms are central.

**Subtypes:**

- Professional Services Agreement (PSA)
- Consulting Agreement
- Managed Services Agreement
- Outsourcing Agreement (ITO/BPO)
- Staff Augmentation Agreement
- Independent Contractor Agreement

**Key Fields:** services, fees, rate_model, staffing, deliverables, acceptance, governance, termination, liability_cap, indemnities

### 5. Software / Cloud (`software_cloud`)

Licensing/subscription/hosting agreements covering software, SaaS, cloud services.

**Subtypes:**

- SaaS Subscription Agreement
- Software License Agreement
- Cloud Services Agreement
- Hosting Agreement
- Support & Maintenance Agreement
- Implementation / System Integration Agreement
- EULA (Enterprise)

**Key Fields:** license_grant, usage_limits, fees, renewal, support_terms, sla_terms, data_handling, security_terms, ip, termination, audit_rights

### 6. Performance / Operations (`performance_operations`)

Operational performance commitments (SLAs, KPIs, service credits).

**Subtypes:**

- Service Level Agreement (SLA)
- KPI / Scorecard Agreement
- Service Credits Schedule
- Operational Runbook (Contractual Appendix)

**Key Fields:** availability, response_times, resolution_times, service_credits, exclusions, reporting, governance, escalation

### 7. Confidentiality / IP (`confidentiality_ip`)

Agreements focused on confidentiality, IP ownership, and collaboration.

**Subtypes:**

- Mutual NDA
- Unilateral NDA
- Confidentiality Agreement
- IP Assignment Agreement
- Joint Development Agreement
- Source Code Escrow Agreement

**Key Fields:** confidential_info_definition, use_restrictions, term, survival, return_destroy, remedies, ip_ownership

### 8. Data / Security / Privacy (`data_security_privacy`)

Data protection and security obligations.

**Subtypes:**

- Data Processing Agreement/Addendum (DPA)
- Standard Contractual Clauses (SCCs)
- UK GDPR Addendum
- Data Sharing Agreement
- Security Addendum / Information Security Agreement
- Incident Response Addendum

**Key Fields:** controller_processor, processing_purpose, data_categories, subprocessors, breach_notification, transfers, security_measures, audit_rights, retention_deletion

### 9. Commercial / Finance (`commercial_finance`)

Pricing, revenue share, commission, guarantees, settlements.

**Subtypes:**

- Pricing Schedule / Rate Card Appendix
- Revenue Share Agreement
- Commission Agreement
- Guarantee / Parent Company Guarantee
- Settlement & Release Agreement
- Escrow Agreement (Financial)

**Key Fields:** fees, discounts, rebates, payment_terms, audit_rights, caps_floors, settlement_amount, release_language

### 10. Corporate / Legal Changes (`corporate_legal_changes`)

Documents that modify or transfer contractual rights/obligations.

**Subtypes:**

- Amendment
- Addendum
- Novation Agreement
- Assignment Agreement
- Side Letter
- Waiver

**Key Fields:** modified_sections, effective_date, supersedes_language, consents, party_changes, signature_blocks

## Document Roles

1. **Governing Agreement** - Sets baseline terms; other documents incorporate it by reference
2. **Execution Document** - Authorizes specific work/purchase/subscription under governing terms
3. **Operational Appendix** - Defines measurable performance/operational commitments
4. **Compliance Attachment** - Regulatory/security/data processing terms
5. **Commercial Attachment** - Pricing, rebates, credits, commissions, guarantees
6. **Modification** - Changes or transfers rights/obligations of existing agreement
7. **Standalone Agreement** - Self-contained agreement not tied to an MSA

## Tag Dimensions

### Pricing Models

- `fixed_fee` - Fixed price for entire engagement
- `time_and_materials` - Hourly/daily rates plus expenses
- `subscription` - Recurring subscription fees
- `milestone` - Payment tied to specific milestones
- `unit_based` - Per-unit pricing
- `revenue_share` - Revenue sharing arrangement

### Delivery Models

- `consulting` - Professional consulting services
- `managed_services` - Ongoing managed services
- `outsourcing_bpo` - Business process outsourcing
- `outsourcing_ito` - IT outsourcing
- `staff_augmentation` - Staff augmentation
- `software_saas` - SaaS software delivery
- `software_perpetual` - Perpetual software license

### Data Profiles

- `no_personal_data` - No personal data processed
- `personal_data` - Personal data is processed
- `special_category_data` - Special category/sensitive data
- `cross_border_transfer` - Cross-border data transfers

### Risk Flags

- `auto_renewal` - Auto-renewal clause present
- `uncapped_liability` - Liability is uncapped or very high
- `broad_indemnity` - Broad indemnification obligations
- `customer_unilateral_termination` - Customer can terminate unilaterally
- `audit_rights_broad` - Broad audit rights granted
- `nonstandard_governing_law` - Non-standard or unfavorable governing law

## Database Schema

The taxonomy integrates with Prisma schema:

```prisma
model Contract {
  // Legacy (keep for backward compatibility)
  contractType    String?
  
  // New Taxonomy Classification
  contractCategoryId   String?
  contractSubtype      String?
  documentRole         String?
  classificationConf   Float?
  classificationMeta   Json?
  classifiedAt         DateTime?
  
  // Contract Tags
  pricingModels   Json?  @default("[]")
  deliveryModels  Json?  @default("[]")
  dataProfiles    Json?  @default("[]")
  riskFlags       Json?  @default("[]")
  
  // ... other fields
  
  @@index([contractCategoryId])
  @@index([documentRole])
  @@index([tenantId, contractCategoryId])
}
```

## Migration

### Migrate Existing Contracts

```typescript
import { migrateTenantContracts } from 'data-orchestration/src/taxonomy';

// Dry run first
const report = await migrateTenantContracts(tenantId, {
  dryRun: true,
  reclassify: false // Use legacy type mapping
});

console.log(`Would migrate: ${report.migrated}/${report.total} contracts`);

// Perform migration
await migrateTenantContracts(tenantId, {
  reclassify: false, // Set to true to use AI reclassification
  batchSize: 50
});
```

### Generate Migration Report

```typescript
import { generateMigrationReport } from 'data-orchestration/src/taxonomy';

const report = await generateMigrationReport(tenantId);

console.log(`Total: ${report.total}`);
console.log(`Migrated: ${report.migrated}`);
console.log(`Unmigrated: ${report.unmigrated}`);
console.log('By category:', report.by_category);
console.log('Confidence:', report.confidence_distribution);
```

## RAG/Chatbot Integration

### Generate Taxonomy Context

```typescript
import { generateTaxonomyContext, generateContractContext } from 'data-orchestration/src/taxonomy';

// Add to RAG system prompt
const taxonomyContext = generateTaxonomyContext();

// Add per-contract context
const contractContext = generateContractContext(
  extendedMetadata,
  contractName
);
```

### Get Suggested Questions

```typescript
import { getSuggestedQuestions } from 'data-orchestration/src/taxonomy';

const questions = getSuggestedQuestions(classification);
// Returns category-specific questions users might ask
```

## API Examples

### Query Contracts by Taxonomy

```typescript
// Filter by category
const mssas = await prisma.contract.findMany({
  where: {
    tenantId,
    contractCategoryId: 'master_framework'
  }
});

// Filter by document role
const executionDocs = await prisma.contract.findMany({
  where: {
    tenantId,
    documentRole: 'execution_document'
  }
});

// Filter by pricing model (JSON array contains)
const subscriptions = await prisma.contract.findMany({
  where: {
    tenantId,
    pricingModels: {
      path: [],
      array_contains: ['subscription']
    }
  }
});

// Filter by risk flags
const highRisk = await prisma.contract.findMany({
  where: {
    tenantId,
    riskFlags: {
      path: [],
      array_contains: ['uncapped_liability', 'auto_renewal']
    }
  }
});
```

### Search and Filter

```typescript
import { searchCategories, getCategoriesByRole } from 'data-orchestration/src/taxonomy';

// Search categories
const results = searchCategories('software');
// Returns categories matching "software"

// Get categories by role
const governing = getCategoriesByRole('governing_agreement');
// Returns all categories with default role "governing_agreement"
```

## Testing

Run taxonomy tests:

```bash
pnpm test src/taxonomy
```

## Version

**Current Version:** 1.0

The taxonomy version is tracked in `TAXONOMY_VERSION` constant and stored in classification metadata.

## Contributing

When adding new categories or subtypes:

1. Update `contract-taxonomy.types.ts`
2. Update this README
3. Add migration support in `taxonomy-migration.utils.ts`
4. Update classifier prompts if needed
5. Add tests

## License

Proprietary - Internal Use Only
