# ConTigo — Product Roadmap & Scaling Strategy

**From MVP to Market Leader**
**Version 1.0 — February 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Phase 1: Foundation (Q1–Q2 2026)](#3-phase-1-foundation-q1q2-2026)
4. [Phase 2: Growth (Q3–Q4 2026)](#4-phase-2-growth-q3q4-2026)
5. [Phase 3: Scale (Q1–Q2 2027)](#5-phase-3-scale-q1q2-2027)
6. [Phase 4: Expansion (Q3 2027+)](#6-phase-4-expansion-q3-2027)
7. [Infrastructure Scaling Plan](#7-infrastructure-scaling-plan)
8. [Database Scaling Strategy](#8-database-scaling-strategy)
9. [AI Scaling Strategy](#9-ai-scaling-strategy)
10. [CDN & Performance Scaling](#10-cdn--performance-scaling)
11. [Team Scaling](#11-team-scaling)
12. [Cost Projections](#12-cost-projections)
13. [Risk Matrix](#13-risk-matrix)
14. [Success Metrics](#14-success-metrics)

---

## 1. Executive Summary

ConTigo is transitioning from a working MVP to a production-grade SaaS platform targeting the Swiss/DACH enterprise contract management market. This document defines the product roadmap and technical scaling strategy across four phases over 18+ months.

### Strategic Milestones

| Milestone | Target Date | Key Metric |
|---|---|---|
| **Public Launch** | Q1 2026 | First 10 paying customers |
| **Product-Market Fit** | Q3 2026 | 50 customers, <5% monthly churn |
| **Series A Ready** | Q1 2027 | CHF 500K ARR, unit economics proven |
| **Market Expansion** | Q3 2027 | DACH-wide, 200+ customers |

---

## 2. Current State Assessment

### What's Built (MVP)

| Area | Status | Maturity |
|---|---|---|
| **Contract upload & AI extraction** | ✅ Complete | Production-ready |
| **Rate card management** | ✅ Complete | Production-ready |
| **AI chatbot (RAG)** | ✅ Complete | Production-ready |
| **Multi-tenant architecture** | ✅ Complete | Production-ready |
| **RBAC & MFA authentication** | ✅ Complete | Production-ready |
| **Obligation tracking** | ✅ Complete | Beta |
| **Workflow engine** | ✅ Complete | Beta |
| **Analytics dashboards** | ✅ Complete | Beta |
| **Background processing** | ✅ Complete | Production-ready |
| **Real-time (WebSocket)** | ✅ Complete | Beta |
| **Docker + PM2 deployment** | ✅ Complete | Production-ready |

### What's Needed

| Area | Priority | Effort |
|---|---|---|
| **E-signature integration** | High | 2–4 weeks |
| **Onboarding wizard** | High | 1–2 weeks |
| **Email notifications** | High | 1–2 weeks |
| **Advanced reporting** | Medium | 4–6 weeks |
| **API for enterprise** | Medium | 2–4 weeks |
| **Self-service billing** | Medium | 2–4 weeks |
| **Mobile optimisation** | Low | 2–3 weeks |
| **Audit log UI** | Low | 1 week |

---

## 3. Phase 1: Foundation (Q1–Q2 2026)

**Goal:** Launch publicly, acquire first 10 paying customers, establish product-market fit signals.

### Product Features

#### Q1 2026

| Feature | Priority | Status | Description |
|---|---|---|---|
| **Onboarding wizard** | P0 | 🔲 | 5-step guided setup for new tenants |
| **Email notifications** | P0 | 🔲 | Transactional emails (deadlines, approvals, welcome) |
| **Contract templates** | P0 | 🔲 | 10+ Swiss contract templates (NDA, MSA, SOW, SLA) |
| **E-signature (DocuSign)** | P1 | 🔲 | Request & track signatures from within ConTigo |
| **Export (PDF/Excel)** | P1 | 🔲 | Export contracts, reports, rate cards |
| **Bulk upload** | P1 | 🔲 | Import existing contract library (ZIP/folder) |
| **Stripe billing** | P1 | 🔲 | Self-service subscription management |

#### Q2 2026

| Feature | Priority | Status | Description |
|---|---|---|---|
| **Advanced search** | P0 | 🔲 | Semantic + filters + saved searches |
| **Calendar integration** | P1 | 🔲 | Outlook + Google Calendar sync |
| **Approval workflows v2** | P1 | 🔲 | Conditional logic, parallel approvals |
| **Audit log UI** | P1 | 🔲 | Browse all actions per contract/user |
| **Custom fields** | P2 | 🔲 | Tenant-defined metadata fields |
| **Dashboard widgets v2** | P2 | 🔲 | Customisable, drag-and-drop |
| **Mobile responsive v2** | P2 | 🔲 | Touch-optimised approval flows |

### Technical Infrastructure (Phase 1)

| Area | Action | Purpose |
|---|---|---|
| **CI/CD** | GitHub Actions pipeline: lint → type → test → build → deploy | Automated deployment |
| **Staging environment** | Azure Container Apps (staging slot) | Pre-production testing |
| **Monitoring** | Sentry + Prometheus + Grafana dashboards | Error tracking, metrics |
| **Backups** | Automated daily PG backup + Azure Blob replication | Disaster recovery |
| **CDN** | Azure Front Door for static assets | Performance |
| **Load testing** | k6 scripts for critical paths | Capacity validation |

---

## 4. Phase 2: Growth (Q3–Q4 2026)

**Goal:** 50 customers, <5% monthly churn, validated unit economics, Series A preparation.

### Product Features

#### Q3 2026

| Feature | Priority | Status | Description |
|---|---|---|---|
| **AI contract generation** | P0 | 🔲 | Generate contracts from templates + AI |
| **Clause library** | P0 | 🔲 | Reusable clause collection with versioning |
| **SharePoint integration** | P1 | 🔲 | Bi-directional document sync |
| **SAP integration** | P1 | 🔲 | Contract → SAP purchase order sync |
| **Collaboration v2** | P1 | 🔲 | Inline redlining, track changes |
| **Risk scoring dashboard** | P2 | 🔲 | Portfolio-wide risk assessment |

#### Q4 2026

| Feature | Priority | Status | Description |
|---|---|---|---|
| **API v1 (public)** | P0 | 🔲 | REST API with OpenAPI spec, API keys |
| **Webhooks** | P0 | 🔲 | Configurable event webhooks |
| **Advanced analytics** | P1 | 🔲 | Predictive models, trend analysis |
| **SFTP import** | P1 | 🔲 | Automated contract import from SFTP |
| **SSO (SAML/OIDC)** | P1 | 🔲 | Enterprise identity federation |
| **White-label** | P2 | 🔲 | Custom branding for enterprise |
| **Batch processing** | P2 | 🔲 | Queue 1000+ contracts for processing |

### Technical Infrastructure (Phase 2)

| Area | Action | Purpose |
|---|---|---|
| **Read replicas** | PostgreSQL read replicas for analytics | Query performance |
| **PgBouncer** | Connection pooling (already in docker-compose) | Connection efficiency |
| **Redis Cluster** | Multi-instance Redis | HA + throughput |
| **Queue scaling** | Dedicated worker pools per queue type | Processing throughput |
| **OpenAPI spec** | Auto-generated from Zod schemas | API documentation |
| **SOC 2 prep** | Security audits, policy documentation | Enterprise readiness |

---

## 5. Phase 3: Scale (Q1–Q2 2027)

**Goal:** CHF 500K ARR, 100+ customers, Series A closed, DACH expansion started.

### Product Features

| Feature | Priority | Description |
|---|---|---|
| **AI model fine-tuning** | P0 | Custom models trained on customer data |
| **Contract benchmarking marketplace** | P1 | Anonymous benchmarking across tenants |
| **Obligation automation** | P1 | Auto-actions on deadline triggers |
| **Multi-language OCR v2** | P1 | Improved German/French/Italian extraction |
| **Native mobile app** | P2 | iOS + Android (React Native) |
| **Real-time collaboration** | P2 | Google Docs-like co-editing |
| **Compliance module** | P2 | Regulatory compliance tracking |

### Technical Infrastructure (Phase 3)

| Area | Action | Purpose |
|---|---|---|
| **AKS migration** | Kubernetes (Azure AKS) | Autoscaling, service mesh |
| **Event sourcing** | Contract state machine as events | Complete audit + replay |
| **Data warehouse** | Azure Synapse for analytics | Separate OLAP |
| **Multi-region prep** | EU-West deployment (Frankfurt) | DACH expansion |
| **ISO 27001** | Certification process started | Enterprise compliance |

---

## 6. Phase 4: Expansion (Q3 2027+)

**Goal:** DACH market leader, 200+ customers, international expansion evaluation.

### Product Features

| Feature | Priority | Description |
|---|---|---|
| **AI contract negotiation** | P1 | AI-assisted clause negotiation suggestions |
| **Contract intelligence platform** | P1 | Cross-portfolio insights, industry benchmarks |
| **Marketplace** | P2 | Third-party integrations, templates, agents |
| **On-premise edition** | P2 | Self-hosted option for regulated verticals |
| **Natural language workflow builder** | P2 | "When contract value > 100K, require CFO approval" |
| **Predictive analytics** | P2 | Contract renewal probability, risk forecasting |

### Technical Infrastructure (Phase 4)

| Area | Action | Purpose |
|---|---|---|
| **Multi-region** | Active-active deployment | Global availability |
| **CQRS** | Read/write model separation | Analytics at scale |
| **Custom ML pipeline** | Azure ML for model training | Domain-specific AI |
| **GraphQL** | Alongside REST for complex queries | Developer experience |
| **Edge deployment** | CDN-based preview generation | Document performance |

---

## 7. Infrastructure Scaling Plan

### Scaling Tiers

#### Tier 1: Launch (0–50 Users)

```
┌─────────────────────────────┐
│  Azure Container Apps       │
│                             │
│  Web ×2 (1 vCPU, 2 GB)     │
│  Workers ×2 (1 vCPU, 2 GB) │
│  WebSocket ×1               │
│                             │
│  PG Flexible (2 vCPU, 8 GB)│
│  Redis (C1, 1 GB)          │
│  Blob Storage (LRS)        │
└─────────────────────────────┘
Est. cost: CHF 800–1,200/month
```

#### Tier 2: Growth (50–500 Users)

```
┌───────────────────────────────────┐
│  Azure Container Apps             │
│                                   │
│  Web ×4 (2 vCPU, 4 GB)           │
│  Workers ×4 (2 vCPU, 4 GB)       │
│  WebSocket ×2 + Redis adapter     │
│                                   │
│  PG Flexible (4 vCPU, 16 GB)     │
│  + 1 Read Replica                 │
│  + PgBouncer                      │
│  Redis (C2, 2.5 GB)              │
│  Blob Storage (ZRS)              │
│  Azure Front Door (CDN)          │
└───────────────────────────────────┘
Est. cost: CHF 2,500–4,000/month
```

#### Tier 3: Scale (500–5,000 Users)

```
┌───────────────────────────────────┐
│  Azure Kubernetes Service (AKS)   │
│                                   │
│  Web ×8 (auto-scale 4–16)        │
│  Workers ×8 (auto-scale 4–16)    │
│  WebSocket ×4 + Redis adapter     │
│                                   │
│  PG Flexible (8 vCPU, 32 GB)     │
│  + 2 Read Replicas               │
│  + PgBouncer Pool (64 conn)      │
│  Redis Premium (P1, 6 GB)        │
│  Blob Storage (GRS)              │
│  Azure Front Door (Premium)       │
│  Azure Monitor (full)             │
└───────────────────────────────────┘
Est. cost: CHF 8,000–15,000/month
```

#### Tier 4: Enterprise (5,000+ Users)

```
┌───────────────────────────────────┐
│  Multi-Region AKS                 │
│                                   │
│  Switzerland North (Primary)      │
│  West Europe (Secondary)          │
│                                   │
│  Web ×16 (auto-scale 8–32)       │
│  Workers ×16 (auto-scale 8–32)   │
│  WebSocket ×8                     │
│                                   │
│  PG Flexible (16 vCPU, 64 GB)    │
│  + 3 Read Replicas               │
│  + Cross-region replication       │
│  Redis Enterprise                 │
│  Azure Synapse (analytics)        │
│  Azure Front Door (Global)        │
│  Full observability stack          │
└───────────────────────────────────┘
Est. cost: CHF 25,000–50,000/month
```

---

## 8. Database Scaling Strategy

### Connection Management

| Stage | Strategy | Max Connections |
|---|---|---|
| **Launch** | Direct connections via Prisma | 20 |
| **Growth** | PgBouncer (transaction mode) | 100 pool → 20 DB |
| **Scale** | PgBouncer + read replicas | 200 pool → 40 DB + 3 replicas |
| **Enterprise** | Citus sharding (by tenantId) | 500+ |

### Data Growth Projections

| Timeframe | Contracts | Embeddings | Storage | DB Size |
|---|---|---|---|---|
| **Launch** | 5,000 | 50,000 | 50 GB | 5 GB |
| **Year 1** | 50,000 | 500,000 | 500 GB | 50 GB |
| **Year 2** | 200,000 | 2M | 2 TB | 200 GB |
| **Year 3** | 1M | 10M | 10 TB | 1 TB |

### Index Strategy

| Phase | Indexes |
|---|---|
| **Launch** | Composite `(tenantId, id)` on all tables, `(tenantId, status)`, `(tenantId, createdAt)` |
| **Growth** | Add `GIN` indexes for full-text search, `IVFFlat` for pgvector |
| **Scale** | Partial indexes for hot data, materialized views for dashboards |
| **Enterprise** | BRIN indexes for time-series data, table partitioning by date |

### Backup & Recovery

| Stage | RPO | RTO | Strategy |
|---|---|---|---|
| **Launch** | 1 hour | 4 hours | Daily snapshots + WAL streaming |
| **Growth** | 15 minutes | 1 hour | Point-in-time recovery (PITR) |
| **Scale** | 5 minutes | 30 minutes | PITR + geo-redundant backups |
| **Enterprise** | <1 minute | 15 minutes | Cross-region replication + auto-failover |

---

## 9. AI Scaling Strategy

### Cost Optimisation

| Strategy | Expected Savings | Implementation |
|---|---|---|
| **Model routing** | 40–60% | Route simple tasks to GPT-4o-mini, complex to GPT-4o |
| **Prompt caching** | 20–30% | Redis cache for repeated queries (same document, similar question) |
| **Batch embeddings** | 15–25% | Batch embed new documents instead of one-by-one |
| **Token optimisation** | 10–20% | Trim context, remove redundant system prompt tokens |
| **Fine-tuned models** | 30–50% (Year 2) | Domain-specific smaller models replace GPT-4o for extraction |

### AI Capacity Planning

| Phase | Monthly AI Budget | Queries/Day | Strategy |
|---|---|---|---|
| **Launch** | CHF 500–1,000 | 500 | GPT-4o-mini default, GPT-4o for extraction |
| **Growth** | CHF 2,000–5,000 | 5,000 | Prompt caching, batch processing |
| **Scale** | CHF 10,000–25,000 | 50,000 | Fine-tuned models, dedicated endpoints |
| **Enterprise** | CHF 50,000+ | 200,000+ | Custom models, provisioned throughput |

### RAG Scaling

| Phase | Vector Count | Strategy |
|---|---|---|
| **Launch** | <100K | pgvector IVFFlat, single table |
| **Growth** | 100K–1M | pgvector HNSW index, optimised probes |
| **Scale** | 1M–10M | Dedicated pgvector instance, partitioned tables |
| **Enterprise** | 10M+ | Evaluate dedicated vector DB + pgvector hybrid |

---

## 10. CDN & Performance Scaling

### Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| **Time to First Byte (TTFB)** | <200 ms | Lighthouse |
| **Largest Contentful Paint (LCP)** | <2.5 s | web-vitals |
| **First Input Delay (FID)** | <100 ms | web-vitals |
| **Cumulative Layout Shift (CLS)** | <0.1 | web-vitals |
| **API p95 latency** | <500 ms | Prometheus |

### CDN Strategy

| Phase | CDN Setup | Caching |
|---|---|---|
| **Launch** | Azure Front Door (Standard) | Static assets: 1 year, API: no cache |
| **Growth** | Azure Front Door (Premium) | + Document preview caching |
| **Scale** | Azure Front Door + Edge Rules | + Dynamic page caching (stale-while-revalidate) |
| **Enterprise** | Multi-POP, custom rules | + Edge-computed contract previews |

### Asset Optimisation

| Optimisation | Implementation | Impact |
|---|---|---|
| **Image optimisation** | Next.js `<Image>`, Sharp, WebP/AVIF | -60% size |
| **Code splitting** | Next.js automatic, dynamic imports | -40% initial JS |
| **Font optimisation** | `next/font`, self-hosted, subset | -30% font load |
| **CSS purging** | Tailwind JIT, tree-shaking | -80% CSS |
| **Compression** | Brotli (Nginx/CDN) | -70% transfer |

---

## 11. Team Scaling

### Current Team

| Role | Count | Focus |
|---|---|---|
| **Technical Founder / Full-Stack** | 1 | Architecture, development, DevOps |
| **Commercial Co-Founder** | 1 | Sales, marketing, partnerships |

### Hiring Plan

| Phase | Hire | Role | Priority |
|---|---|---|---|
| **Q2 2026** | 1 | Senior Full-Stack Developer | P0 |
| **Q3 2026** | 1 | Customer Success / Onboarding | P0 |
| **Q4 2026** | 1 | Senior Backend/AI Engineer | P1 |
| **Q1 2027** | 1 | DevOps / Platform Engineer | P1 |
| **Q2 2027** | 1 | Product Designer (UX) | P2 |
| **Q3 2027** | 2 | Full-Stack Developers | P2 |
| **Q4 2027** | 1 | Data Engineer | P2 |

### Team Structure (Target: End of 2027)

```
CTO (Technical Founder)
  ├── Engineering (4)
  │     ├── Senior Full-Stack ×2
  │     ├── Senior Backend/AI ×1
  │     └── DevOps/Platform ×1
  ├── Product (1)
  │     └── Product Designer ×1
  └── Data (1)
        └── Data Engineer ×1

CEO (Commercial Co-Founder)
  ├── Sales (TBD)
  └── Customer Success (1)
```

---

## 12. Cost Projections

### Monthly Infrastructure Cost

| Component | Launch | Growth | Scale | Enterprise |
|---|---|---|---|---|
| **Compute (Container Apps/AKS)** | CHF 400 | CHF 1,200 | CHF 4,000 | CHF 12,000 |
| **PostgreSQL** | CHF 200 | CHF 600 | CHF 2,000 | CHF 6,000 |
| **Redis** | CHF 50 | CHF 200 | CHF 800 | CHF 2,000 |
| **Storage (Blob)** | CHF 20 | CHF 100 | CHF 500 | CHF 2,000 |
| **CDN (Front Door)** | CHF 50 | CHF 200 | CHF 800 | CHF 2,000 |
| **AI (OpenAI/Azure)** | CHF 500 | CHF 3,000 | CHF 15,000 | CHF 50,000 |
| **Monitoring** | CHF 50 | CHF 200 | CHF 500 | CHF 1,000 |
| **Misc (DNS, certs, etc.)** | CHF 30 | CHF 100 | CHF 400 | CHF 1,000 |
| **Total** | **CHF 1,300** | **CHF 5,600** | **CHF 24,000** | **CHF 76,000** |

### Unit Economics Target

| Metric | Launch | Growth | Scale |
|---|---|---|---|
| **Customers** | 10 | 50 | 200 |
| **Avg. MRR per customer** | CHF 800 | CHF 1,200 | CHF 1,500 |
| **Total MRR** | CHF 8,000 | CHF 60,000 | CHF 300,000 |
| **Infra cost** | CHF 1,300 | CHF 5,600 | CHF 24,000 |
| **Gross margin** | 84% | 91% | 92% |

---

## 13. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **AI costs exceed budget** | Medium | High | Model routing, caching, fine-tuning |
| **Data breach** | Low | Critical | Encryption, RBAC, audit, penetration testing |
| **Key person dependency** | High | High | Documentation, hire #2 developer early |
| **Pricing too low** | Medium | Medium | Usage-based AI pricing, annual upsells |
| **Feature creep** | High | Medium | Strict prioritisation, customer-driven roadmap |
| **Azure outage (CH region)** | Low | High | Multi-AZ, backup in EU West |
| **Competitor launches** | Medium | Medium | Focus on Swiss specialisation, compliance |
| **Slow customer acquisition** | Medium | High | Pilot programmes, usage-based entry tier |

---

## 14. Success Metrics

### Key Performance Indicators

| Phase | KPI | Target |
|---|---|---|
| **Phase 1** | Paying customers | 10 |
| **Phase 1** | Monthly churn | <10% |
| **Phase 1** | Contract upload-to-extraction (p95) | <120 seconds |
| **Phase 2** | Paying customers | 50 |
| **Phase 2** | Net Revenue Retention (NRR) | >110% |
| **Phase 2** | API uptime | 99.9% |
| **Phase 3** | ARR | CHF 500K |
| **Phase 3** | CAC payback period | <12 months |
| **Phase 3** | NPS | >50 |
| **Phase 4** | ARR | CHF 2M |
| **Phase 4** | Customers | 200+ |
| **Phase 4** | Markets | 3+ (CH, DE, AT) |

### Product Health Metrics

| Metric | How Measured | Target |
|---|---|---|
| **DAU/MAU ratio** | Analytics | >40% |
| **AI extraction accuracy** | Manual review sampling | >92% |
| **Feature adoption** | Usage analytics per feature | >60% within 30 days |
| **Support ticket volume** | Helpdesk | <2 tickets/customer/month |
| **CSAT** | Post-interaction survey | >4.5/5 |

---

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: February 2026*
