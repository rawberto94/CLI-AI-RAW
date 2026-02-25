# ConTigo — Platform Capabilities

**What ConTigo can do for your organisation**
**Version 1.0 — February 2026**

---

## At a Glance

ConTigo is an **AI-powered Contract Lifecycle Management (CLM)** platform that helps legal, procurement, and finance teams manage contracts from creation to renewal — all in one place.

| | |
|---|---|
| **Category** | Contract Lifecycle Management (CLM) |
| **Deployment** | Cloud-hosted (SaaS) or self-hosted via Docker / Kubernetes |
| **Access** | Web browser — desktop and mobile responsive |
| **Multi-tenant** | Yes — full data isolation per organisation |
| **AI models** | Azure OpenAI (GPT-4o), Mistral AI, Anthropic Claude |

---

## 1. Contract Management

### Upload & Ingestion

- Upload contracts in **PDF, DOCX, DOC, TXT, HTML, XLSX, XLS, CSV** formats
- **Image-based documents** supported via OCR (JPEG, PNG, GIF, BMP, TIFF, WebP) — **15+ formats** total
- Chunked upload for large files (up to 500 MB on Enterprise tier)
- Bulk upload with automatic queuing and processing status

### AI-Powered Extraction

- **Automatic metadata extraction**: parties, effective dates, expiration dates, contract value, governing law
- **Clause identification**: 50+ clause types recognised (liability caps, termination, indemnification, confidentiality, force majeure, etc.)
- **Obligation detection**: deadlines, deliverables, and renewal terms extracted and tracked
- **Party recognition**: counterparties, signatories, and roles identified automatically
- Processing typically completes in **30–120 seconds** per document

### Organisation & Lifecycle

- **Contract statuses**: Draft, Active, Expired, Terminated, Renewed, Pending Review, Archived
- **Version tracking**: full version history for every contract
- **Comments & collaboration**: threaded comments on contracts for team discussion
- **Contract sharing**: share contracts with internal teams or external parties
- **Custom metadata fields**: tag contracts with your own categories and attributes
- **Bulk actions**: export, archive, or update multiple contracts at once

---

## 2. AI Chatbot & Intelligent Assistant

### Natural Language Q&A

- Ask questions about your contracts in plain language (e.g. *"What is the liability cap in our Acme MSA?"*)
- **RAG (Retrieval-Augmented Generation)**: answers are grounded in your actual contract data, not general knowledge
- **Streaming responses**: answers appear in real time as they are generated
- Conversation history preserved across sessions

### AI Agent Capabilities (18+ tools)

The chatbot can perform actions on your behalf:

| Tool | What it does |
|---|---|
| **Contract Search** | Find contracts by status, party, date, or any criteria |
| **Clause Lookup** | Locate specific clauses across your repository |
| **Obligation Summary** | Lists upcoming deadlines and obligations |
| **Risk Analysis** | Identify risk factors in a specific contract |
| **Rate Card Comparison** | Compare rates across suppliers |
| **Analytics Query** | Pull dashboard metrics on demand |
| **Workflow Status** | Check approval and review pipeline status |
| **Document Summary** | Summarise any uploaded contract |
| **Governance Check** | Verify compliance status and policy adherence |
| **Administration Help** | Guide users through settings and configuration |
| **Navigate to Page** | Deep-link to any section of the platform |

### Page-Aware Context

The chatbot adapts to the page you are on. If you are viewing a specific contract, analytics dashboard, or governance page, the assistant automatically includes that context in its answers.

---

## 3. Search & Discovery

### Semantic Search

- Search your entire contract repository using **natural language**, not just keywords
- Powered by vector embeddings (1536-dimensional) with cosine similarity
- Results ranked by relevance, filtered by your tenant data only

### Structured Filters

- Filter by status, contract type, party, date range, value, department
- Full-text search across contract titles and extracted text
- Paginated, sortable results

---

## 4. Rate Card Management & Benchmarking

### Rate Card Ingestion

- Upload rate cards in Excel or CSV format
- Automatic parsing and normalisation of role/rate pairs
- Detect outlier rates and pricing anomalies

### Benchmarking

- Compare supplier rates against your baseline data
- Market rate intelligence and trend analysis
- Historical rate tracking and forecasting

### Supplier Scoring

- Score suppliers based on rate competitiveness, compliance, and performance
- Aggregated supplier performance dashboards

---

## 5. Risk & Compliance

### AI Risk Analysis

- Every contract scored for risk: **missing standard clauses, unusual provisions, compliance gaps**
- Risk factors flagged with severity (high, medium, low)
- Compare clauses against configurable best-practice templates

### Governance & Policy

- **AI Guardrails**: configurable thresholds for AI model usage, token limits, and cost controls
- **Data Loss Prevention (DLP)**: policies to prevent sensitive data exposure
- **Audit logging**: every action (create, update, delete, export, share) recorded with timestamp, user, and details
- **Legal holds**: place contracts under legal hold to prevent modification or deletion
- Audit log retention: **7 years** (immutable, append-only)

### Compliance Support

- **GDPR**: data export and data deletion capabilities for data subjects
- **Tenant-level security settings**: MFA enforcement, IP allowlisting, session policies

---

## 6. Obligation & Deadline Tracking

- **Automatic extraction** of obligations, renewal dates, and key milestones from contracts
- **Notifications & alerts**: configurable renewal reminders and deadline alerts
- **Calendar integration**: upcoming dates visible in dashboard widgets
- **Status tracking**: pending, in-progress, completed, overdue, waived

---

## 7. Workflows & Approvals

- **Customisable workflows**: define multi-step approval processes for contract review, execution, and renewal
- **Workflow execution**: trigger workflows manually or automatically based on contract events
- **Approval actions**: approve, reject, or request changes at each step
- **Audit trail**: full history of every workflow step and decision

---

## 8. Analytics & Reporting

### Dashboards

- **Contract analytics**: status distribution, value breakdown, processing trends
- **Rate card analytics**: spend analysis, rate trends, supplier comparisons
- **AI usage analytics**: token consumption, model usage, cost tracking
- **Custom metrics**: build your own dashboard widgets

### Export & Reporting

- **CSV export** from any analytics view
- **Scheduled reports**: automated generation and delivery
- **Forecasting**: predictive analytics for contract renewals and spending

---

## 9. Ecosystem & Integrations

### Built-In Integrations

| Integration | Description |
|---|---|
| **Google Drive** | Import/export contracts from Google Drive (OAuth 2.0) |
| **Microsoft Word Add-in** | Work with ConTigo contracts directly inside Microsoft Word |
| **E-signatures** | Send contracts for electronic signature |
| **SCIM v2 Provisioning** | Automatically sync users and groups from your identity provider |
| **Supplier Portal** | External portal for suppliers to view and respond to contracts (magic-link access) |

### API & Webhooks

- **REST API**: 83+ API endpoints covering all platform operations
- **Webhooks (outbound)**: receive HTTP notifications for contract events (created, signed, obligation due, etc.) — with HMAC signature verification
- **Webhooks (inbound)**: trigger actions from external systems
- **API authentication**: Bearer token for service-to-service integration

### Ecosystem Dashboard

- Unified view of all connected integrations and their health
- Data flow monitoring between ConTigo and external systems

---

## 10. Authentication & Security

### Authentication

| Method | Description |
|---|---|
| **Email & password** | Standard credentials with bcrypt hashing |
| **Google SSO** | Sign in with Google (OAuth 2.0) |
| **Microsoft SSO** | Sign in with Microsoft Entra ID (OAuth 2.0) |
| **GitHub SSO** | Sign in with GitHub (OAuth 2.0) |
| **SAML 2.0** | Enterprise SSO via SAML 2.0 identity providers |
| **MFA (TOTP)** | Time-based one-time passwords (Google Authenticator compatible) |

### Security Features

| Feature | Detail |
|---|---|
| **Encryption at rest** | AES-256 for stored files and data |
| **Encryption in transit** | TLS 1.3 enforced |
| **CSRF protection** | Double-submit cookie pattern |
| **Rate limiting** | Redis-backed sliding window, configurable per endpoint |
| **IP allowlisting** | Restrict access by IP address (per tenant) |
| **Role-based access control** | Granular permissions: resource + action (e.g. `contracts:export`) |
| **Tenant isolation** | Every data record scoped to a single tenant; cross-tenant access is impossible |
| **Audit logs** | Immutable, append-only, 7-year retention |
| **Content Security Policy** | CSP headers to prevent XSS |

---

## 11. Self-Service & Support

### Self-Service Hub

- Submit requests for new features, report issues, or ask questions
- Track the status of your submitted requests
- Guided form wizard for common request types

### Help Centre

- In-app documentation and FAQs
- Contextual help based on the page you are viewing
- AI chatbot available on every page for instant support

---

## 12. Administration

### User Management

- Invite users by email, manage roles and permissions
- View login activity and last-login timestamps
- Deactivate or remove users

### Organisation Settings

- Organisation name, branding, and subscription management
- Security settings: MFA enforcement, session policies, IP allowlisting
- AI usage thresholds and cost alerts

### Subscription & Billing

- **Standard** and **Pro** tiers (details discussed per client)
- Usage-based visibility into AI token consumption and storage

---

## 13. Deployment Options

| Option | Description |
|---|---|
| **Cloud (SaaS)** | Fully managed, hosted by ConTigo |
| **Self-hosted (Docker)** | Run on your own infrastructure using Docker Compose |
| **Kubernetes** | Helm charts provided for K8s deployment |
| **Azure Container Apps** | Optimised for Azure deployment |

### Infrastructure Requirements (Self-Hosted)

| Component | Technology | Minimum |
|---|---|---|
| **Runtime** | Node.js 22 | 2 vCPU, 4 GB RAM |
| **Database** | PostgreSQL 16 + pgvector | 2 vCPU, 4 GB RAM, 50 GB SSD |
| **Cache/Queues** | Redis 7 | 1 GB RAM |
| **File Storage** | MinIO / S3-compatible / Azure Blob | 50 GB+ |

---

## 14. Technology Overview

For technical audience — what powers ConTigo under the hood:

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI |
| **Backend** | Next.js API Routes, Prisma ORM, BullMQ workers |
| **Database** | PostgreSQL 16 + pgvector (vector search) |
| **Cache & Queues** | Redis 7, BullMQ |
| **AI** | Azure OpenAI (GPT-4o), Mistral AI, Anthropic Claude |
| **File Processing** | pdf-parse, Mammoth (DOCX), Sharp (images/OCR), xlsx |
| **Real-Time** | Socket.IO (WebSocket) for live processing updates |
| **Monitoring** | Sentry, OpenTelemetry, Prometheus, Pino logging |
| **Build** | Turborepo monorepo, pnpm workspaces, Docker multi-stage |

---

## Summary

ConTigo brings together **contract management, AI analysis, compliance monitoring, and supplier intelligence** in a single platform. It is built for teams that want to:

- **Reduce manual effort** — let AI extract, classify, and track contracts
- **Minimise risk** — catch missing clauses, unusual terms, and approaching deadlines automatically
- **Gain visibility** — dashboards, analytics, and forecasting across your entire contract portfolio
- **Stay secure** — enterprise-grade encryption, SSO, MFA, RBAC, and full audit logging
- **Integrate easily** — REST API, webhooks, Google Drive, Word Add-in, SCIM, e-signatures

---

*ConTigo — AI-Powered Contract Lifecycle Management*
*For questions or a personalised demo, contact us.*
