# Contigo Platform - Comprehensive Documentation

> **DEPRECATED:** This document is superseded by [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md). Retained for historical reference only.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Overview](#platform-overview)
3. [Architecture](#architecture)
4. [Core Functionalities](#core-functionalities)
5. [Data Models](#data-models)
6. [AI & Machine Learning](#ai--machine-learning)
7. [Workflow Engine](#workflow-engine)
8. [Integration Capabilities](#integration-capabilities)
9. [Security & Multi-Tenancy](#security--multi-tenancy)
10. [Technology Stack](#technology-stack)
11. [Deployment](#deployment)
12. [API Reference](#api-reference)

---

## Executive Summary

**Contigo** is an enterprise-grade Contract Lifecycle Management (CLM) platform powered by advanced AI capabilities. It transforms how organizations manage, analyze, and extract value from their contract portfolios.

### Key Value Propositions

- **AI-Powered Extraction**: Automatically extracts metadata, clauses, financial terms, and risks from contracts
- **Intelligent Search**: RAG-powered semantic search across entire contract portfolios
- **Renewal Management**: Proactive alerts and automated tracking of contract renewals
- **Approval Workflows**: Configurable multi-step approval processes
- **Analytics & Insights**: Real-time dashboards with forecasting and opportunity discovery
- **Multi-Tenant SaaS**: Enterprise-ready with complete tenant isolation

---

## Platform Overview

### Target Users

- **Legal Teams**: Contract review, risk assessment, clause library management
- **Procurement**: Supplier contract management, rate card comparison, spend analysis
- **Finance**: Financial terms extraction, value tracking, budget forecasting
- **Executives**: Portfolio health dashboards, compliance oversight, strategic insights

### Key Features

| Feature | Description |
|---------|-------------|
| **Contract Upload** | Multi-format support (PDF, DOCX, TXT) with OCR capabilities |
| **AI Extraction** | Automatic extraction of 18+ artifact types |
| **Clause Library** | Reusable clause templates with risk classification |
| **E-Signatures** | Integration with DocuSign, Adobe Sign, HelloSign |
| **Approval Workflows** | Configurable multi-step approval chains |
| **Renewals Tracker** | Automated expiration alerts and renewal management |
| **AI Chatbot** | Natural language querying across contracts |
| **Rate Card Analysis** | Supplier rate comparison and benchmarking |
| **Reporting** | AI-powered report generation and analytics |
| **Version Control** | Full contract versioning with comparison tools |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js 15 Web Application                  │   │
│  │  - React 18 Components  - TailwindCSS                   │   │
│  │  - Real-time Updates    - PWA Support                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Next.js API │  │  WebSocket   │  │  Background Workers  │  │
│  │   Routes     │  │   Server     │  │    (BullMQ)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Data        │  │ AI Services │  │ Integration Services    │ │
│  │ Orchestration│  │ (OpenAI,   │  │ (DocuSign, Google,     │ │
│  │             │  │  Embeddings)│  │  SharePoint, SAP)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │   PostgreSQL    │  │    Redis    │  │   Object Storage  │   │
│  │   (Prisma ORM)  │  │   (Cache +  │  │   (S3/MinIO)      │   │
│  │   + pgvector    │  │    Queue)   │  │                   │   │
│  └─────────────────┘  └─────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
/
├── apps/
│   └── web/                    # Next.js 15 Web Application
│       ├── app/                # App Router (pages & API routes)
│       ├── components/         # React components
│       ├── lib/                # Utilities & services
│       └── hooks/              # Custom React hooks
│
├── packages/
│   ├── clients/
│   │   └── db/                 # Prisma schema & migrations
│   ├── data-orchestration/     # Core business logic
│   ├── workers/                # Background job processors
│   ├── agents/                 # AI agent definitions
│   ├── schemas/                # Shared TypeScript types
│   └── utils/                  # Shared utilities
│
└── docker-compose.*.yml        # Container orchestration
```

---

## Core Functionalities

### 1. Contract Management

#### Upload & Processing Pipeline

```
Upload → OCR → Text Extraction → AI Analysis → Artifact Generation → Indexing
```

**Supported Formats:**

- PDF (with OCR for scanned documents)
- Microsoft Word (DOCX)
- Plain Text (TXT)
- Images (with Tesseract OCR)

**Processing Stages:**

1. **Ingestion**: File upload, validation, storage
2. **OCR/Extraction**: Text extraction with table detection
3. **AI Analysis**: Multi-pass extraction using GPT-4o-mini
4. **Artifact Generation**: Structured data output (18+ types)
5. **Indexing**: Vector embeddings for semantic search
6. **Quality Validation**: Confidence scoring and human review flags

#### Contract Statuses

| Status | Description |
|--------|-------------|
| `UPLOADED` | File received, awaiting processing |
| `PROCESSING` | AI extraction in progress |
| `COMPLETED` | Successfully processed |
| `FAILED` | Processing error occurred |
| `ACTIVE` | Contract is active/signed |
| `PENDING` | Awaiting approval/signature |
| `DRAFT` | Draft contract |
| `EXPIRED` | Contract has expired |
| `ARCHIVED` | Archived for retention |

### 2. AI Artifact Extraction

The platform generates 18+ artifact types from each contract:

| Artifact Type | Description |
|---------------|-------------|
| `OVERVIEW` | Contract summary, parties, key terms |
| `FINANCIAL` | Payment terms, pricing, total value |
| `CLAUSES` | Clause-by-clause extraction |
| `RISK` | Risk identification and scoring |
| `OBLIGATIONS` | Party obligations tracking |
| `COMPLIANCE` | Regulatory compliance analysis |
| `RATES` | Rate card/pricing extraction |
| `TERMINATION_CLAUSE` | Exit terms and conditions |
| `LIABILITY_CLAUSE` | Liability and indemnification |
| `SLA_TERMS` | Service level agreements |
| `RENEWAL` | Renewal terms and dates |
| `NEGOTIATION_POINTS` | Suggested negotiation items |
| `AMENDMENTS` | Amendment tracking |
| `CONTACTS` | Contact information |

#### Artifact Quality Metrics

- **Confidence Score**: 0-100% AI extraction confidence
- **Completeness Score**: Data completeness rating
- **Accuracy Score**: Validated accuracy
- **User Verification**: Human validation tracking

### 3. Clause Library

Centralized repository of standard clauses for contract authoring:

```typescript
interface ClauseLibrary {
  id: string;
  name: string;
  title: string;
  category: string;           // e.g., "indemnification", "termination"
  content: string;            // Clause text with {{variables}}
  riskLevel: RiskLevel;       // LOW, MEDIUM, HIGH, CRITICAL
  jurisdiction: string[];     // Applicable jurisdictions
  contractTypes: string[];    // Applicable contract types
  version: number;
  usageCount: number;
  embedding?: number[];       // Vector for semantic search
}
```

### 4. E-Signature Integration

Unified signature workflow supporting multiple providers:

```typescript
interface SignatureRequest {
  id: string;
  contractId: string;
  provider: 'docusign' | 'adobe_sign' | 'hellosign' | 'manual';
  status: 'draft' | 'sent' | 'viewed' | 'partially_signed' | 'completed' | 'declined' | 'expired';
  signers: Signer[];          // JSON array of signers with status
  expiresAt: Date;
  externalId?: string;        // Provider's document ID
}
```

### 5. Approval Workflows

Configurable multi-step approval processes:

```
Workflow Definition          Workflow Execution
──────────────────           ─────────────────
┌──────────────┐             ┌───────────────────────┐
│   Workflow   │────────────▶│  WorkflowExecution    │
│   (Template) │             │  - Per Contract       │
└──────────────┘             └───────────────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐             ┌───────────────────────┐
│ WorkflowStep │────────────▶│ WorkflowStepExecution │
│ (Ordered)    │             │ - Per Step Instance   │
└──────────────┘             └───────────────────────┘
```

**Step Types:**

- `APPROVAL`: Requires explicit approve/reject action
- `REVIEW`: Review and proceed
- `NOTIFICATION`: Inform stakeholder
- `CUSTOM`: Custom action handler

### 6. Renewals Management

Proactive contract renewal tracking:

- **Expiration Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL, EXPIRED
- **Auto-renewal Detection**: Identifies auto-renewal clauses
- **Notification System**: Configurable alerts at 90/60/30/14/7 days
- **Renewal Workflows**: Automated workflow triggering
- **Forecasting**: Portfolio renewal projections

### 7. AI Intelligence Hub

#### RAG-Powered Search

Vector-based semantic search across all contracts using:

- OpenAI text-embedding-3-small (1536 dimensions)
- pgvector for PostgreSQL-native vector storage
- Hybrid search combining semantic + keyword matching

#### AI Chatbot

Natural language interface for:

- "What are our obligations in the Acme contract?"
- "Which contracts expire next quarter?"
- "Show me all indemnification clauses over $1M"

#### Forecasting

Portfolio analytics including:

- Renewal projections
- Spend forecasting
- Scenario modeling (baseline, aggressive, conservative)

---

## Data Models

### Core Entity Relationships

```
Tenant (1) ────────────────────────────────────┬──▶ (N) User
    │                                           │
    │                                           ▼
    │                                      UserRole ◀──── Role ◀──── Permission
    │
    ├──▶ (N) Contract
    │         │
    │         ├──▶ (N) Artifact
    │         ├──▶ (N) ContractVersion
    │         ├──▶ (N) ContractMetadata
    │         ├──▶ (N) ProcessingJob
    │         ├──▶ (N) SignatureRequest
    │         ├──▶ (N) WorkflowExecution
    │         ├──▶ (N) Clause
    │         ├──▶ (N) ContractEmbedding
    │         └──▶ (1) TemplateAnalysis
    │              (1) FinancialAnalysis
    │              (1) OverviewAnalysis
    │
    ├──▶ (N) Workflow ──▶ (N) WorkflowStep
    │
    ├──▶ (N) ClauseLibrary
    │
    ├──▶ (N) Notification
    │
    ├──▶ (N) AuditLog
    │
    └──▶ (N) Integration
```

### Key Models

#### Contract

The central entity with 80+ fields covering:

- Basic metadata (filename, dates, status)
- Financial terms (total value, payment terms)
- Taxonomy (category, type, pricing model)
- Hierarchy (parent/child relationships)
- Renewal tracking (expiration risk, auto-renewal)
- Processing state (job status, artifacts)

#### Artifact

AI-extracted structured data:

- 18 distinct types (OVERVIEW, FINANCIAL, RISK, etc.)
- Version tracking with regeneration support
- Quality metrics (confidence, completeness)
- User feedback and verification
- Edit history and propagation tracking

#### ContractMetadata

Extended metadata for lifecycle management:

- Renewal tracking and checklists
- Negotiation status
- Performance metrics (SLA compliance)
- AI insights cache
- Compliance and audit trails

---

## AI & Machine Learning

### Models Used

| Purpose | Model | Provider |
|---------|-------|----------|
| Text Extraction | GPT-4o-mini | OpenAI |
| Embeddings | text-embedding-3-small | OpenAI |
| Document Classification | GPT-4o-mini | OpenAI |
| Risk Assessment | GPT-4o-mini | OpenAI |

### Extraction Pipeline

```typescript
// Extraction flow with validation
async function processContract(contractId: string) {
  // 1. Extract text (OCR if needed)
  const text = await extractText(contractId);
  
  // 2. Generate artifacts (parallel)
  const artifacts = await Promise.all([
    generateOverview(text),
    generateFinancial(text),
    generateRisk(text),
    generateClauses(text),
    // ... more artifact types
  ]);
  
  // 3. Validate and score
  for (const artifact of artifacts) {
    artifact.confidence = calculateConfidence(artifact);
    artifact.validationStatus = await validate(artifact);
  }
  
  // 4. Generate embeddings for RAG
  await generateEmbeddings(contractId, text);
  
  // 5. Update contract status
  await updateContractStatus(contractId, 'COMPLETED');
}
```

### Confidence Scoring

Artifacts receive confidence scores based on:

- Source text clarity
- Field completeness
- Cross-reference validation
- Pattern matching accuracy

**Thresholds:**

- `≥85%`: High confidence, auto-validated
- `60-84%`: Medium confidence, recommended review
- `<60%`: Low confidence, requires human review

---

## Workflow Engine

### Workflow Definition

```typescript
// Creating a workflow template
const approvalWorkflow = {
  name: "Standard Contract Approval",
  type: "APPROVAL",
  steps: [
    {
      name: "Legal Review",
      type: "APPROVAL",
      assignedRole: "legal",
      isRequired: true,
      timeout: 72 // hours
    },
    {
      name: "Finance Review",
      type: "APPROVAL",
      assignedRole: "finance",
      isRequired: true
    },
    {
      name: "VP Approval",
      type: "APPROVAL",
      assignedUser: "vp-user-id",
      isRequired: true
    }
  ]
};
```

### Execution States

| Step Status | Description |
|-------------|-------------|
| `PENDING` | Waiting for previous step |
| `WAITING` | Assigned but not started |
| `IN_PROGRESS` | Currently being reviewed |
| `COMPLETED` | Approved/completed |
| `REJECTED` | Rejected at this step |
| `SKIPPED` | Skipped (optional step) |
| `FAILED` | System error |

### Step Actions

```typescript
// Available actions per step
interface StepActions {
  approve: (comment?: string) => Promise<void>;
  reject: (reason: string) => Promise<void>;
  delegate: (userId: string) => Promise<void>;
  requestInfo: (question: string) => Promise<void>;
  skip: () => Promise<void>; // For optional steps
}
```

---

## Integration Capabilities

### Supported Integrations

| Category | Providers |
|----------|-----------|
| **E-Signature** | DocuSign, Adobe Sign, HelloSign |
| **Cloud Storage** | Google Drive, SharePoint, Dropbox, Box |
| **ERP Systems** | SAP, Oracle |
| **Procurement** | Coupa, Ariba |
| **Communication** | Slack, Microsoft Teams |
| **SSO/Identity** | OAuth 2.0, SAML 2.0 |

### Integration Model

```typescript
interface Integration {
  id: string;
  tenantId: string;
  type: 'ERP' | 'PROCUREMENT' | 'SIGNATURE' | 'STORAGE' | 'COMMUNICATION';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  
  // OAuth tokens
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  
  // Health monitoring
  lastHealthCheck?: Date;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  uptime: number; // Percentage
  
  // Usage metrics
  recordsProcessed: number;
  documentsProcessed: number;
  errors24h: number;
}
```

---

## Security & Multi-Tenancy

### Tenant Isolation

- **Database Level**: All queries include `tenantId` filter
- **API Level**: Tenant extracted from JWT/session
- **Storage Level**: Tenant-prefixed paths
- **Indexes**: All critical indexes include `tenantId`

```typescript
// Example tenant-scoped query
const contracts = await prisma.contract.findMany({
  where: {
    tenantId,  // Always required
    status: 'ACTIVE'
  }
});
```

### Role-Based Access Control (RBAC)

```
User ──▶ UserRole ──▶ Role ──▶ RolePermission ──▶ Permission
                                    │
                                    ▼
                              action: "read" | "create" | "update" | "delete"
                              subject: "contract" | "workflow" | "user" | ...
                              conditions: { ownOnly: true, ... }
```

### Audit Logging

All significant actions are logged:

```typescript
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'APPROVE' | 'REJECT';
  entityType: string;
  entityId: string;
  changes?: object;      // Before/after diff
  metadata?: object;     // Additional context
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

---

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework with App Router |
| React 18 | UI library |
| TailwindCSS | Styling |
| Framer Motion | Animations |
| Radix UI | Accessible components |
| TanStack Query | Data fetching & caching |
| Zustand | State management |

### Backend

| Technology | Purpose |
|------------|---------|
| Next.js API Routes | REST API endpoints |
| Prisma ORM | Database access |
| BullMQ | Job queues |
| WebSocket | Real-time updates |
| OpenAI SDK | AI integration |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database |
| pgvector | Vector embeddings |
| Redis | Caching & queues |
| MinIO/S3 | Object storage |
| Docker | Containerization |

### DevOps

| Technology | Purpose |
|------------|---------|
| pnpm | Package management |
| Turborepo | Monorepo tooling |
| GitHub Actions | CI/CD |
| Playwright | E2E testing |
| Vitest | Unit testing |

---

## Deployment

### Docker Compose Profiles

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up

# With RAG (vector search)
docker-compose -f docker-compose.rag.yml up

# Full stack (all services)
docker-compose -f docker-compose.full.yml up
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/contracts

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-...

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Storage
S3_BUCKET=contracts
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Integrations (optional)
DOCUSIGN_INTEGRATION_KEY=...
GOOGLE_CLIENT_ID=...
```

### Scaling Considerations

- **Database**: Connection pooling via PgBouncer
- **Workers**: Horizontal scaling with BullMQ
- **Storage**: CDN for document delivery
- **Caching**: Redis cluster for high availability

---

## API Reference

### Core Endpoints

#### Contracts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/contracts` | List contracts |
| `POST` | `/api/contracts` | Create contract |
| `GET` | `/api/contracts/[id]` | Get contract |
| `PATCH` | `/api/contracts/[id]` | Update contract |
| `DELETE` | `/api/contracts/[id]` | Delete contract |
| `GET` | `/api/contracts/[id]/artifacts` | Get artifacts |
| `POST` | `/api/contracts/[id]/reprocess` | Reprocess contract |

#### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/workflows` | List workflows |
| `POST` | `/api/workflows` | Create workflow |
| `POST` | `/api/workflows/[id]/execute` | Start execution |
| `POST` | `/api/workflows/executions/[id]/step` | Advance step |

#### Approvals

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/approvals` | List pending approvals |
| `POST` | `/api/approvals` | Submit action (approve/reject) |

#### AI Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/chat` | Chat with AI |
| `POST` | `/api/ai/search` | Semantic search |
| `POST` | `/api/ai/summarize` | Summarize contract |

### Response Format

```typescript
// Success response
{
  success: true,
  data: { ... },
  source: 'database',
  pagination?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}

// Error response
{
  success: false,
  error: 'Error message',
  code?: 'ERROR_CODE',
  details?: { ... }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Jan 2026 | AI extraction, workflow engine, multi-tenant |
| 1.5.0 | Oct 2025 | Rate card analysis, benchmarking |
| 1.0.0 | Jul 2025 | Initial release |

---

## Support & Contact

For technical support or inquiries:

- **Documentation**: This file
- **API Docs**: `/api-docs` (Swagger)
- **Architecture**: See `ARCHITECTURE_*.md` files

---

*This document was generated on January 15, 2026. For the latest updates, refer to the repository documentation.*
