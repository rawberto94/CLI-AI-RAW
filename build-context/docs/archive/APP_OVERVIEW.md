# 📋 Contract Intelligence Platform - Application Overview

> **Enterprise Contract Management and Intelligence Platform with Advanced RAG, Analytics, and AI-Powered Insights**

---

## 🎯 Main Purpose

The **Contract Intelligence Platform** is a comprehensive enterprise-grade solution for managing, analyzing, and extracting intelligence from contracts and procurement documents. It leverages AI/ML technologies to provide:

- **Automated contract processing and analysis**
- **Rate card benchmarking and cost optimization**
- **Risk assessment and compliance monitoring**
- **Renewal tracking and deadline management**
- **AI-powered semantic search and insights**

---

## 🚀 Key Features

### 1. Contract Management

- **Upload & Processing**: Support for PDF, DOCX, XLSX, and other document formats
- **OCR Processing**: Extract text from scanned documents using AWS Textract
- **Bulk Operations**: Mass upload and batch processing capabilities
- **Version Control**: Track contract versions and amendments
- **Contract Hierarchy**: Support for parent-child relationships (MSA → SOW → Amendments)
- **Soft Delete**: Recoverable document deletion with audit trail

### 2. AI-Powered Analysis

- **Artifact Generation**: Automatically extract key contract information:
  - Overview & Summary
  - Clauses Analysis (liability, termination, SLA, etc.)
  - Financial Terms & Rate Tables
  - Compliance Assessment
  - Risk Analysis
  - Renewal Terms & Obligations
  - Negotiation Points
- **Multi-Pass Processing**: Advanced extraction using multiple AI passes for accuracy
- **Confidence Scoring**: Quality metrics for extracted data

### 3. Rate Card Intelligence

- **Rate Card Management**: Import, store, and analyze vendor rate cards
- **Benchmarking**: Compare rates against market averages and internal baselines
- **Role Standardization**: AI-powered role name normalization across suppliers
- **Geographic Analysis**: Rate comparisons across regions with arbitrage opportunities
- **Supplier Scoring**: Multi-factor supplier evaluation and ranking
- **Savings Opportunities**: Automated identification of cost-saving possibilities
- **Predictive Analytics**: Rate forecasting with trend analysis

### 4. RAG (Retrieval-Augmented Generation) System

- **Vector Search**: Semantic search using pgvector embeddings
- **Knowledge Graph**: Entity relationships and contract networks
- **Multi-Modal Processing**: Tables, images, and mixed content handling
- **Cross-Contract Intelligence**: Pattern detection and risk correlation
- **Natural Language Queries**: Ask questions about contracts in plain English

### 5. Workflow & Approvals

- **Configurable Workflows**: Custom approval chains and review processes
- **Step-Based Execution**: Track progress through multi-step workflows
- **Assignment & Notifications**: Automatic task assignment with alerts
- **Deadline Management**: SLA tracking and escalation

### 6. Analytics & Reporting

- **Dashboard Metrics**: Real-time KPIs and trend visualization
- **Procurement Analytics**: Spend analysis by category, supplier, and region
- **Savings Tracking**: Monitor realized vs. projected savings
- **Custom Reports**: AI-assisted report generation
- **Scheduled Reports**: Automated report delivery via email

### 7. Collaboration Features

- **Comments & Mentions**: Team discussions on contracts with @mentions
- **Activity Feed**: Track all changes and interactions
- **Document Sharing**: Secure sharing with permission controls
- **Real-Time Notifications**: WebSocket-based instant updates

### 8. Integration Hub

- **Cloud Storage**: Google Drive, SharePoint, Dropbox integrations
- **ERP Systems**: SAP, Coupa connectivity
- **E-Signature**: DocuSign integration
- **API Access**: RESTful API for external systems
- **Webhooks**: Event-driven notifications to external systems

### 9. Expiration & Renewal Management

- **Expiration Tracking**: Automated monitoring of contract end dates
- **Alert System**: Configurable notifications at 30/60/90 days
- **Renewal Workflows**: Guided renewal process
- **Historical Tracking**: Complete renewal history with term changes
- **Health Scoring**: Contract health metrics with trend analysis

### 10. Compliance & Governance

- **Audit Logging**: Complete trail of all actions
- **Role-Based Access Control (RBAC)**: Granular permissions
- **Multi-Tenancy**: Isolated tenant data with configurable settings
- **Data Retention**: Configurable retention policies

---

## 🏗️ Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                     Next.js 15 (App Router)                             │
│                   React 19, TypeScript, Tailwind CSS                    │
│                    Port: 3005 (Turbopack Dev)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                     │
│              Next.js API Routes + Data Orchestration                    │
│                                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Contracts  │  │  Rate Cards  │  │   Analytics  │  │    AI/RAG    │  │
│  │     API     │  │     API      │  │     API      │  │     API      │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICES LAYER                                    │
│                   packages/data-orchestration                           │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  Contract Svc   │  │ Rate Card Svc   │  │  Analytics Svc  │         │
│  │  Artifact Svc   │  │ Benchmark Svc   │  │  Savings Svc    │         │
│  │  Processing Svc │  │ Clustering Svc  │  │  Forecasting    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   Workflow Svc  │  │  Webhook Svc    │  │  Validation Svc │         │
│  │   Audit Svc     │  │  Notification   │  │  Cache Svc      │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   BACKGROUND    │     │    DATABASE     │     │   EXTERNAL      │
│    WORKERS      │     │     LAYER       │     │    SERVICES     │
│                 │     │                 │     │                 │
│ • OCR Worker    │     │ PostgreSQL      │     │ OpenAI GPT-4    │
│ • Artifact Gen  │     │ + pgvector      │     │ Mistral AI      │
│ • Webhook       │     │                 │     │ AWS Textract    │
│ • RAG Indexing  │     │ Redis           │     │ MinIO/S3        │
│ • Metadata      │     │ (Cache/Queue)   │     │ Cloud Storage   │
│ • Renewal Alert │     │                 │     │                 │
│ • Categorization│     │ BullMQ          │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Component Breakdown

| Component | Technology | Port | Purpose |
|-----------|------------|------|---------|
| Frontend | Next.js 15, React 19, Tailwind CSS | 3005 | User interface |
| API | Next.js API Routes | 3005 | RESTful endpoints |
| Database | PostgreSQL 15 + pgvector | 5432 | Primary data store |
| Cache/Queue | Redis + BullMQ | 6379 | Caching & job queues |
| Storage | MinIO (S3-compatible) | 9000/9001 | File storage |
| Workers | BullMQ Workers | - | Background processing |

---

## 📦 Packages Structure

### `/packages/clients` - External Service Clients

| Package | Purpose |
|---------|---------|
| `clients/db` | Prisma ORM client with PostgreSQL + pgvector |
| `clients/openai` | OpenAI API wrapper for GPT-4 |
| `clients/rag` | RAG utilities: chunking, embedding, retrieval |
| `clients/storage` | MinIO/S3 file storage client |
| `clients/queue` | BullMQ job queue client |

### `/packages/data-orchestration` - Core Business Logic

Contains 100+ services organized by domain:

**Contract Services:**

- `contract.service.ts` - Core contract CRUD operations
- `artifact.service.ts` - AI artifact management
- `processing-job.service.ts` - Contract processing pipeline
- `chunked-upload.service.ts` - Large file uploads

**Rate Card Services:**

- `rate-card-management.service.ts` - Rate card CRUD
- `rate-card-benchmarking.service.ts` - Market comparisons
- `rate-card-intelligence.service.ts` - Advanced analytics
- `rate-card-clustering.service.ts` - Rate grouping/consolidation
- `role-standardization.service.ts` - Role name normalization

**Analytics Services:**

- `analytics.service.ts` - Dashboard metrics
- `cost-savings-analyzer.service.ts` - Savings identification
- `predictive-analytics.service.ts` - Forecasting
- `competitive-intelligence.service.ts` - Market analysis

**Infrastructure Services:**

- `audit-trail.service.ts` - Audit logging
- `webhook.service.ts` - External notifications
- `smart-cache.service.ts` - Multi-level caching
- `validation.service.ts` - Input validation

### `/packages/workers` - Background Processing

| Worker | Purpose |
|--------|---------|
| `ocr-artifact-worker.ts` | OCR processing with AWS Textract |
| `artifact-generator.ts` | AI artifact extraction |
| `metadata-extraction-worker.ts` | Document metadata extraction |
| `rag-indexing-worker.ts` | Vector embedding generation |
| `categorization-worker.ts` | Auto-categorization |
| `renewal-alert-worker.ts` | Expiration monitoring |
| `obligation-tracker-worker.ts` | Contract obligation tracking |
| `webhook-worker.ts` | Webhook delivery |

### `/packages/schemas` - Shared Types & Validation

- Zod schemas for data validation
- Rate card ingestion schemas
- Shared TypeScript types

### `/packages/agents` - AI Agents

- Professional services AI orchestrator
- Multi-step AI reasoning pipelines

### `/packages/utils` - Shared Utilities

- Queue service wrapper
- Common helper functions

---

## 📱 Application Routes

### `/apps/web/app` - Frontend Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/dashboard` | Main dashboard with KPIs |
| `/contracts` | Contract list and management |
| `/contracts/[id]` | Single contract view with artifacts |
| `/contracts/upload` | Upload new contracts |
| `/contracts/bulk` | Bulk operations |
| `/contracts/generate` | AI contract generation |
| `/analytics/*` | Analytics dashboards (procurement, savings, suppliers, renewals) |
| `/rate-cards/*` | Rate card management and benchmarking |
| `/rate-cards/benchmarking` | Rate comparisons |
| `/rate-cards/opportunities` | Savings opportunities |
| `/rate-cards/forecasts` | Rate predictions |
| `/rate-cards/baselines` | Target rate management |
| `/intelligence/*` | AI intelligence features |
| `/intelligence/search` | Semantic search |
| `/intelligence/negotiate` | AI negotiation assistant |
| `/renewals` | Renewal management |
| `/risk` | Risk assessment dashboard |
| `/compliance` | Compliance monitoring |
| `/workflows` | Workflow management |
| `/approvals` | Approval queue |
| `/governance` | Governance controls |
| `/search` | Global search |
| `/settings` | System settings |
| `/admin` | Admin panel |
| `/team` | Team management |
| `/integrations` | Integration management |

### API Routes (`/apps/web/app/api`)

| Category | Key Endpoints |
|----------|---------------|
| `/api/contracts/*` | Contract CRUD, upload, artifacts, metadata |
| `/api/ai/*` | AI analysis, chat, suggestions |
| `/api/rag/*` | RAG search and batch processing |
| `/api/rate-cards/*` | Rate card management |
| `/api/analytics/*` | Analytics data endpoints |
| `/api/workflows/*` | Workflow operations |
| `/api/auth/*` | Authentication |
| `/api/upload/*` | File uploads |
| `/api/webhooks/*` | Webhook management |

---

## 🗄️ Database Models (Prisma)

### Core Entities

| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant organization |
| `User` | User accounts with RBAC |
| `Contract` | Core contract entity |
| `Artifact` | AI-generated contract analysis |
| `ContractVersion` | Version history |
| `ContractMetadata` | Extended metadata |
| `Clause` | Extracted contract clauses |

### Rate Card Models

| Model | Purpose |
|-------|---------|
| `RateCard` | Rate card imports |
| `RateCardEntry` | Individual rate records |
| `RoleRate` | Role-based rates |
| `RateCardBaseline` | Target/benchmark rates |
| `BenchmarkSnapshot` | Point-in-time benchmarks |
| `RateSavingsOpportunity` | Identified savings |
| `RateForecast` | Rate predictions |
| `SupplierScore` | Supplier evaluations |

### Processing & Workflow

| Model | Purpose |
|-------|---------|
| `ProcessingJob` | Contract processing queue |
| `Run` | Processing run tracking |
| `Workflow` | Workflow definitions |
| `WorkflowExecution` | Workflow instances |
| `WorkflowStep` | Workflow steps |

### Collaboration & Audit

| Model | Purpose |
|-------|---------|
| `ContractComment` | Discussion threads |
| `ContractActivity` | Activity feed |
| `AuditLog` | Audit trail |
| `Notification` | User notifications |
| `DocumentShare` | Sharing permissions |

### Expiration & Health

| Model | Purpose |
|-------|---------|
| `ContractExpiration` | Expiration tracking |
| `ExpirationAlert` | Renewal alerts |
| `ContractHealthScore` | Health metrics |
| `RenewalHistory` | Renewal records |

### Integration

| Model | Purpose |
|-------|---------|
| `Integration` | External system connections |
| `Webhook` | Webhook configurations |
| `WebhookDelivery` | Delivery tracking |
| `OutboxEvent` | Event publishing queue |

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.1+ | React framework with App Router |
| React | 19.0 | UI library |
| TypeScript | 5.7+ | Type safety |
| Tailwind CSS | 3.4+ | Styling |
| Radix UI | Latest | Accessible components |
| Recharts | 2.15 | Charts & visualization |
| Zustand | 5.0 | State management |
| React Query | 5.90+ | Data fetching |
| Framer Motion | 11.x | Animations |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Prisma | 5.22+ | ORM |
| BullMQ | 4.18+ | Job queue |
| Zod | 3.23+ | Schema validation |
| Pino | 9.5+ | Logging |

### Database & Storage

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15+ | Primary database |
| pgvector | Latest | Vector embeddings |
| Redis | 7+ | Cache & queue backend |
| MinIO | Latest | S3-compatible storage |

### AI/ML

| Technology | Purpose |
|------------|---------|
| OpenAI GPT-4 | Primary LLM for analysis |
| Mistral AI | Alternative LLM |
| AWS Textract | OCR processing |
| text-embedding-3-small | Vector embeddings |

### DevOps

| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| pnpm | Package management |
| Turbo | Monorepo build system |
| GitHub Actions | CI/CD |
| Playwright | E2E testing |
| Vitest | Unit testing |

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root package config & scripts |
| `pnpm-workspace.yaml` | Monorepo workspace definition |
| `turbo.json` | Turborepo build configuration |
| `tsconfig.json` | TypeScript configuration |
| `docker-compose.*.yml` | Docker environments (dev, staging, prod) |
| `Dockerfile.*` | Container definitions |
| `ecosystem.config.cjs` | PM2 process manager config |
| `.env` files | Environment variables |

---

## 🚀 Quick Start Commands

```bash
# Install dependencies
pnpm install

# Start development (web + workers)
pnpm dev

# Start only web app
pnpm dev:web

# Start all services (Docker)
pnpm dev:all

# Database operations
pnpm db:migrate    # Run migrations
pnpm db:generate   # Generate Prisma client
pnpm db:studio     # Open Prisma Studio
pnpm db:push       # Push schema to database

# Build for production
pnpm build

# Run tests
pnpm test          # E2E tests
pnpm test:e2e      # Playwright tests
```

---

## 📊 Key URLs (Development)

| Service | URL |
|---------|-----|
| Main Application | <http://localhost:3005> |
| RAG Chat | <http://localhost:3005/rag/chat> |
| Intelligence | <http://localhost:3005/intelligence> |
| Analytics | <http://localhost:3005/analytics> |
| Prisma Studio | <http://localhost:5555> |
| MinIO Console | <http://localhost:9001> |

---

## 📁 Directory Structure Summary

```
CLI-AI-RAW/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router pages & API routes
│       │   ├── api/            # API endpoints
│       │   ├── contracts/      # Contract pages
│       │   ├── analytics/      # Analytics pages
│       │   ├── rate-cards/     # Rate card pages
│       │   ├── intelligence/   # AI intelligence pages
│       │   └── ...             # Other feature pages
│       ├── components/         # React components
│       └── lib/                # Client utilities
│
├── packages/
│   ├── clients/                # External service clients
│   │   ├── db/                 # Prisma + PostgreSQL
│   │   ├── openai/             # OpenAI client
│   │   ├── rag/                # RAG utilities
│   │   ├── storage/            # MinIO/S3 client
│   │   └── queue/              # BullMQ client
│   ├── data-orchestration/     # Core services (100+ services)
│   ├── workers/                # Background job processors
│   ├── schemas/                # Shared schemas & types
│   ├── agents/                 # AI agents
│   └── utils/                  # Shared utilities
│
├── scripts/                    # Build & deployment scripts
├── kubernetes/                 # K8s deployment configs
├── nginx/                      # Nginx configuration
├── docs/                       # Documentation
├── data/                       # Test data & samples
└── docker-compose.*.yml        # Docker configurations
```

---

## 🔒 Security Features

- **Multi-Tenancy**: Complete data isolation per tenant
- **RBAC**: Role-based access control with granular permissions
- **Audit Logging**: Complete action trail
- **Rate Limiting**: API protection
- **Data Encryption**: At rest and in transit
- **Webhook Signatures**: HMAC verification
- **Session Management**: Secure token handling

---

## 📈 Scalability Features

- **Background Workers**: Offload heavy processing
- **Job Queues**: BullMQ with Redis backend
- **Multi-Level Caching**: Smart caching strategies
- **Database Optimization**: Extensive indexing
- **Connection Pooling**: PgBouncer support
- **Horizontal Scaling**: Stateless design

---

*Last Updated: December 2024*
*Version: 2.0.0*

