# ConTigo Platform - Technical Documentation

> **Version:** 2.0.0  
> **Last Updated:** January 2026  
> **Platform:** AI-Powered Contract Intelligence System

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Core Features](#core-features)
6. [Application Pages](#application-pages)
7. [API Reference](#api-reference)
8. [Component Library](#component-library)
9. [Database Schema](#database-schema)
10. [Authentication & Security](#authentication--security)
11. [Real-Time Features](#real-time-features)
12. [AI/ML Capabilities](#aiml-capabilities)
13. [Deployment](#deployment)
14. [Development Guide](#development-guide)

---

## Overview

**ConTigo** is a next-generation, AI-powered contract intelligence platform designed for enterprise contract lifecycle management. The platform leverages cutting-edge AI/ML technologies to automate contract analysis, risk detection, obligation tracking, and negotiation assistance.

### Key Capabilities

- 🔍 **AI Contract Analysis** - Instant extraction of key terms, parties, dates, and obligations
- ⚠️ **Risk Detection** - Automated identification of legal and financial risks
- 💬 **Natural Language Q&A** - Ask questions about contracts in plain English
- 📊 **Rate Card Intelligence** - Market benchmarking and supplier analysis
- 🔄 **Renewal Management** - Proactive tracking of contract expirations
- 📝 **AI Contract Generation** - Draft contracts using AI assistance
- 🎯 **Obligation Tracking** - Never miss a compliance deadline

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Next.js    │  │   React     │  │  Tailwind   │  │   Framer    │        │
│  │  App Router │  │   Query     │  │    CSS      │  │   Motion    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  REST API   │  │  WebSocket  │  │  Auth.js    │  │   Rate      │        │
│  │  Routes     │  │  Server     │  │  (NextAuth) │  │  Limiting   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCESSING LAYER                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   BullMQ    │  │   Workers   │  │    RAG      │  │   OpenAI    │        │
│  │   Queues    │  │  (Agents)   │  │   Engine    │  │   / LLMs    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATA LAYER                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │   Redis     │  │   MinIO     │  │   Vector    │        │
│  │  (Prisma)   │  │   Cache     │  │  Storage    │  │   Store     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

```
/
├── apps/
│   └── web/                    # Next.js 15 Application
│       ├── app/                # App Router pages & API routes
│       ├── components/         # React component library (200+)
│       ├── contexts/           # React Context providers
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utility libraries
│       └── server/             # WebSocket server
│
├── packages/
│   ├── agents/                 # AI Agent definitions
│   ├── clients/                # External service clients
│   │   ├── db/                 # Prisma database client
│   │   ├── openai/             # OpenAI API client
│   │   ├── queue/              # BullMQ queue client
│   │   ├── rag/                # RAG engine client
│   │   └── storage/            # MinIO storage client
│   ├── data-orchestration/     # Data pipeline orchestration
│   ├── schemas/                # Shared Zod schemas
│   ├── utils/                  # Shared utilities
│   └── workers/                # Background job workers
│
├── docker-compose.*.yml        # Docker configurations
└── scripts/                    # Build & deployment scripts
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.1.4 | React framework with App Router |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5.7.2 | Type safety |
| **Tailwind CSS** | 3.4.17 | Utility-first styling |
| **Framer Motion** | 11.18.2 | Animations |
| **Radix UI** | Latest | Headless UI components |
| **TanStack Query** | 5.90.11 | Data fetching & caching |
| **Zustand** | 5.0.8 | State management |
| **Recharts** | 2.15.0 | Data visualization |
| **Lucide React** | 0.468.0 | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime environment |
| **Prisma** | 5.22.0 | ORM & database toolkit |
| **BullMQ** | 4.18.3 | Job queue management |
| **Socket.IO** | 4.7.2 | Real-time communication |
| **OpenAI** | 4.10.0 | AI/LLM integration |
| **Pino** | 9.5.0 | Logging |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database |
| **Redis** | Caching & job queues |
| **MinIO** | S3-compatible object storage |
| **Docker** | Containerization |
| **Sentry** | Error tracking |
| **OpenTelemetry** | Observability |

### AI/ML Stack

| Technology | Purpose |
|------------|---------|
| **OpenAI GPT-4** | Contract analysis & generation |
| **Mistral AI** | Alternative LLM provider |
| **RAG (Retrieval-Augmented Generation)** | Knowledge retrieval |
| **PDF.js** | Document parsing |
| **Tesseract.js** | OCR capabilities |
| **LangSmith** | LLM observability |

---

## Project Structure

### `/apps/web/app` - Application Routes

```
app/
├── (dashboard)/            # Dashboard layout group
├── admin/                  # Admin panel
├── ai/                     # AI features
│   ├── chat/               # AI Chat interface
│   └── insights/           # AI-generated insights
├── analytics/              # Analytics dashboard
├── approvals/              # Approval workflows
├── audit-logs/             # Audit trail
├── auth/                   # Authentication pages
├── automation/             # Workflow automation
├── clauses/                # Clause library
├── compare/                # Contract comparison
├── compliance/             # Compliance management
├── contracts/              # Contract management
│   └── [id]/               # Individual contract view
├── dashboard/              # Main dashboard
├── drafting/               # Contract drafting
├── forecast/               # Financial forecasting
├── generate/               # AI contract generation
├── governance/             # Governance features
├── import/                 # Data import
├── integrations/           # Third-party integrations
├── intelligence/           # Business intelligence
├── knowledge-graph/        # Knowledge visualization
├── monitoring/             # System monitoring
├── notifications/          # Notification center
├── obligations/            # Obligation tracking
├── portal/                 # Client portal
├── rate-cards/             # Rate card management
├── renewals/               # Renewal tracking
├── reports/                # Report generation
├── risk/                   # Risk analysis
├── search/                 # Global search
├── settings/               # User settings
├── suppliers/              # Supplier management
├── team/                   # Team management
├── templates/              # Contract templates
├── upload/                 # File upload
└── workflows/              # Workflow builder
```

### `/apps/web/components` - Component Library

```
components/
├── ui/                     # Base UI components (Button, Card, etc.)
├── layout/                 # Layout components
├── contracts/              # Contract-specific components
├── rate-cards/             # Rate card components
├── chatbot/                # AI chatbot components
├── dashboard/              # Dashboard widgets
├── agents/                 # AI agent interfaces
├── analytics/              # Analytics components
├── approvals/              # Approval UI
├── charts/                 # Chart components
├── forms/                  # Form components
├── welcome/                # Onboarding components
└── ...                     # 150+ component directories
```

---

## Core Features

### 1. Contract Management

| Feature | Description |
|---------|-------------|
| **Upload & Parse** | Support for PDF, DOCX, TXT with automatic text extraction |
| **AI Analysis** | Automatic extraction of parties, dates, values, obligations |
| **Version Control** | Track changes and maintain contract history |
| **Metadata Management** | Custom fields and tagging system |
| **Full-Text Search** | Semantic search across all contracts |

### 2. AI-Powered Features

| Feature | Description |
|---------|-------------|
| **Contract Q&A** | Natural language queries about contract content |
| **Risk Detection** | Automatic identification of legal/financial risks |
| **Clause Extraction** | Identify and categorize contract clauses |
| **Summarization** | AI-generated executive summaries |
| **Contract Generation** | Draft new contracts with AI assistance |
| **Negotiation Assistant** | AI-powered negotiation recommendations |

### 3. Rate Card Intelligence

| Feature | Description |
|---------|-------------|
| **Market Benchmarking** | Compare rates against market data |
| **Supplier Scorecard** | Track supplier performance metrics |
| **Anomaly Detection** | Identify pricing irregularities |
| **Competitive Intelligence** | Market positioning analysis |
| **Rate Optimization** | AI recommendations for rate negotiations |

### 4. Obligation & Compliance

| Feature | Description |
|---------|-------------|
| **Obligation Tracking** | Extract and monitor contractual obligations |
| **Deadline Alerts** | Proactive notifications for upcoming dates |
| **Compliance Scoring** | Automated compliance assessment |
| **Audit Trail** | Complete history of all actions |
| **Renewal Management** | Track and manage contract renewals |

### 5. Collaboration & Workflow

| Feature | Description |
|---------|-------------|
| **Approval Workflows** | Multi-stage approval processes |
| **Comments & Annotations** | Collaborative review features |
| **Team Management** | Role-based access control |
| **Notifications** | Real-time alerts and updates |
| **Client Portal** | External stakeholder access |

---

## Application Pages

### Dashboard & Overview

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Main dashboard with KPIs and quick actions |
| Analytics | `/analytics` | Advanced analytics and charts |
| Reports | `/reports` | Generate and export reports |

### Contract Management

| Page | Route | Description |
|------|-------|-------------|
| Contracts List | `/contracts` | Browse and filter all contracts |
| Contract Detail | `/contracts/[id]` | Individual contract view with AI insights |
| Upload | `/upload` | Upload new contracts |
| Compare | `/compare` | Side-by-side contract comparison |
| Search | `/search` | Global semantic search |

### AI Features

| Page | Route | Description |
|------|-------|-------------|
| AI Chat | `/ai/chat` | Conversational AI interface |
| AI Insights | `/ai-insights` | AI-generated analytics |
| Generate | `/generate` | AI contract generation |
| Drafting | `/drafting` | AI-assisted contract drafting |

### Rate Cards

| Page | Route | Description |
|------|-------|-------------|
| Rate Cards Dashboard | `/rate-cards` | Rate card overview |
| Market Intelligence | `/rate-cards/market-intelligence` | Market analysis |
| Benchmarking | `/rate-cards/benchmarking` | Rate benchmarking |
| Suppliers | `/rate-cards/suppliers` | Supplier scorecard |
| Anomalies | `/rate-cards/anomalies` | Anomaly detection |
| Baselines | `/rate-cards/baselines` | Baseline management |

### Compliance & Risk

| Page | Route | Description |
|------|-------|-------------|
| Obligations | `/obligations` | Obligation tracking |
| Renewals | `/renewals` | Renewal management |
| Compliance | `/compliance` | Compliance dashboard |
| Risk | `/risk` | Risk analysis |
| Deadlines | `/deadlines` | Deadline calendar |

### Administration

| Page | Route | Description |
|------|-------|-------------|
| Settings | `/settings` | User preferences |
| Team | `/team` | Team management |
| Integrations | `/integrations` | Third-party connections |
| Audit Logs | `/audit-logs` | Activity history |
| Admin | `/admin` | System administration |

---

## API Reference

### REST API Endpoints

#### Contracts API

```
GET    /api/contracts              # List contracts
POST   /api/contracts              # Create contract
GET    /api/contracts/[id]         # Get contract
PUT    /api/contracts/[id]         # Update contract
DELETE /api/contracts/[id]         # Delete contract
POST   /api/contracts/[id]/analyze # Trigger AI analysis
```

#### Rate Cards API

```
GET    /api/rate-cards                    # List rate cards
POST   /api/rate-cards                    # Create rate card
GET    /api/rate-cards/[id]               # Get rate card
GET    /api/rate-cards/benchmarking       # Market benchmarking
GET    /api/rate-cards/suppliers/[id]     # Supplier scorecard
POST   /api/rate-cards/baselines          # Create baseline
```

#### AI API

```
POST   /api/ai/chat                 # AI chat completion
POST   /api/ai/analyze              # Document analysis
POST   /api/ai/summarize            # Generate summary
POST   /api/copilot/stream          # Streaming AI response
GET    /api/rag/search              # RAG search
```

#### Dashboard API

```
GET    /api/dashboard/stats         # Dashboard statistics
GET    /api/analytics               # Analytics data
GET    /api/forecast                # Financial forecast
```

#### Authentication API

```
POST   /api/auth/signin             # Sign in
POST   /api/auth/signout            # Sign out
GET    /api/auth/session            # Get session
POST   /api/auth/register           # Register user
```

### WebSocket Events

```typescript
// Client → Server
'join_room'              // Join a contract room
'leave_room'             // Leave a room
'request_status'         // Request processing status

// Server → Client
'contract:created'       // New contract created
'contract:completed'     // Processing completed
'job:progress'           // Job progress update
'notification'           // User notification
```

---

## Component Library

### Base UI Components (`/components/ui`)

| Component | Description |
|-----------|-------------|
| `Button` | Multi-variant button with loading states |
| `Card` | Content container with header/footer |
| `Dialog` | Modal dialog component |
| `Input` | Text input with validation |
| `Select` | Dropdown selection |
| `Tabs` | Tabbed navigation |
| `Table` | Data table with sorting/filtering |
| `Badge` | Status indicators |
| `Progress` | Progress indicators |
| `Toast` | Notification toasts |
| `Tooltip` | Contextual tooltips |
| `Skeleton` | Loading placeholders |

### Feature Components

| Component | Path | Description |
|-----------|------|-------------|
| `FloatingAIBubble` | `/ai` | Floating AI assistant |
| `ContractViewer` | `/contracts` | Contract document viewer |
| `RateComparisonView` | `/rate-cards` | Rate comparison table |
| `SupplierScorecard` | `/rate-cards` | Supplier metrics |
| `ApprovalWorkflow` | `/approvals` | Workflow visualization |
| `WelcomeModal` | `/welcome` | Onboarding modal |
| `GlobalCommandPalette` | `/global-command-palette` | Command palette (⌘K) |

### Design System

```typescript
// Color Tokens (Dark Mode Support)
bg-white dark:bg-slate-900
text-gray-900 dark:text-slate-100
border-gray-200 dark:border-slate-700

// Gradients
from-blue-500 to-indigo-600
from-violet-500 to-purple-600
from-emerald-500 to-teal-500

// Shadows
shadow-lg shadow-blue-500/25
shadow-xl shadow-purple-500/20

// Animations
animate-pulse
animate-spin
motion-safe:transition-all
```

---

## Database Schema

### Core Models (Prisma)

```prisma
model Contract {
  id              String    @id @default(cuid())
  filename        String
  status          String    @default("pending")
  uploadDate      DateTime  @default(now())
  fileSize        Int
  mimeType        String
  extractedData   Json?
  summary         Json?
  riskScore       Float?
  complianceScore Float?
  artifacts       Artifact[]
  obligations     Obligation[]
  parties         Party[]
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model RateCard {
  id              String    @id @default(cuid())
  supplierId      String
  role            String
  seniority       String
  dailyRateUSD    Float
  currency        String    @default("USD")
  country         String
  region          String
  effectiveDate   DateTime
  source          String
  confidence      Float
  createdAt       DateTime  @default(now())
}

model Obligation {
  id              String    @id @default(cuid())
  contractId      String
  contract        Contract  @relation(fields: [contractId], references: [id])
  title           String
  description     String
  dueDate         DateTime?
  status          String    @default("pending")
  priority        String    @default("medium")
  createdAt       DateTime  @default(now())
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  role            String    @default("user")
  contracts       Contract[]
  teamId          String?
  team            Team?     @relation(fields: [teamId], references: [id])
  createdAt       DateTime  @default(now())
}
```

---

## Authentication & Security

### Authentication (NextAuth.js v5)

- **Providers:** Email/Password, Google, Microsoft, SAML SSO
- **Session:** JWT-based sessions with secure cookies
- **RBAC:** Role-based access control (Admin, Manager, User, Viewer)

### Security Features

| Feature | Implementation |
|---------|----------------|
| **Rate Limiting** | `rate-limiter-flexible` with Redis |
| **Input Validation** | Zod schemas for all inputs |
| **XSS Prevention** | Next.js built-in sanitization |
| **CSRF Protection** | NextAuth.js tokens |
| **Encryption** | bcrypt for passwords, AES for sensitive data |
| **Audit Logging** | Complete action history |

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...

# AI Services
OPENAI_API_KEY=...
MISTRAL_API_KEY=...

# Storage
MINIO_ENDPOINT=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...

# Redis
REDIS_URL=redis://...

# Monitoring
SENTRY_DSN=...
```

---

## Real-Time Features

### WebSocket Server

```typescript
// Server configuration
const io = new Server(httpServer, {
  cors: { origin: process.env.NEXT_PUBLIC_APP_URL },
  transports: ['websocket', 'polling']
});

// Room-based subscriptions
socket.join(`contract:${contractId}`);
socket.join(`user:${userId}`);

// Broadcasting updates
io.to(`contract:${contractId}`).emit('contract:updated', data);
```

### Real-Time Events

| Event | Trigger | Description |
|-------|---------|-------------|
| `contract:created` | Upload complete | New contract notification |
| `contract:completed` | AI analysis done | Processing complete |
| `job:progress` | Worker update | Progress percentage |
| `notification` | System event | User notification |

---

## AI/ML Capabilities

### Document Processing Pipeline

```
Upload → OCR → Text Extraction → Chunking → Embedding → Vector Store
                    ↓
            AI Analysis → Entity Extraction → Risk Assessment
                    ↓
            Summary Generation → Obligation Extraction → Indexing
```

### AI Models Used

| Model | Purpose |
|-------|---------|
| **GPT-4o** | Contract analysis, Q&A, generation |
| **GPT-4o-mini** | Fast queries, classification |
| **text-embedding-3-small** | Document embeddings |
| **Mistral Large** | Alternative analysis |

### RAG (Retrieval-Augmented Generation)

- **Vector Store:** PostgreSQL with pgvector
- **Embedding Model:** OpenAI text-embedding-3-small
- **Chunk Size:** 1000 tokens with 200 token overlap
- **Retrieval:** Semantic search with re-ranking

---

## Deployment

### Docker Compose Services

```yaml
services:
  web:
    build: ./apps/web
    ports: ["3005:3005"]
    
  workers:
    build: ./packages/workers
    depends_on: [redis, postgres]
    
  postgres:
    image: postgres:15
    volumes: [postgres_data:/var/lib/postgresql/data]
    
  redis:
    image: redis:7-alpine
    
  minio:
    image: minio/minio
    volumes: [minio_data:/data]
```

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis cluster deployed
- [ ] MinIO buckets created
- [ ] SSL/TLS certificates
- [ ] Health checks enabled
- [ ] Monitoring configured
- [ ] Backup strategy in place

---

## Development Guide

### Getting Started

```bash
# Clone repository
git clone https://github.com/your-org/contigo-platform.git

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start services
docker-compose up -d postgres redis minio

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build production bundle |
| `pnpm test` | Run E2E tests |
| `pnpm test:unit` | Run unit tests |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm typecheck` | TypeScript validation |

### Code Style

- **ESLint:** Next.js recommended config
- **Prettier:** Automatic formatting
- **TypeScript:** Strict mode enabled
- **Commits:** Conventional commits

### Testing

| Type | Tool | Command |
|------|------|---------|
| E2E | Playwright | `pnpm test:e2e` |
| Unit | Vitest | `pnpm test:unit` |
| Component | Testing Library | `pnpm test:unit` |

---

## Support & Resources

- **Documentation:** `/docs` folder
- **API Docs:** `/api/docs`
- **Issue Tracker:** GitHub Issues
- **Team Chat:** Slack #contigo-dev

---

<div align="center">

**ConTigo Platform** - Enterprise Contract Intelligence

Built with ❤️ using Next.js, React, and AI

</div>
