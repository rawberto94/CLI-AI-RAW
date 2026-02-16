# Changelog

All notable changes to the ConTigo platform are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [2.0.0] — 2026-02-08

### Platform Overhaul

This release represents a complete rewrite and production hardening of the ConTigo platform.

### Added

- **Multi-agent AI system** — Specialised agents for extraction, risk scoring, compliance analysis, and rate card benchmarking
- **RAG pipeline** with pgvector embeddings (1536-dim) for semantic contract search
- **Multi-model AI support** — Azure OpenAI (GPT-4o), Anthropic Claude, Mistral AI with automatic fallback
- **WebSocket real-time updates** via Socket.IO for contract processing status
- **BullMQ background workers** for async contract processing, AI extraction, and sync jobs
- **PM2 process management** — 5 processes: web cluster, workers×2, websocket, contract-sync
- **Rate card extraction and benchmarking** — unique capability for procurement teams
- **Obligation tracking** with automated renewal alerts (90/60/30 days)
- **Multi-tenant architecture** with row-level data isolation
- **TOTP MFA** support with QR code provisioning
- **CSRF protection** with double-submit cookie pattern
- **Redis-backed rate limiting** across all API endpoints
- **OpenTelemetry instrumentation** for distributed tracing
- **Sentry error tracking** with source maps
- **Prometheus metrics** endpoint for infrastructure monitoring
- **Docker multi-stage build** (3-stage: deps → build → runtime) on `node:22-alpine`
- **PgBouncer** connection pooling support (docker-compose.pgbouncer.yml)
- **Health check endpoints** with dependency status (DB, Redis, AI, storage)
- **CSP headers** with nonce-based script security
- **Error boundaries** with Sentry integration at page and layout level
- **Toast migration** from react-hot-toast to Sonner
- **Service API token** authentication for non-browser clients

### Changed

- **Database**: Migrated from MySQL to PostgreSQL 16 with pgvector extension
- **Vector store**: Migrated from ChromaDB to native pgvector (eliminates external dependency)
- **Framework**: Upgraded from Next.js 14 to Next.js 15.1 with App Router
- **React**: Upgraded to React 19
- **Node.js**: Upgraded to Node.js 22 (alpine)
- **Auth**: Migrated to NextAuth v5 (beta)
- **Currency**: All pricing and contract values migrated from USD/EUR to CHF
- **UI**: Enterprise design overhaul of contracts page with proper status badges, loading states, and empty states
- **Cache**: Migrated to custom Redis-backed cache adaptor
- **Workers**: Pre-compiled TypeScript workers for production deployment

### Documentation

- **34 documentation files** in `docs/` folder (~20,000 lines total)
- Technical Documentation, Architecture, User Onboarding, FAQ
- Business Plan, Revenue Model, Pricing Strategy, Founders' Agreement
- Terms & Conditions (bilingual DE/EN), Privacy Policy, DPA, AUP, SLA
- Roadmap & Scaling, Documentation Index

### Security

- AES-256-GCM encryption at rest
- TLS 1.3 encryption in transit
- IP allowlisting (Enterprise)
- Audit logging with configurable retention
- SECURITY.md responsible disclosure policy

### Fixed

- 40+ production audit issues across 30+ files (Phases 1–8)
- Docker image pinning for reproducible builds
- Prisma connection pooling with proper timeout configuration
- PM2 ecosystem config for cluster mode stability
- CI workflow for GitHub Actions
- E2E upload/storage/artifacts flow (18 issues)
- Contracts page UI/UX (20 issues)

---

## [1.0.0] — 2025-06-01

### Initial Release

- Contract upload and management
- Basic AI extraction (OpenAI GPT-4)
- RAG-based semantic search (ChromaDB)
- User authentication (NextAuth)
- MySQL database with Prisma ORM
- Docker development environment
- Basic dashboard and analytics

---

*ConTigo GmbH — Zurich, Switzerland*
