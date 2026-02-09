# PostgreSQL Data Models Documentation

> **DEPRECATED:** See [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) §4 (Database Architecture) for current data model documentation. Retained for historical reference only.

---

This document explains all PostgreSQL tables in the CLI-AI contract management system, their purposes, relationships, and how they are populated.

---

## Table of Contents

1. [Multi-Tenant Foundation](#1-multi-tenant-foundation)
2. [User & Access Management](#2-user--access-management)
3. [Contract Core Models](#3-contract-core-models)
4. [Contract Processing & Analysis](#4-contract-processing--analysis)
5. [Artifacts & AI Analysis](#5-artifacts--ai-analysis)
6. [Rate Card & Benchmarking](#6-rate-card--benchmarking)
7. [Procurement & Categorization](#7-procurement--categorization)
8. [Workflow & Collaboration](#8-workflow--collaboration)
9. [Analytics & Reporting](#9-analytics--reporting)
10. [Integration Hub](#10-integration-hub)
11. [Production Infrastructure](#11-production-infrastructure)

---

## 1. Multi-Tenant Foundation

### Tenant
The root entity for multi-tenancy. Every other record in the system belongs to a tenant.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (CUID) |
| name | String | Tenant name |
| slug | String | URL-friendly identifier (unique) |
| domain | String? | Custom domain |
| status | TenantStatus | ACTIVE, SUSPENDED, INACTIVE, DELETED |
| settings | Json | Tenant-specific settings |
| features | Json | Feature flags |

**Population:** Created via admin API when a new organization signs up.

### TenantConfig
Extended configuration for tenant features.

| Field | Type | Description |
|-------|------|-------------|
| tenantId | String | Foreign key to Tenant |
| maxUsers | Int | User limit |
| maxStorage | BigInt | Storage limit in bytes |
| enabledFeatures | String[] | Feature list |
| customBranding | Json | UI customization |

**Population:** Auto-created when tenant is created, updated via settings API.

### TenantSubscription
Billing and subscription management.

| Field | Type | Description |
|-------|------|-------------|
| plan | SubscriptionPlan | FREE, BASIC, PROFESSIONAL, ENTERPRISE |
| status | SubscriptionStatus | ACTIVE, TRIAL, EXPIRED, CANCELLED |
| billingCycle | BillingCycle | MONTHLY, YEARLY |
| trialEndsAt | DateTime? | Trial expiration |

**Population:** Created during onboarding, updated by billing system.

### TenantUsage
Usage tracking for billing and limits.

| Field | Type | Description |
|-------|------|-------------|
| contractsUsed | Int | Number of contracts |
| storageUsed | BigInt | Storage consumed |
| aiCreditsUsed | Int | AI API calls |
| periodStart/End | DateTime | Billing period |

**Population:** Updated by processing jobs and API endpoints.

---

## 2. User & Access Management

### User
User accounts within a tenant.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (CUID) |
| tenantId | String | Tenant association |
| email | String | Unique email |
| name | String? | Display name |
| password | String? | Hashed password |
| status | UserStatus | ACTIVE, INACTIVE, SUSPENDED, DELETED |
| lastLoginAt | DateTime? | Last login timestamp |

**Population:** Created via sign-up flow, SSO, or admin invitation.

### Role
Role-based access control definitions.

| Field | Type | Description |
|-------|------|-------------|
| tenantId | String | Tenant association |
| name | String | Role name (Admin, Manager, Viewer, etc.) |
| description | String? | Role description |
| isSystemRole | Boolean | Built-in vs custom |

**Population:** System roles auto-created on tenant creation; custom roles via admin UI.

### Permission
Granular permissions for RBAC.

| Field | Type | Description |
|-------|------|-------------|
| resource | String | Resource name (contracts, users, etc.) |
| action | String | Action (create, read, update, delete) |
| conditions | Json? | Conditional rules |

**Population:** Seeded on database initialization.

### UserRole / RolePermission
Junction tables linking users to roles and roles to permissions.

**Population:** Updated when user roles are assigned via admin interface.

### UserSession
Active user sessions for authentication.

| Field | Type | Description |
|-------|------|-------------|
| userId | String | User reference |
| token | String | Session token (unique) |
| expiresAt | DateTime | Session expiration |
| ipAddress | String? | Client IP |
| userAgent | String? | Browser/client info |

**Population:** Created on login, deleted on logout.

### UserPreferences
User-specific settings and onboarding state.

| Field | Type | Description |
|-------|------|-------------|
| theme | String | light/dark |
| dashboardLayout | Json? | Custom dashboard |
| onboardingCompleted | Boolean | Onboarding status |
| helpToursCompleted | Json | Completed help tours |

**Population:** Created on first user interaction, updated via preferences API.

---

## 3. Contract Core Models

### Contract
The central entity representing a contract document.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (CUID) |
| tenantId | String | Tenant association |
| title | String? | Contract title |
| fileName | String | Original filename |
| fileType | String? | MIME type |
| fileSize | BigInt? | File size in bytes |
| fileUrl | String? | Cloud storage URL |
| status | ContractStatus | UPLOADED, PROCESSING, COMPLETED, etc. |
| rawText | String? | Extracted text content |

**Financial Fields:**
| Field | Type | Description |
|-------|------|-------------|
| totalValue | Decimal? | Total contract value |
| currency | String? | Currency code |
| paymentTerms | String? | Payment terms summary |
| financialBreakdown | Json? | Detailed cost structure |

**Categorization Fields:**
| Field | Type | Description |
|-------|------|-------------|
| categoryId | String? | TaxonomyCategory reference |
| categoryConfidence | Float? | AI categorization confidence |
| procurementCategoryId | String? | ProcurementCategory reference |
| categoryL1/L2/L3 | String? | Category hierarchy |
| spendType | SpendType? | DIRECT, INDIRECT, CAPEX, OPEX |

**Hierarchy Fields:**
| Field | Type | Description |
|-------|------|-------------|
| parentContractId | String? | Master agreement reference |
| isAmendment | Boolean | Amendment flag |
| amendmentNumber | Int? | Amendment sequence |

**Population Flow:**
1. **Upload API** (`/api/contracts/upload`): Creates record with UPLOADED status
2. **Processing Queue**: Updates status to PROCESSING
3. **Ingestion Worker**: Extracts rawText, updates metadata
4. **AI Analysis Workers**: Populate artifacts, clauses, financial data
5. **Categorization Service**: Sets categoryId based on keyword/AI matching
6. **Status Update**: Sets to COMPLETED when all processing done

### ContractMetadata
Extended metadata for contracts with ~60 fields.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference (unique) |
| agreementType | String? | Type of agreement |
| jurisdiction | String? | Legal jurisdiction |
| governingLaw | String? | Applicable law |
| effectiveDate | DateTime? | Start date |
| expirationDate | DateTime? | End date |
| autoRenewal | Boolean? | Auto-renewal flag |
| renewalPeriod | String? | Renewal terms |
| terminationNoticePeriod | String? | Notice requirements |

**AI Analysis Fields:**
| Field | Type | Description |
|-------|------|-------------|
| aiAnalyzedAt | DateTime? | Last AI analysis |
| aiSummary | String? | AI-generated summary |
| aiKeyTerms | Json? | Extracted key terms |
| aiRiskScore | Float? | Risk assessment |

**Population:** Created/updated by AI analysis workers after ingestion.

### Party
Organizations involved in contracts.

| Field | Type | Description |
|-------|------|-------------|
| name | String | Organization name |
| type | PartyType | CLIENT, SUPPLIER, VENDOR, PARTNER |
| email | String? | Contact email |
| phone | String? | Contact phone |
| address | Json? | Address details |

**Population:** Extracted from contracts during AI analysis or manually created.

### TaxonomyCategory
Hierarchical categorization for contracts.

| Field | Type | Description |
|-------|------|-------------|
| tenantId | String | Tenant association |
| name | String | Category name |
| description | String? | Category description |
| parentId | String? | Parent category (for hierarchy) |
| path | String? | Full path (e.g., "IT/Software/SaaS") |
| color | String? | UI display color |
| icon | String? | UI icon |
| keywords | String[] | Auto-categorization keywords |
| aiPrompt | String? | Custom AI classification prompt |

**Population:** Created via Taxonomy Management UI (`/taxonomy`), seeded with defaults.

---

## 4. Contract Processing & Analysis

### ProcessingJob
Tracks contract processing pipeline.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| status | JobStatus | PENDING, RUNNING, COMPLETED, FAILED, etc. |
| progress | Int | 0-100 progress percentage |
| currentStep | String? | Current processing stage |
| totalStages | Int | Number of stages |
| error | String? | Error message |
| retryCount | Int | Retry attempts |
| queueId | String? | BullMQ job ID |

**Population Flow:**
1. Created when contract upload starts
2. Updated by BullMQ workers at each stage
3. Progress events sent via WebSocket
4. Final status set on completion/failure

### Run
High-level processing run tracking.

| Field | Type | Description |
|-------|------|-------------|
| runId | String | Unique run identifier |
| contractId | String? | Optional contract reference |
| status | RunStatus | PENDING, RUNNING, COMPLETED, etc. |
| jobType | String? | Type of processing job |
| completedSteps | Int | Steps completed |
| totalSteps | Int? | Total steps |

**Population:** Created by processing orchestrator, updated by workers.

### ProgressEvent
Granular progress updates for real-time UI.

| Field | Type | Description |
|-------|------|-------------|
| jobId | String | Processing job reference |
| stage | String | Processing stage name |
| progress | Int | Stage progress percentage |
| estimatedTime | Int? | Estimated seconds remaining |

**Population:** Created by workers, consumed by WebSocket for live updates.

### ContractVersion
Version history for contracts.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| versionNumber | Int | Sequential version |
| changes | Json? | Change summary |
| fileUrl | String? | Version file URL |
| uploadedBy | String? | User who uploaded |
| isActive | Boolean | Current version flag |

**Population:** Created when new document version is uploaded.

---

## 5. Artifacts & AI Analysis

### Artifact
AI-generated analysis results stored as structured data.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| type | ArtifactType | INGESTION, OVERVIEW, CLAUSES, RATES, COMPLIANCE, etc. |
| data | Json | Structured artifact data |
| schemaVersion | String | Schema version (e.g., "v1") |
| confidence | Decimal? | AI confidence score |
| processingTime | Int? | Processing duration (ms) |

**Quality Fields:**
| Field | Type | Description |
|-------|------|-------------|
| qualityScore | Int? | 0-100 quality metric |
| completenessScore | Int? | Extraction completeness |
| accuracyScore | Int? | Data accuracy |
| userRating | Int? | 1-5 user rating |
| isUserVerified | Boolean | User verified flag |

**Processing Context:**
| Field | Type | Description |
|-------|------|-------------|
| modelUsed | String? | AI model (gpt-4o-mini, claude-3, etc.) |
| promptVersion | String? | Prompt template version |
| tokensUsed | Int? | Token consumption |
| processingCost | Decimal? | API cost in USD |

**Population Flow:**
1. Created by artifact generation workers
2. Updated when user provides feedback/ratings
3. Edit history tracked in ArtifactEdit table

**Artifact Types:**
- `INGESTION`: Raw extraction results
- `OVERVIEW`: Contract summary and key parties
- `CLAUSES`: Extracted clauses with risk analysis
- `RATES`: Rate tables and pricing data
- `COMPLIANCE`: Compliance assessment
- `RISK`: Risk analysis results
- `BENCHMARK`: Benchmarking analysis
- `FINANCIAL`: Financial analysis
- `TEMPLATE`: Template matching results
- `REPORT`: Generated reports

### ContractArtifact
Simple key-value artifacts for quick lookups.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| type | String | Artifact type |
| key | String | Artifact key |
| value | Json | Artifact value |
| confidence | Float | Extraction confidence |

**Population:** Created during processing for quick data access.

### Clause
Extracted contract clauses.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| category | String | Clause category (e.g., "Termination", "Liability") |
| text | String | Clause text |
| riskLevel | String? | LOW, MEDIUM, HIGH |
| position | Int? | Position in document |
| libraryClauseId | String? | Reference to clause library |
| similarity | Float? | Similarity to library clause |

**Population:** Created by clause extraction AI analysis.

### Embedding / ContractEmbedding
Vector embeddings for semantic search.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| chunkIndex | Int | Chunk sequence number |
| text/chunkText | String | Text chunk |
| embedding | Vector/Json | Vector embedding |
| chunkType | String? | Type of content |
| section | String? | Document section |

**Population:** Created by embedding generation worker using OpenAI embeddings API.

### Analysis Models
Specialized analysis results:

**TemplateAnalysis**
- Template detection and compliance scoring
- Deviations from standard templates

**FinancialAnalysis**
- Cost breakdown, payment terms
- Pricing tables, discounts, escalation clauses

**OverviewAnalysis**
- Contract summary, key terms
- Parties, dates, jurisdiction

**Population:** Created by respective AI analysis workers.

---

## 6. Rate Card & Benchmarking

### ImportJob
Tracks rate card file imports.

| Field | Type | Description |
|-------|------|-------------|
| source | ImportSource | UPLOAD, EMAIL, API, SCHEDULED |
| fileType | FileTypeImport | XLSX, XLS, CSV, PDF, JSON |
| status | ImportStatus | PENDING, PROCESSING, COMPLETED, etc. |
| rowsProcessed | Int | Rows processed |
| mappingTemplateId | String? | Column mapping template |
| extractedData | Json | Parsed data |

**Population:** Created when user uploads rate card file.

### RateCard
Rate card header information.

| Field | Type | Description |
|-------|------|-------------|
| supplierId | String | Supplier reference |
| supplierTier | SupplierTier | BIG_4, TIER_2, BOUTIQUE, OFFSHORE |
| effectiveDate | DateTime | Start date |
| originalCurrency | String | Source currency |
| baseCurrency | String | Normalized currency |
| status | RateCardStatus | DRAFT, PENDING_APPROVAL, APPROVED, etc. |

### RoleRate
Individual rate entries.

| Field | Type | Description |
|-------|------|-------------|
| standardizedRole | String | Normalized role name |
| seniorityLevel | SeniorityLevel | JUNIOR, MID, SENIOR, PRINCIPAL, PARTNER |
| hourlyRate | Decimal | Hourly rate |
| dailyRate | Decimal | Daily rate |
| geography | String | Geographic region |
| confidence | Decimal | Data quality confidence |

### RateCardEntry
Comprehensive rate entries with benchmarking.

| Field | Type | Description |
|-------|------|-------------|
| roleStandardized | String | Standardized role |
| dailyRate | Decimal | Rate in original currency |
| dailyRateUSD | Decimal | USD normalized |
| marketRateAverage | Decimal? | Market comparison |
| percentileRank | Int? | Market position |
| savingsAmount | Decimal? | Potential savings |
| isBaseline | Boolean | Baseline flag |
| isNegotiated | Boolean | Negotiated rate flag |

### RateCardSupplier
Supplier master data for benchmarking.

| Field | Type | Description |
|-------|------|-------------|
| name | String | Supplier name |
| tier | SupplierTier | Supplier tier |
| competitivenessScore | Decimal? | Overall score |
| totalContracts | Int | Contract count |

### BenchmarkSnapshot
Point-in-time benchmark comparisons.

| Field | Type | Description |
|-------|------|-------------|
| rateCardEntryId | String | Rate entry reference |
| average/median | Decimal | Statistical values |
| percentile25/50/75/90/95 | Decimal | Percentile distribution |
| potentialSavings | Decimal? | Savings opportunity |
| marketTrend | String? | Trend direction |

### MarketRateIntelligence
Aggregated market rate analysis.

| Field | Type | Description |
|-------|------|-------------|
| roleStandardized | String | Role name |
| seniority | SeniorityLevel | Seniority level |
| country | String | Geography |
| sampleSize | Int | Data points |
| averageRate | Decimal | Market average |
| supplierDistribution | Json | Supplier breakdown |

### RateSavingsOpportunity
Identified cost savings opportunities.

| Field | Type | Description |
|-------|------|-------------|
| category | SavingsCategory | RATE_REDUCTION, SUPPLIER_SWITCH, etc. |
| annualSavingsPotential | Decimal | Annual savings |
| effort | EffortLevel | Implementation effort |
| status | OpportunityStatus | IDENTIFIED, IN_PROGRESS, IMPLEMENTED, etc. |

**Population Flow:**
1. User uploads rate card file
2. ImportJob created with extracted data
3. Mapping template applied (auto or manual)
4. RateCard and RoleRate/RateCardEntry records created
5. Benchmarking service calculates market comparisons
6. Savings opportunities identified and stored

---

## 7. Procurement & Categorization

### ProcurementCategory
Procurement-specific categorization.

| Field | Type | Description |
|-------|------|-------------|
| categoryL1/L2/L3 | String | Three-level hierarchy |
| categoryPath | String | Full path |
| spendType | SpendType | DIRECT, INDIRECT, CAPEX, OPEX |
| isDirectSpend | Boolean | Direct spend flag |
| keywords | String[] | Auto-classification keywords |
| aiClassificationPrompt | String? | AI prompt for classification |

**Population:** Seeded with standard procurement categories, customized per tenant.

### RateCardBaseline
Target rates for negotiation and benchmarking.

| Field | Type | Description |
|-------|------|-------------|
| baselineType | BaselineType | TARGET_RATE, MARKET_BENCHMARK, etc. |
| roleStandardized | String | Role reference |
| targetRate | Decimal | Target rate |
| tolerancePercentage | Decimal? | Acceptable variance |
| approvalStatus | ApprovalStatus | PENDING, APPROVED, etc. |

### RoleTaxonomy
Standardized role definitions.

| Field | Type | Description |
|-------|------|-------------|
| standardizedName | String | Standard role name |
| category | String | Role category |
| aliases | String[] | Alternative names |
| keywords | String[] | Matching keywords |

### RoleMapping
Historical role name mappings.

| Field | Type | Description |
|-------|------|-------------|
| originalRole | String | Source role name |
| standardizedRole | String | Normalized name |
| confidence | Decimal | Mapping confidence |
| source | String | AI, USER_CORRECTION, MANUAL |

**Population:** Created by AI role standardization, refined by user corrections.

---

## 8. Workflow & Collaboration

### Workflow
Workflow definitions (approval, review).

| Field | Type | Description |
|-------|------|-------------|
| name | String | Workflow name |
| type | String | APPROVAL, REVIEW, CUSTOM |
| isDefault | Boolean | Default workflow flag |

### WorkflowStep
Individual workflow steps.

| Field | Type | Description |
|-------|------|-------------|
| workflowId | String | Workflow reference |
| name | String | Step name |
| order | Int | Step sequence |
| type | String | APPROVAL, REVIEW, NOTIFICATION |
| assignedRole | String? | Role assignment |
| timeout | Int? | Timeout in hours |

### WorkflowExecution
Active workflow instances.

| Field | Type | Description |
|-------|------|-------------|
| workflowId | String | Workflow definition |
| contractId | String | Contract reference |
| status | String | PENDING, IN_PROGRESS, COMPLETED, etc. |
| currentStep | String? | Current step ID |

### WorkflowStepExecution
Individual step executions.

| Field | Type | Description |
|-------|------|-------------|
| executionId | String | Execution reference |
| stepId | String | Step reference |
| status | String | PENDING, COMPLETED, REJECTED, etc. |
| assignedTo | String? | Assigned user |
| result | Json? | Approval result with comments |

**Population Flow:**
1. Workflow initiated via API or auto-trigger
2. WorkflowExecution created
3. WorkflowStepExecution created for each step
4. Steps progress based on user actions
5. Notifications sent at each transition

### ContractComment
Threaded comments on contracts.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| content | String | Comment text |
| mentions | String[] | @mentioned user IDs |
| parentId | String? | Reply reference |
| isResolved | Boolean | Resolution status |
| reactions | Json | Emoji reactions |

### ContractActivity
Activity log for contracts.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference |
| type | String | upload, edit, comment, approval, etc. |
| action | String | Human-readable action |
| metadata | Json? | Activity-specific data |

### Notification
User notifications.

| Field | Type | Description |
|-------|------|-------------|
| userId | String | Recipient |
| type | String | APPROVAL_REQUEST, COMMENT_MENTION, etc. |
| title | String | Notification title |
| message | String | Notification body |
| isRead | Boolean | Read status |

### DocumentShare
Document sharing permissions.

| Field | Type | Description |
|-------|------|-------------|
| documentId | String | Document reference |
| documentType | String | contract, rate_card, etc. |
| sharedWith | String | User ID or email |
| permission | String | VIEW, COMMENT, EDIT, ADMIN |
| accessToken | String? | Secure link token |

**Population:** Created when users share documents or invite collaborators.

---

## 9. Analytics & Reporting

### Metric
Time-series metrics for analytics.

| Field | Type | Description |
|-------|------|-------------|
| name | String | Metric name |
| value | Decimal | Metric value |
| unit | String? | Unit of measure |
| tags | Json? | Metric dimensions |
| timestamp | DateTime | Metric timestamp |

### AuditLog
Comprehensive audit trail.

| Field | Type | Description |
|-------|------|-------------|
| action | String | Action performed |
| resourceType | String? | Resource type |
| entityId | String? | Entity identifier |
| changes | Json? | Change details |
| ipAddress | String? | Client IP |

**Population:** Created by API middleware on significant actions.

### OnboardingAnalytics / HelpAnalytics / WidgetAnalytics
User behavior analytics for UX optimization.

**Population:** Created by frontend analytics tracking.

### ContractHealthScore
Contract health metrics.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference (unique) |
| overallScore | Int | 0-100 overall health |
| riskScore | Int | Risk component |
| complianceScore | Int | Compliance component |
| renewalReadiness | Int | Renewal preparedness |
| alertLevel | String | none, low, medium, high, critical |
| trendHistory | Json | Historical scores |

### ContractExpiration
Expiration tracking and alerts.

| Field | Type | Description |
|-------|------|-------------|
| contractId | String | Contract reference (unique) |
| expirationDate | DateTime | Expiration date |
| daysUntilExpiry | Int | Days remaining |
| expirationRisk | String | LOW, MEDIUM, HIGH, CRITICAL |
| renewalStatus | String | PENDING, INITIATED, COMPLETED, etc. |
| noticePeriodDays | Int? | Required notice period |
| noticeDeadline | DateTime? | Notice deadline |

### ExpirationAlert
Expiration notifications.

| Field | Type | Description |
|-------|------|-------------|
| alertType | String | EXPIRATION_30_DAYS, NOTICE_DEADLINE, etc. |
| severity | String | Alert severity |
| status | String | PENDING, SENT, ACKNOWLEDGED |
| scheduledFor | DateTime | Scheduled send time |

### RenewalHistory
Historical renewal records.

| Field | Type | Description |
|-------|------|-------------|
| renewalNumber | Int | Renewal sequence |
| renewalType | String | STANDARD, RENEGOTIATED, etc. |
| valueChange | Decimal? | Value change amount |
| keyChanges | Json | Summary of changes |

### ScheduledReport
Automated report scheduling.

| Field | Type | Description |
|-------|------|-------------|
| type | String | Report type |
| frequency | String | daily, weekly, monthly |
| recipients | Json | Email addresses |
| nextRun | DateTime | Next scheduled run |

**Population:** Created by scheduled jobs that calculate scores and send alerts.

---

## 10. Integration Hub

### Integration
External system connections.

| Field | Type | Description |
|-------|------|-------------|
| type | String | ERP, PROCUREMENT, SIGNATURE, STORAGE, etc. |
| provider | String | SAP, Coupa, DocuSign, google-drive, etc. |
| status | String | connected, disconnected, error |
| accessToken | String? | OAuth token |
| refreshToken | String? | OAuth refresh token |
| capabilities | String[] | Supported operations |

**Providers:**
- Cloud Storage: google-drive, sharepoint, dropbox
- E-Signature: DocuSign, Adobe Sign
- ERP: SAP, Oracle
- Procurement: Coupa, Ariba

### SyncLog
Integration sync history.

| Field | Type | Description |
|-------|------|-------------|
| integrationId | String | Integration reference |
| direction | String | INBOUND, OUTBOUND |
| status | String | PENDING, COMPLETED, FAILED |
| recordsSuccess | Int | Successful records |
| recordsFailed | Int | Failed records |

**Population:** Created by integration sync jobs.

---

## 11. Production Infrastructure

### Webhook
Webhook configurations.

| Field | Type | Description |
|-------|------|-------------|
| url | String | Webhook endpoint URL |
| secret | String? | HMAC signing secret |
| events | String[] | Subscribed event types |
| maxRetries | Int | Retry count |

### WebhookDelivery
Webhook delivery tracking.

| Field | Type | Description |
|-------|------|-------------|
| webhookId | String | Webhook reference |
| event | String | Event type |
| payload | Json | Sent payload |
| status | String | pending, success, failed |
| statusCode | Int? | HTTP response code |
| response | String? | Response body |

### IdempotencyKey
Prevents duplicate operations.

| Field | Type | Description |
|-------|------|-------------|
| key | String | Idempotency key |
| requestHash | String | Request hash |
| response | Json? | Cached response |
| expiresAt | DateTime | Key expiration |

### OutboxEvent
Transactional outbox for event publishing.

| Field | Type | Description |
|-------|------|-------------|
| eventType | String | Event type |
| aggregateType | String | Entity type |
| aggregateId | String | Entity ID |
| payload | Json | Event payload |
| status | String | pending, published, failed |

### ExchangeRate
Currency exchange rates.

| Field | Type | Description |
|-------|------|-------------|
| fromCurrency | String | Source currency |
| toCurrency | String | Target currency |
| rate | Decimal | Exchange rate |
| timestamp | DateTime | Rate timestamp |

**Population:** Updated by scheduled job fetching rates from exchange rate API.

---

## Data Flow Summary

### Contract Upload & Processing

```
User Upload → Contract (UPLOADED)
           → ProcessingJob (PENDING)
           
BullMQ Worker → ProcessingJob (RUNNING)
             → Contract.rawText extracted
             → Embedding created
             → ProgressEvent updates

AI Workers → Artifact (OVERVIEW, CLAUSES, etc.)
          → ContractMetadata populated
          → TaxonomyCategory assigned
          → Contract (COMPLETED)
```

### Rate Card Import

```
File Upload → ImportJob (PENDING)
           → MappingTemplate applied
           
Processing → ImportJob (PROCESSING)
          → RateCard created
          → RoleRate/RateCardEntry populated
          → BenchmarkSnapshot calculated
          → RateSavingsOpportunity identified
          → ImportJob (COMPLETED)
```

### Workflow Execution

```
Trigger → WorkflowExecution (PENDING)
       → WorkflowStepExecution for each step

Step Progress → Notification created
             → ContractActivity logged
             → WorkflowStepExecution (COMPLETED)
             
Completion → WorkflowExecution (COMPLETED)
          → Contract status updated
          → AuditLog entry
```

---

## Key Relationships

| Parent | Child | Relationship |
|--------|-------|--------------|
| Tenant | User, Contract, all tenant-scoped models | One-to-Many |
| Contract | Artifact, Clause, Embedding, ProcessingJob | One-to-Many |
| Contract | ContractMetadata, ContractHealthScore | One-to-One |
| User | UserSession, UserPreferences | One-to-Many/One |
| TaxonomyCategory | Contract (via categoryId) | One-to-Many |
| Workflow | WorkflowStep, WorkflowExecution | One-to-Many |
| RateCardSupplier | RateCardEntry | One-to-Many |

---

## Indexes

All tables include strategic indexes for:
- **Tenant Isolation**: `tenantId` indexed on all tenant-scoped tables
- **Time-based Queries**: `createdAt`, `updatedAt`, timestamps
- **Status Filtering**: `status` fields indexed
- **Foreign Keys**: All relationship fields indexed
- **Composite Indexes**: Common query patterns (e.g., `[tenantId, status, createdAt]`)

---

## Schema Location

The complete Prisma schema is located at:
```
packages/clients/db/schema.prisma
```

To apply schema changes:
```bash
cd packages/clients/db
npx prisma migrate dev --name <migration-name>
```

To generate Prisma Client:
```bash
npx prisma generate
```

