# ConTigo — AI-Powered Contract Lifecycle Management

**Swiss-first CLM platform for privacy-conscious enterprises.**
**100% Swiss data residency · Multi-agent AI · Rate card benchmarking**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.1-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

---

## What is ConTigo?

ConTigo automates the entire contract lifecycle — upload, AI-powered extraction, risk assessment, obligation tracking, and renewal management — while guaranteeing Swiss FADP and EU GDPR compliance through 100% Swiss/EU data residency.

**Key differentiators:**

- **Swiss-first architecture** — All data in Azure Switzerland North; no US cloud dependency
- **Multi-agent AI** — Specialised agents for extraction, risk, compliance, rate analysis
- **Rate card benchmarking** — Unique capability; no competitor offers this natively
- **Sub-second semantic search** — RAG-powered with pgvector embeddings
- **Enterprise CHF pricing** — Transparent, local-currency pricing for DACH market

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15.1, React 19, TypeScript 5.7 |
| **API** | Next.js App Router API routes + Fastify |
| **Database** | PostgreSQL 16 + pgvector (1536-dim embeddings) |
| **ORM** | Prisma 5.22 (130+ models, 46 enums) |
| **Cache & Queues** | Redis 7, BullMQ |
| **AI** | Azure OpenAI (GPT-4o), Anthropic Claude, Mistral AI |
| **Auth** | NextAuth v5, bcryptjs, TOTP MFA, CSRF |
| **Real-time** | Socket.IO (WebSocket) |
| **Storage** | MinIO (S3-compatible) |
| **UI** | Radix UI, Tailwind CSS 3.4, Framer Motion, Recharts |
| **State** | Zustand, React Query (TanStack) |
| **Observability** | Sentry, OpenTelemetry, Prometheus, Pino |
| **Testing** | Playwright (E2E), Vitest (unit), Testing Library |
| **Infra** | Docker (node:22-alpine), PM2, Azure Container Apps |
| **Monorepo** | pnpm 8.9 + Turborepo |

---

## Monorepo Structure

```
contigo/
├── apps/
│   └── web/                    # Next.js 15 application (60+ pages, 77+ API routes)
├── packages/
│   ├── agents/                 # Multi-agent AI orchestration
│   ├── clients/
│   │   ├── db/                 # Prisma client (5,300-line schema)
│   │   ├── openai/             # Azure OpenAI + Anthropic + Mistral clients
│   │   ├── queue/              # BullMQ job queue client
│   │   ├── rag/                # RAG pipeline (pgvector embeddings)
│   │   └── storage/            # MinIO S3-compatible storage client
│   ├── data-orchestration/     # Core business logic & service layer
│   ├── schemas/                # Zod validation schemas
│   ├── utils/                  # Shared utilities (formatting, crypto, etc.)
│   └── workers/                # Background job processors (PM2-managed)
├── scripts/                    # CLI tools (create-user, backfill, check-artifacts, etc.)
├── docs/                       # 34 documentation files (see docs/INDEX.md)
├── infra/                      # Nginx, Prometheus configs
├── k8s/                        # Kubernetes manifests
├── helm/                       # Helm charts
└── docker-compose.*.yml        # Dev, staging, production, RAG compose files
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 8.9 ([install](https://pnpm.io/installation))
- **Docker** & Docker Compose
- **PostgreSQL** 16 (via Docker or native)
- **Redis** 7 (via Docker or native)

### 1. Clone & install

```bash
git clone https://github.com/rawberto94/CLI-AI-RAW.git
cd CLI-AI-RAW
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values:
#   DATABASE_URL=postgresql://user:password@localhost:5432/contigo
#   OPENAI_API_KEY=sk-...
#   NEXTAUTH_SECRET=...
#   REDIS_URL=redis://localhost:6379
```

### 3. Start services

```bash
# Start PostgreSQL + Redis via Docker
docker compose -f docker-compose.dev.yml up -d

# Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate

# Seed data (optional)
pnpm db:seed
```

### 4. Run

```bash
# Development (with Turbopack)
pnpm dev

# Or start everything (web + workers + websocket)
pnpm dev:all
```

Visit **<http://localhost:3000>**

### Production Build

```bash
pnpm build
pnpm start

# Or use PM2 for process management
pm2 start ecosystem.config.cjs
```

---

## Docker

```bash
# Development
docker compose -f docker-compose.dev.yml up

# Production (full stack)
docker compose -f docker-compose.prod.yml up -d

# With PgBouncer connection pooling
docker compose -f docker-compose.pgbouncer.yml up -d
```

The production Dockerfile uses a 3-stage multi-stage build (deps → build → runtime) on `node:22-alpine` for minimal image size.

---

## Key Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server with Turbopack |
| `pnpm dev:all` | Start web + workers + websocket |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:e2e` | Run E2E tests (Playwright) |
| `pnpm lint` | ESLint check |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:push` | Push schema changes (dev only) |
| `pnpm verify` | Run production readiness checks |

---

## Programmatic API Access

For CLI/integration clients (non-browser):

```bash
# Set SERVICE_API_TOKEN in .env, then:
curl -X GET https://your-domain.com/api/contracts \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>" \
  -H "x-tenant-id: <tenantId>"
```

Supported endpoints: `POST /api/contracts/upload`, `GET /api/contracts/:id`, and all read-only sub-routes. See [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) for the full API reference.

---

## Documentation

All documentation lives in the [`docs/`](docs/) folder. See [docs/INDEX.md](docs/INDEX.md) for a complete table of contents.

### For Developers

- [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) — Stack, API, DB, deployment
- [Architecture](docs/ARCHITECTURE.md) — System design, ADRs, scalability
- [Roadmap & Scaling](docs/ROADMAP_SCALING.md) — Product roadmap, infra scaling

### For Users & Customers

- [User Onboarding](docs/USER_ONBOARDING.md) — Getting started guide
- [FAQ](docs/FAQ.md) — Frequently asked questions

### Business & Legal

- [Business Plan](docs/BUSINESS_PLAN.md) — Market, strategy, financials
- [Revenue Model](docs/REVENUE_MODEL.md) — P&L, unit economics, scenarios
- [Pricing Strategy](docs/PRICING_STRATEGY.md) — Plans, rate cards, discounts
- [Founders' Agreement](docs/FOUNDERS_AGREEMENT.md) — GmbH founders' pact

### Legal & Compliance (Swiss Law)

- [Terms & Conditions (AGB)](docs/TERMS_AND_CONDITIONS.md) — Bilingual DE/EN
- [Privacy Policy](docs/PRIVACY_POLICY.md) — nDSG + GDPR
- [Data Processing Agreement (AVV)](docs/DATA_PROCESSING_AGREEMENT.md) — Art. 9 nDSG / Art. 28 GDPR
- [Acceptable Use Policy](docs/ACCEPTABLE_USE_POLICY.md)
- [Service Level Agreement](docs/SERVICE_LEVEL_AGREEMENT.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on development workflow, code style, and pull request process.

---

## Security

See [SECURITY.md](SECURITY.md) for our responsible disclosure policy. To report a vulnerability, email **<security@contigo-app.ch>**.

---

## License

Proprietary software. Copyright © 2025–2026 ConTigo GmbH, Zurich, Switzerland. All rights reserved. See [LICENSE](LICENSE) for details.

---

*ConTigo GmbH — Zurich, Switzerland · [contigo-app.ch](https://contigo-app.ch)*
