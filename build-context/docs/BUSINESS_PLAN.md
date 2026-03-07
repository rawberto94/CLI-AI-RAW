# ConTigo — End-to-End Business Plan

**AI-Powered Contract Lifecycle Management**
**Domicile: Switzerland | Target: DACH + EU**
**Version 1.0 — February 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Company Overview](#2-company-overview)
3. [Problem & Market Opportunity](#3-problem--market-opportunity)
4. [Ideal Customer Profile & Personas](#4-ideal-customer-profile--personas)
5. [Solution](#5-solution)
6. [Product Roadmap](#6-product-roadmap)
7. [Business Model](#7-business-model)
8. [Go-to-Market Strategy](#8-go-to-market-strategy)
9. [Marketing Funnel & Conversion Model](#9-marketing-funnel--conversion-model)
10. [Partnership & Channel Strategy](#10-partnership--channel-strategy)
11. [Competitive Landscape & SWOT](#11-competitive-landscape--swot)
12. [Operations Plan](#12-operations-plan)
13. [Technology & IP](#13-technology--ip)
14. [Financial Projections & Scenario Analysis](#14-financial-projections--scenario-analysis)
15. [Funding & Use of Proceeds](#15-funding--use-of-proceeds)
16. [Exit Strategy](#16-exit-strategy)
17. [Risk Analysis](#17-risk-analysis)
18. [Milestones & KPIs](#18-milestones--kpis)
19. [Legal & Regulatory](#19-legal--regulatory)
20. [Swiss Ecosystem & Support Programmes](#20-swiss-ecosystem--support-programmes)
21. [Appendix](#21-appendix)

---

## 1. Executive Summary

**ConTigo** is a Swiss-domiciled, enterprise-grade SaaS platform that automates the entire contract lifecycle — from upload and AI-powered extraction to risk assessment, obligation tracking, and renewal management — while guaranteeing Swiss FADP and EU GDPR compliance through 100% Swiss/EU data residency.

### The Opportunity

- The global Contract Lifecycle Management (CLM) market is valued at **USD 2.9 billion (2025)** and is projected to reach **USD 11.2 billion by 2032** (CAGR ~21%).
- **71%** of companies cannot locate 10% or more of their contracts (WorldCC).
- Swiss and EU organisations face escalating pressure to keep sensitive legal data **outside US jurisdiction** (post-Schrems II, CLOUD Act concerns).
- No incumbent CLM vendor was built Swiss-first; all retro-fit data residency as an add-on.

### The Solution

ConTigo combines multi-agent AI (Azure OpenAI Switzerland North + Mistral AI EU), RAG-based semantic search, and automated obligation extraction in a single platform. Key differentiators:

| Differentiator | Detail |
|---|---|
| **Swiss-first architecture** | All data in Azure Switzerland North; no US cloud dependency |
| **Multi-agent AI** | Specialised agents for extraction, risk, compliance, rate analysis |
| **Rate card benchmarking** | Unique capability — no competitor offers this natively |
| **Real-time processing** | Sub-second search, live contract analytics |
| **Enterprise pricing in CHF** | Transparent, local-currency pricing for DACH market |

### Key Metrics (Current State)

| Metric | Value |
|---|---|
| Codebase | 240,000+ lines of production TypeScript |
| AI accuracy | 95%+ extraction, categorisation |
| Contract review speedup | 70–95% time reduction |
| Infrastructure cost (pilot) | CHF 75–85/month (Azure Container Apps) |
| Time to market | MVP live, onboarding first pilot customers |

---

## 2. Company Overview

### Legal Structure

| Item | Detail |
|---|---|
| **Legal form** | GmbH (Gesellschaft mit beschränkter Haftung) — recommended for early-stage Swiss SaaS |
| **Domicile** | Canton of Zurich, Switzerland |
| **Share capital** | CHF 20,000 minimum statutory capital |
| **Commercial register** | Handelsregisteramt des Kantons Zürich |
| **VAT** | Subject to Swiss MWST upon exceeding CHF 100,000 annual revenue |
| **Trade name** | ConTigo GmbH (subject to Handelsregister availability check) |

### Mission

Empower organisations to understand, control, and extract maximum value from their contract portfolios — with no data sovereignty compromise.

### Vision

Become the default contract intelligence platform for privacy-conscious enterprises in Europe.

### Values

1. **Data sovereignty** — Your data never leaves your jurisdiction
2. **Transparency** — Clear pricing, open API, no vendor lock-in
3. **Intelligence** — AI that augments human judgement, never replaces it
4. **Swiss quality** — Enterprise-grade reliability and precision

---

## 3. Problem & Market Opportunity

### 3.1 Problem Statement

**Contract management remains one of the last undigitised enterprise workflows.**

| Pain Point | Impact |
|---|---|
| Manual contract review | 8–12 hours per contract |
| Scattered storage | 71% of companies can't find 10% of contracts |
| Missed obligations | 15–25% of contract value lost to missed deadlines |
| Compliance risk | FADP/GDPR fines up to CHF 250,000 (individual) / 4% annual turnover (GDPR) |
| No rate visibility | Procurement overpays 10–25% due to missing benchmarks |
| US cloud dependency | Post-Schrems II legal uncertainty for EU/Swiss data in US clouds |

### 3.2 Market Sizing

#### Total Addressable Market (TAM)

- Global CLM market: **USD 11.2B by 2032**

#### Serviceable Addressable Market (SAM)

- European CLM market (DACH + Western EU): **~USD 3.4B by 2032**
- Swiss enterprises (500+ employees): ~3,200 companies
- DACH SME (50–500 employees): ~48,000 companies

#### Serviceable Obtainable Market (SOM) — Year 1–3

| Year | Target Customers | ARR Target |
|---|---|---|
| Year 1 | 15–25 customers | CHF 450K–750K |
| Year 2 | 60–100 customers | CHF 2.0M–3.5M |
| Year 3 | 150–250 customers | CHF 6.5M–10M |

### 3.3 Market Trends Favouring ConTigo

1. **Post-Schrems II data localisation** — Accelerating demand for EU/Swiss-sovereign SaaS
2. **AI adoption in legal tech** — 67% of legal departments plan AI adoption by 2027 (Gartner)
3. **FADP revision (Sept 2023)** — New Swiss data protection law creating compliance urgency
4. **Procurement digitisation** — CFOs demanding visibility into contractual obligations and spend
5. **Remote/hybrid work** — Distributed teams need centralised contract access
6. **ESG & compliance reporting** — Increasing board-level demand for contract analytics tied to supply chain transparency
7. **Procurement transformation** — CPOs investing in digital tools to manage inflationary cost pressures
8. **Legal ops professionalisation** — Chief Legal Officer roles evolving from cost centre to strategic function, requiring tooling

### 3.4 Industry Deep-Dive: Switzerland

Switzerland presents a uniquely attractive beachhead for CLM:

| Factor | Detail |
|---|---|
| **Corporate density** | 614,000 active companies; 3,200+ with 250+ employees (BFS) |
| **Cross-border contracts** | Swiss firms average 40–60% international contract volume (CH-EU-US) requiring multi-language, multi-jurisdiction support |
| **Regulatory complexity** | FADP + GDPR (for EU operations) + sector-specific rules (FINMA, Swissmedic, BAG) |
| **Digital adoption** | Switzerland ranks #1 on WIPO Global Innovation Index; 92% enterprise internet penetration |
| **Willingness to pay** | Swiss enterprises pay 20–40% premium for quality, security, and local support |
| **Language requirements** | DE/FR/IT/EN — ConTigo's multi-language AI is a strong fit |

---

## 4. Ideal Customer Profile & Personas

### 4.1 Ideal Customer Profile (ICP)

**Primary ICP — "Sweet Spot" Customer:**

| Attribute | Criteria |
|---|---|
| **Company size** | 50–500 employees (primary), 500–5,000 (expansion) |
| **Geography** | Switzerland (Year 1), DACH (Year 2), EU (Year 3) |
| **Industry** | IT services, pharma/life sciences, financial services, professional services, public sector |
| **Contract volume** | 200–10,000 active contracts |
| **Current state** | Managing contracts in shared drives, email, or Excel — no dedicated CLM tool |
| **Pain intensity** | Missed renewals have cost >CHF 50K; or compliance audit flagged contract management gaps |
| **Budget authority** | General Counsel, Head of Legal, CPO, or CFO |
| **Decision cycle** | 30–90 days (SME), 90–180 days (mid-market) |
| **Tech maturity** | Uses cloud/SaaS tools (M365, Salesforce, etc.) but no CLM |
| **Data sensitivity** | Requires Swiss/EU data residency — strong differentiator trigger |

**Exclusion criteria (anti-persona):**

- <50 contracts (too small — suggest free tools)
- Multinational with existing Icertis/SAP CLM deployment (displacement too hard Year 1)
- Public tenders requiring on-premise only (revisit when hybrid option launches)

### 4.2 Buyer Personas

#### Persona 1: "Compliance Claudia" — Head of Legal / General Counsel

| Attribute | Detail |
|---|---|
| **Title** | Head of Legal, General Counsel, Legal Ops Director |
| **Age/experience** | 35–55 years, 10+ years in corporate legal |
| **Goals** | Reduce contract risk, achieve FADP/GDPR compliance, free team from manual review |
| **Pain points** | Missed deadlines, regulatory audit anxiety, "where is that contract?" syndrome |
| **Decision drivers** | Data security, compliance features, ease of use, Swiss residency |
| **Objections** | "We've always used SharePoint", "AI accuracy concerns", "Change management effort" |
| **Content preferences** | Whitepapers, compliance guides, peer references, webinars |
| **How ConTigo wins** | FADP compliance built-in, 95%+ extraction accuracy demo, Swiss data residency proof |

#### Persona 2: "Procurement Peter" — Chief Procurement Officer / Head of Procurement

| Attribute | Detail |
|---|---|
| **Title** | CPO, Head of Procurement, Category Manager |
| **Age/experience** | 40–55 years, managed CHF 50M+ in vendor spend |
| **Goals** | Negotiate better rates, consolidate vendor contracts, reduce maverick spending |
| **Pain points** | No visibility into rate cards, duplicate vendor agreements, manual spend tracking |
| **Decision drivers** | ROI proof (savings identification), rate benchmarking, spend analytics |
| **Objections** | "Our ERP handles procurement", "Need SAP integration", "Prove ROI first" |
| **Content preferences** | ROI calculators, case studies with savings metrics, product demos |
| **How ConTigo wins** | Rate card benchmarking (unique), savings tracker, CHF ROI calculator |

#### Persona 3: "Finance Franziska" — CFO / Finance Director

| Attribute | Detail |
|---|---|
| **Title** | CFO, VP Finance, Financial Controller |
| **Age/experience** | 40–60 years, P&L responsibility |
| **Goals** | Reduce contractual exposure, improve cash flow predictability, support audit readiness |
| **Pain points** | Surprise auto-renewals, untracked financial obligations, audit gaps |
| **Decision drivers** | Total cost of ownership, payback period, integration with existing systems |
| **Objections** | "Another SaaS subscription?", "What's the payback period?", "Security audit required" |
| **Content preferences** | TCO comparisons, payback models, security documentation, SOC 2 reports |
| **How ConTigo wins** | < 6 month payback, CHF 0.30/contract/month, obligation tracking prevents value leakage |

#### Persona 4: "Startup Stefan" — CEO / COO of a Growing SME

| Attribute | Detail |
|---|---|
| **Title** | CEO, COO, or Office Manager at a company with 50–200 employees |
| **Age/experience** | 30–45 years, scaling fast, wearing multiple hats |
| **Goals** | Get contracts under control before next funding round, investor-ready documentation |
| **Pain points** | Contracts in 10 different folders, no one knows key dates, VC due diligence pressure |
| **Decision drivers** | Speed of setup, ease of use, price, free trial |
| **Objections** | "We only have 200 contracts", "Can we start free?", "Do we really need this yet?" |
| **Content preferences** | Quick-start guides, video demos, startup programme landing page |
| **How ConTigo wins** | 30-day free trial, startup discount (50% Y1), 30-min onboarding, immediate AI extraction |

### 4.3 Customer Journey Map

```
Awareness → Consideration → Evaluation → Purchase → Onboarding → Adoption → Expansion → Advocacy
   │             │              │            │           │            │          │           │
 LinkedIn    Whitepaper     Free trial   Contract    Migration    Training  Upsell to  Reference
 Content     Download       (30 days)    signed     (1-5 days)   (1-2 wk)  Pro/Ent    customer
 SEO/SEM    Webinar         RFP/Demo    Payment     AI scans     Usage     Add-ons    Case study
 Events     Case study      Pricing     Onboarding  portfolio    review    Users      NPS > 50
                            Security    call setup                        Contracts  Referral
                            review
```

| Stage | Duration | Key Metric | ConTigo Actions |
|---|---|---|---|
| **Awareness** | Ongoing | Impressions, website visits | Content marketing, LinkedIn, events, SEO |
| **Consideration** | 1–4 weeks | Content downloads, webinar sign-ups | Whitepapers, compliance guides, email nurture |
| **Evaluation** | 2–8 weeks | Trial activations, demo requests | 30-day trial, personalised demo, proof of concept |
| **Purchase** | 1–4 weeks | Close rate, deal size | Proposal, negotiation, contract, payment |
| **Onboarding** | 1–2 weeks | Time to first value (TTFV) | Guided setup, data migration, AI training run |
| **Adoption** | 1–3 months | DAU/MAU, contracts processed | In-app tooltips, check-in calls, success metrics |
| **Expansion** | Month 6+ | NRR, upsell rate | QBR (enterprise), feature usage analysis, upsell offers |
| **Advocacy** | Month 12+ | NPS, referrals, case studies | Referral programme, user conference, advisory board |

---

## 5. Solution

### 5.1 Platform Overview

ConTigo is a **B2B SaaS** platform covering the full contract lifecycle:

```
Upload → Extract → Analyse → Track → Renew → Report
```

### 5.2 Core Modules

#### Module 1: Intelligent Document Processing

- Multi-format ingestion (PDF, DOCX, XLSX, images, scans)
- OCR with 95%+ accuracy (Azure Vision + Mistral AI)
- Automated metadata extraction (18+ artifact types)
- Language detection (100+ languages)

#### Module 2: AI-Powered Analysis

- Multi-agent AI architecture (extraction, risk, compliance, rates)
- RAG-based semantic search across entire portfolio
- Natural language chat interface ("Show me expiring contracts over CHF 100K")
- Risk scoring (0–100) with explainable reasoning

#### Module 3: Obligation & Renewal Management

- Automated obligation extraction from contract text
- Proactive alerts at 90/60/30 days before expiration
- Renewal workflow automation
- Calendar integration

#### Module 4: Rate Card Benchmarking

- Rate extraction from SOWs and service agreements
- Market benchmark comparison
- Savings opportunity identification
- AI-recommended negotiation points

#### Module 5: Analytics & Reporting

- Portfolio dashboards (value, risk, status distribution)
- Spend analytics by vendor, department, category
- AI-generated executive reports
- Export to CSV, JSON, PDF

#### Module 6: Collaboration & Workflow

- Multi-user commenting and @mentions
- Configurable approval workflows
- Secure external sharing
- Full audit trail (365-day retention)

### 5.3 Technical Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Fastify, Prisma ORM |
| AI/ML | Azure OpenAI (Switzerland North), Mistral AI (EU), pgvector |
| Database | PostgreSQL 16 with pgvector, Redis 7 |
| Storage | MinIO / Azure Blob Storage |
| Queue | BullMQ (Redis-backed) |
| Infrastructure | Docker, Azure Container Apps, Azure Switzerland North |
| Monitoring | Prometheus, Grafana, OpenTelemetry |

---

## 6. Product Roadmap

### 6.1 Roadmap Overview

| Phase | Timeline | Theme | Key Deliverables |
|---|---|---|---|
| **Foundation** | Q1 2026 | Solid core | MVP stabilisation, pilot feedback, core AI accuracy to 97%+ |
| **Growth** | Q2–Q3 2026 | Market fit | German-language UI, e-signature integration, API v1, mobile web |
| **Scale** | Q4 2026–Q1 2027 | Enterprise readiness | SSO/SAML, LDAP, audit logs, SOC 2 Type II prep, custom workflows |
| **Expand** | Q2–Q4 2027 | European expansion | French/Italian UI, multi-entity support, on-premise hybrid, marketplace |
| **Platform** | 2028+ | Platform play | Marketplace for integrations, self-serve contract templates, public API ecosystem |

### 6.2 Detailed Feature Roadmap

#### Q1 2026 — Foundation

- [ ] Contract extraction accuracy improvements (target: 97%+)
- [ ] Bulk upload UX improvements (drag & drop, progress tracking)
- [ ] Notification system (email + in-app alerts)
- [ ] Export enhancements (PDF reports, CSV bulk export)
- [ ] Performance optimisation (sub-500ms search response)
- [ ] User feedback collection system
- [ ] Security hardening (pen test, CSP headers, rate limiting)

#### Q2 2026 — Growth Phase 1

- [ ] German-language complete UI translation (de-CH)
- [ ] DocuSign e-signature integration
- [ ] REST API v1 (read-only for Professional+)
- [ ] Webhook system for real-time event notifications
- [ ] Slack / Microsoft Teams integration
- [ ] Advanced filter & saved views
- [ ] Mobile-responsive web (PWA foundation)

#### Q3 2026 — Growth Phase 2

- [ ] Adobe Sign integration
- [ ] REST API v2 (read+write for Enterprise)
- [ ] Custom fields (user-defined metadata)
- [ ] Approval workflows (configurable multi-step)
- [ ] Template library (contract clause templates)
- [ ] Salesforce integration (bi-directional sync)
- [ ] SAP integration (read-only)

#### Q4 2026 — Enterprise Readiness

- [ ] SSO (SAML 2.0, OAuth 2.0 / OpenID Connect)
- [ ] LDAP / Active Directory sync
- [ ] SOC 2 Type II audit preparation
- [ ] IP whitelisting & advanced security controls
- [ ] Custom data retention policies
- [ ] White-label / custom branding (Enterprise)
- [ ] SLA monitoring dashboard
- [ ] Quarterly Business Review automation

#### Q1 2027 — Platform Foundations

- [ ] Multi-entity / subsidiary management
- [ ] Advanced RBAC (role-based access control)
- [ ] French-language UI (fr-CH)
- [ ] Italian-language UI (it-CH)
- [ ] On-premise hybrid deployment option
- [ ] Contract comparison tool (side-by-side diff)
- [ ] AI model fine-tuning per tenant

#### Q2–Q4 2027 — European Expansion

- [ ] DACH market localisation (DE, AT variations)
- [ ] Azure Marketplace listing
- [ ] Partner / reseller portal
- [ ] Advanced analytics & BI integrations
- [ ] Native mobile apps (iOS, Android)
- [ ] Contract negotiation module (redlining)
- [ ] Regulatory compliance module (EU AI Act readiness)

#### 2028+ — Platform Play

- [ ] Integration marketplace (ISV partners)
- [ ] Self-serve contract template builder
- [ ] Public API with developer portal
- [ ] AI assistant for contract drafting
- [ ] Blockchain timestamping (proof of existence)
- [ ] Multi-region deployment (Azure EU regions)

### 6.3 Build vs Buy vs Partner Matrix

| Capability | Decision | Rationale |
|---|---|---|
| Core AI extraction | **Build** | Core competency, competitive moat |
| E-signature | **Partner** (DocuSign, Adobe) | Commoditised, integrate via API |
| Payment processing | **Buy** (Stripe) | Best-in-class, PCI compliant |
| Email delivery | **Buy** (Resend/Sendgrid) | Deliverability, not a differentiator |
| SSO/Auth | **Buy** (Auth.js / Azure AD B2C) | Security-critical, proven solutions |
| OCR | **Partner** (Azure Vision) | GPU-intensive, scale with cloud provider |
| Search infrastructure | **Build** (pgvector + custom) | Core to RAG architecture, performance-critical |
| Monitoring | **Buy** (Prometheus/Grafana stack) | Open source, mature ecosystem |
| CRM connector | **Partner** (Salesforce API) | Standard API integration |
| ERP connector | **Build + Partner** | Custom for SAP/Oracle, modular approach |

---

## 7. Business Model

### 7.1 Revenue Model

**Subscription SaaS** — Monthly or annual recurring revenue (MRR/ARR).

| Plan | Price (CHF/month) | Contracts | Users | Key Features |
|---|---|---|---|---|
| **Starter** | CHF 490 | Up to 500 | 3 | Core AI, email support, Swiss storage |
| **Professional** | CHF 1,490 | Up to 5,000 | 10 | Advanced AI, rate benchmarking, API, priority support |
| **Enterprise** | Custom | Unlimited | Unlimited | White-label, SSO/LDAP, dedicated CSM, SLA 99.9%, on-prem option |

**Annual discount:** 2 months free (16.7% discount) on annual billing.

### 7.2 Secondary Revenue Streams

| Stream | Description | Est. Contribution |
|---|---|---|
| **Implementation fees** | Onboarding, data migration, custom config | CHF 2,000–15,000 one-time |
| **Custom integrations** | ERP, CRM, e-signature connectors | CHF 5,000–25,000 per integration |
| **Training packages** | On-site/remote training for legal & procurement teams | CHF 1,500–5,000 per session |
| **Premium support** | Dedicated success manager, 4h SLA | Included in Enterprise |
| **Overage charges** | Contracts/users above plan limit | Pay-as-you-go per unit |

### 7.3 Unit Economics (Target by Year 2)

| Metric | Target |
|---|---|
| **Average Contract Value (ACV)** | CHF 25,000 |
| **Customer Acquisition Cost (CAC)** | CHF 8,000 |
| **LTV:CAC Ratio** | > 5:1 |
| **Gross Margin** | 80–85% |
| **Net Revenue Retention** | > 110% |
| **Monthly Churn** | < 2% |
| **Payback Period** | < 6 months |

---

## 8. Go-to-Market Strategy

### 8.1 Phase 1: Founder-Led Sales (Months 1–12)

**Strategy:** Direct outreach + network-driven pipeline in Switzerland.

| Channel | Tactic |
|---|---|
| **Direct outreach** | Target 50 Swiss mid-market legal/procurement heads |
| **LinkedIn** | Thought leadership (Swiss data protection + AI in legal tech) |
| **Swiss tech events** | Swiss Legal Tech, Zurich Startup Ecosystem, Swiss ICT |
| **Referral programme** | 20% of first-year fee for qualified referrals |
| **Free trial** | 30-day full-access trial, no credit card |
| **Content marketing** | Blog, whitepapers on FADP compliance and contract AI |

**Target industries (Switzerland first):**

1. IT & Software companies (complex MSAs, SOWs)
2. Pharma & Life Sciences (regulatory compliance)
3. Financial services (high-value, high-risk contracts)
4. Public sector / Kantonal agencies (FADP compliance mandated)
5. Professional services / consulting firms

### 8.2 Phase 2: Scalable Sales (Months 12–24)

| Channel | Tactic |
|---|---|
| **Inside sales team** | 2 SDRs + 1 AE (DACH-focused) |
| **Partner channel** | Swiss law firms, Big 4 consulting, ERP consultants |
| **AWS/Azure marketplace** | Listed on Azure Marketplace (Swiss region) |
| **SEO/SEM** | German + English content for "Vertragsmanagement Schweiz", "CLM Swiss" |
| **Webinars** | Monthly demos + industry-specific deep dives |

### 8.3 Phase 3: European Expansion (Months 24–36)

- DACH expansion (Germany, Austria) — German-language support
- Benelux & Nordics — English-first markets
- France — Mistral AI partnership angle
- Channel partnerships with local legal tech resellers

### 8.4 Pricing Psychology

- **CHF pricing** signals Swiss quality and removes FX friction for DACH customers
- **Annual discount** (2 months free) drives cash upfront and reduces churn
- **No per-user pricing traps** — plan tiers include generous user counts
- **Free trial + implementation fee** — low barrier to entry, revenue on onboarding
- **Enterprise custom pricing** — allows deal flexibility for >100 user organisations

---

## 9. Marketing Funnel & Conversion Model

### 9.1 Funnel Metrics (Targets)

| Stage | Monthly Volume (M12) | Conversion Rate | Source |
|---|---|---|---|
| **Website visitors** | 8,000 | — | SEO, LinkedIn, events |
| **Content leads** (download/signup) | 400 | 5.0% of visitors | Whitepapers, webinars |
| **Trial activations** | 80 | 20% of leads | Free trial CTA |
| **Sales-qualified leads** | 40 | 50% of trials | Product usage trigger |
| **Demos completed** | 30 | 75% of SQLs | SDR outreach |
| **Proposals sent** | 20 | 67% of demos | AE-led process |
| **Deals closed** | 8 | 40% of proposals | Negotiation + close |
| **Overall visitor→customer** | 8 | **0.10%** | Industry avg: 0.05–0.15% |

### 9.2 Content Strategy

| Content Type | Frequency | Purpose | Owner |
|---|---|---|---|
| Blog posts (SEO) | 2/week | Organic traffic, thought leadership | Marketing |
| Whitepapers | 1/quarter | Lead generation (gated) | Technical Founder + Marketing |
| Case studies | 1/quarter | Social proof, sales enablement | Customer Success |
| Webinars | 1/month | Lead nurture, demo hook | Sales + Marketing |
| LinkedIn posts | 3/week | Brand awareness, personal branding | Founders |
| Email newsletter | 2/month | Nurture, product updates | Marketing |
| Video tutorials | 2/month | Onboarding, activation, YouTube SEO | Technical Founder |
| Podcast appearances | 1/month | Authority, reach new audiences | Founders |

### 9.3 SEO Strategy

**Target keywords (DE + EN):**

| Keyword Cluster | Search Vol (DE) | Difficulty | Priority |
|---|---|---|---|
| Vertragsmanagement Software | 880/mo | Medium | High |
| Contract Management Software Schweiz | 210/mo | Low | High |
| CLM Software | 590/mo | High | Medium |
| Vertragsverwaltung digital | 320/mo | Low | High |
| AI contract analysis | 480/mo | Medium | High |
| DSGVO Vertragsmanagement | 170/mo | Low | High |
| Kündigungsfristen verwalten | 720/mo | Low | Medium |
| Vertragsarten erkennen | 140/mo | Low | Medium |

**Technical SEO:** Next.js SSR/SSG for landing pages, structured data (JSON-LD), hreflang DE/EN/FR, sitemap.xml, Core Web Vitals optimised.

### 9.4 Paid Acquisition (After Seed Round)

| Channel | Monthly Budget (CHF) | Target CPC/CPL | Expected Leads |
|---|---|---|---|
| Google Ads (DE+EN) | 3,000 | CHF 15 CPC | 200 clicks → 20 leads |
| LinkedIn Ads | 4,000 | CHF 40 CPL | 100 leads |
| Retargeting (Display) | 1,000 | CHF 5 CPM | Brand awareness |
| Sponsorships (events) | 2,000 | — | 20–30 qualified leads |
| **Total** | **CHF 10,000/mo** | — | **~150 leads/month** |

---

## 10. Partnership & Channel Strategy

### 10.1 Partner Types

| Partner Type | Examples | Value to ConTigo | ConTigo Gives |
|---|---|---|---|
| **Referral partners** | Swiss law firms, tax advisors, IT consultants | Qualified leads, trust transfer | 15–20% Year 1 revenue share |
| **Reseller partners** | Legal tech resellers (DACH), ERP consultants | Sales coverage, local presence | 25–30% ongoing margin |
| **Technology partners** | DocuSign, Salesforce, SAP | Integration ecosystem, marketplace listing | Co-marketing, joint solutions |
| **Strategic partners** | Big 4 consulting (PwC, KPMG, Deloitte, EY) | Enterprise access, credibility | Implementation kickbacks, training |
| **Academic partners** | ETH Zurich, University of Zurich | AI research, talent pipeline | Research collaboration, internships |

### 10.2 Referral Partner Programme

**"ConTigo Partner Network"**

| Tier | Qualification | Commission | Benefits |
|---|---|---|---|
| **Registered** | Signed partner agreement | 10% Year 1 | Partner portal, marketing materials |
| **Silver** | 3+ referrals closed | 15% Year 1 | Co-branded landing page, quarterly sync |
| **Gold** | 10+ referrals or CHF 200K influenced | 20% Year 1 + 5% Year 2 | Joint marketing, event sponsorship, priority support |

### 10.3 Reseller Economics

| Item | Value |
|---|---|
| Reseller margin | 25–30% of list price |
| Minimum commitment | 5 customers/year |
| Training | ConTigo-certified programme (2 days) |
| Support | ConTigo handles L2/L3; reseller handles L1 |
| Deal registration | Required; 90-day exclusivity on registered deals |
| Payment | ConTigo invoices customer; pays reseller quarterly |

### 10.4 Strategic Partnership Roadmap

| Quarter | Partnership Target | Objective |
|---|---|---|
| Q2 2026 | 2–3 Swiss law firms (referral) | First 5 customer referrals |
| Q3 2026 | DocuSign tech partnership | Co-integration, marketplace listing |
| Q4 2026 | 1 Swiss IT reseller | DACH sales coverage |
| Q1 2027 | Salesforce AppExchange | Listed integration |
| Q2 2027 | 1 Big 4 consulting firm | Joint go-to-market for enterprise |
| Q4 2027 | Azure Marketplace | Direct cloud marketplace listing |

---

## 11. Competitive Landscape & SWOT

### 11.1 Direct Competitors

| Company | HQ | Strength | Weakness vs ConTigo |
|---|---|---|---|
| **Ironclad** | USA | Strong workflow engine | US data residency, no FADP focus |
| **Juro** | UK | Modern UX, contract creation | No Swiss residency, limited analytics |
| **Icertis** | USA | Enterprise-grade, large clients | Expensive, heavy implementation, US cloud |
| **DocuSign CLM** | USA | Brand recognition, e-signatures | US-centric, complex pricing, slow AI |
| **ContractPodAi** | UK/USA | AI-powered CLM | No Swiss focus, limited rate benchmarking |
| **Precisely (Agiloft)** | USA | Highly configurable | Steep learning curve, US data |

### 11.5 ConTigo's Competitive Moats

1. **Swiss Data Residency (native)** — Not a bolt-on; architecture-first
2. **Rate Card Benchmarking** — No competitor offers this as a built-in module
3. **Multi-agent AI with Swiss AI providers** — Azure OpenAI Switzerland North + Mistral EU
4. **Speed** — Sub-second semantic search vs minutes for legacy CLMs
5. **Price-performance** — 40–60% cheaper than Icertis/Ironclad for equivalent features
6. **Swiss GmbH trust** — Legal entity, data, support all in Switzerland

### 11.2 Indirect Competitors

| Category | Players | Why They're Not Ideal |
|---|---|---|
| **Shared drives / email** | Google Drive, OneDrive, email attachments | Zero automation, no AI, no obligation tracking |
| **Generic DMS** | SharePoint, Confluence, Box | Document storage but no contract intelligence |
| **ERP contract modules** | SAP Ariba, Oracle Procurement | Procurement-focused, limited AI, complex to deploy |
| **E-signature + basic CLM** | DocuSign, PandaDoc | Strong on signing, weak on post-signature management |
| **Legal case management** | Clio, Smokeball | Law-firm focused, not enterprise contract management |

### 11.3 SWOT Analysis

#### Strengths

| # | Strength | Detail |
|---|---|---|
| S1 | **Swiss-native data residency** | Only CLM built from Day 1 for Swiss FADP compliance; competitors bolt it on |
| S2 | **Complete AI architecture** | Multi-agent AI, RAG search, rate benchmarking — no competitor has all three |
| S3 | **240K+ lines production-ready code** | Massive head start; would cost CHF 1–2M to replicate |
| S4 | **CHF pricing for DACH** | Removes FX friction, signals local commitment |
| S5 | **Low infrastructure cost** | CHF 200/month at pilot scale; enables aggressive pricing |
| S6 | **Modern tech stack** | Next.js 15, React 19 — attracts top engineering talent |
| S7 | **Rate card benchmarking** | Unique feature — procurement buyers have no alternative |

#### Weaknesses

| # | Weakness | Mitigation |
|---|---|---|
| W1 | **Solo founder (technical)** | Recruit commercial co-founder (6-month probation); advisory board |
| W2 | **No brand awareness** | Content marketing, Swiss tech events, referral partners |
| W3 | **No customer references (yet)** | Pilot programme with 3–5 friendly companies; case studies by Q3 |
| W4 | **Enterprise sales inexperience** | Hire experienced DACH enterprise sales lead Q1 |
| W5 | **No SOC 2 certification** | Budget for SOC 2 Type II by Q4 2026 |
| W6 | **Single-region risk** | Azure Switzerland North only; add DR by Q2 2027 |

#### Opportunities

| # | Opportunity | Action |
|---|---|---|
| O1 | **Post-Schrems II urgency** | Position as the sovereign alternative to US CLMs |
| O2 | **FADP enforcement begins** | Create compliance urgency content; partner with privacy consultants |
| O3 | **EU AI Act compliance** | Build compliance-by-design; market to regulated industries |
| O4 | **Swiss public sector digitisation** | Target cantonal/federal agencies (data sovereignty mandated) |
| O5 | **Legal ops professionalisation** | Partner with CLOC, legal ops communities in DACH |
| O6 | **Procurement AI adoption** | CPOs seeking AI tools — rate benchmarking is the hook |
| O7 | **M&A due diligence** | Contract analysis module for PE/VC due diligence workflows |

#### Threats

| # | Threat | Mitigation |
|---|---|---|
| T1 | **Incumbent enters Swiss market** | Speed of execution; local trust advantage; stickier product |
| T2 | **Azure OpenAI pricing increase** | Mistral AI EU fallback; negotiate reserved capacity |
| T3 | **EU AI Act over-regulation** | Close monitoring; explainable AI design; legal counsel |
| T4 | **Economic downturn** | Software budgets cut → emphasise ROI & cost savings |
| T5 | **Key person dependency** | Documentation, modular code, hire second engineer early |
| T6 | **Open-source CLM emerges** | Differentiate on managed service, Swiss compliance, AI quality |

### 11.4 Positioning Statement

> **For** legal, procurement, and finance teams in privacy-conscious European organisations  
> **Who** need to manage contracts efficiently without compromising data sovereignty  
> **ConTigo** is an AI-powered contract intelligence platform  
> **That** automates extraction, risk assessment, and obligation tracking  
> **Unlike** US-based CLM vendors  
> **We** guarantee 100% Swiss data residency, transparent CHF pricing, and rate card benchmarking built-in.

---

## 12. Operations Plan

### 12.1 Team (Current & Planned)

#### Current (Founding Phase)

| Role | Person | Focus | Compensation Model |
|---|---|---|---|
| **CTO / Technical Founder** | [You] | Architecture, AI, full-stack development | Fixed salary (see Founders' Pact §7.1) |
| **Commercial Co-Founder** | TBD | Sales, BD, fundraising, operations | Lower fixed base + performance commission (see Founders' Pact §7.6) |

> **Key terms:** The Commercial Co-Founder is subject to a **6-month probationary period** (Founders' Pact §1.5) with defined milestones, a **12-month vesting cliff** (§3.2), and a **commission-based compensation model** tied directly to client acquisition (§7.6). This structure keeps fixed costs low during bootstrap/pre-seed while maximising sales incentive.

#### Year 1 Hires (6 FTEs target)

| Role | Priority | Compensation Range (CHF/year) |
|---|---|---|
| Sales / BD Lead (DACH) | Q1 | 100,000–130,000 + commission |
| Frontend Engineer | Q2 | 110,000–140,000 |
| Customer Success Manager | Q2 | 85,000–105,000 |
| DevOps / SRE | Q3 | 120,000–150,000 |
| Marketing Manager (content) | Q3 | 80,000–100,000 |
| Backend / AI Engineer | Q4 | 120,000–150,000 |

#### Year 2 Hires (additional 6–8 FTEs)

- 2× SDRs, 1× AE, 1× Solutions Engineer, 1× Data Scientist, 1× Designer, 1–2× Engineers

### 12.2 Infrastructure Costs

| Component | Pilot (5 clients) | Growth (50 clients) | Scale (200+ clients) |
|---|---|---|---|
| Azure Container Apps | CHF 75–85/mo | CHF 300–500/mo | CHF 1,500–3,000/mo |
| Azure OpenAI (Swiss) | CHF 50–100/mo | CHF 500–1,000/mo | CHF 3,000–8,000/mo |
| PostgreSQL (Azure) | CHF 30–50/mo | CHF 200–400/mo | CHF 800–2,000/mo |
| Redis | CHF 15–25/mo | CHF 50–100/mo | CHF 200–500/mo |
| Blob Storage | CHF 10–20/mo | CHF 100–200/mo | CHF 500–1,500/mo |
| Monitoring | CHF 20–30/mo | CHF 100–200/mo | CHF 300–500/mo |
| **Total** | **CHF 200–310/mo** | **CHF 1,250–2,400/mo** | **CHF 6,300–15,500/mo** |

### 12.3 Key Vendors & Partners

| Category | Vendor | Purpose |
|---|---|---|
| Cloud | Azure (Switzerland North) | Primary infrastructure |
| AI | Azure OpenAI + Mistral AI | LLM providers |
| Payments | Stripe (EU entity) | Billing & subscriptions |
| Legal | Swiss law firm (TBD) | Corporate, IP, data protection |
| Accounting | Treuhänder / fiduciary | Swiss bookkeeping, VAT, AHV |
| Banking | Swiss cantonal bank or neobank | Business account |

### 12.4 Operational KPIs & Reporting Cadence

| Report | Frequency | Owner | Audience |
|---|---|---|---|
| Revenue & pipeline | Weekly | Sales | Founders |
| Sprint velocity / burn-down | Bi-weekly | CTO | Engineering |
| Customer health scores | Monthly | CS Manager | Founders |
| P&L and cash position | Monthly | Finance / Treuhänder | Founders, Board |
| Product usage analytics | Monthly | CTO | Product team |
| Infrastructure cost report | Monthly | DevOps | CTO |
| NPS survey | Quarterly | CS Manager | All |
| Board update | Quarterly | CEO | Board + Investors |
| Security audit review | Quarterly | CTO | CISO / Legal |
| Annual budget | Annually | CEO + CFO | Board |

### 12.5 Tools & Systems

| Function | Tool | Cost (Est. CHF/month) |
|---|---|---|
| Code repository | GitHub (Team) | 35 |
| Project management | Linear | 64 (8 seats) |
| Design | Figma (Team) | 120 |
| CRM | HubSpot (Starter) | 180 |
| Email marketing | Resend | 25 |
| Customer support | Intercom (Start) | 290 |
| Accounting | Bexio | 65 |
| HR / Payroll | Swisssalary or bob | 150 |
| Password management | 1Password Business | 60 |
| Communication | Slack (Pro) | 60 |
| Video calls | Google Meet (Workspace) | 60 |
| Analytics | Plausible Analytics | 19 |
| **Total SaaS stack** | | **~CHF 1,130/month** |

---

## 13. Technology & IP

### 13.1 Intellectual Property

| IP Type | Status | Protection |
|---|---|---|
| **Source code** | 240,000+ lines authored by technical founder | Copyright (automatic under Swiss URG) |
| **Trade name** | "ConTigo" | Trademark registration (IGE) recommended |
| **Trade secrets** | AI prompt engineering, RAG architecture, agent orchestration | NDA + employment contracts |
| **Domain** | contigo-app.ch | Registered (SWITCH/.ch) |
| **Architecture** | Multi-agent AI system design | Trade secret + potential patent |

### 13.2 IP Assignment

All IP created by the technical founder pre-incorporation **must be formally assigned** to the GmbH via an IP Assignment Agreement (see Founders' Pact §4). This is critical for investor due diligence. Additionally:

- **Trademark** registration (“ConTigo”) with IGE within 60 days of incorporation (Founders' Pact §4.7)
- **Domain** (contigo-app.ch) assigned to GmbH with founder reversion rights (Founders' Pact §4.5)
- **Spousal acknowledgement** letters obtained from married founders (Founders' Pact §18.1.1)
- **Background verification** on co-founder completed (Founders' Pact §1.4)

### 13.3 Open Source Dependencies

The platform uses well-established open-source frameworks (Next.js, Prisma, PostgreSQL, Redis) under permissive licences (MIT, Apache 2.0, PostgreSQL). No GPL-contamination risk in the core product. A full dependency audit (SBOM) should be maintained.

### 13.4 Technology Moat Assessment

| Moat Component | Depth | Time to Replicate | Defensibility |
|---|---|---|---|
| **Multi-agent AI orchestration** | Deep | 6–12 months | High — requires domain expertise + engineering |
| **RAG architecture for contracts** | Medium | 3–6 months | Medium — pattern known but domain tuning is key |
| **Rate card extraction engine** | Deep | 9–12 months | High — no competitor has this; requires training data |
| **Swiss infra architecture** | Medium | 1–3 months | Low–Medium — can be replicated by any vendor |
| **240K lines of production code** | Very Deep | 18–24 months | Very High — equivalent to CHF 1–2M+ investment |
| **Prompt engineering library** | Deep | 6–9 months | Medium — trade secret, not visible to competitors |
| **Customer-specific AI tuning** | Grows over time | N/A | Very High — network effect per tenant |

### 13.5 Security Architecture

| Layer | Implementation |
|---|---|
| **Encryption at rest** | AES-256-GCM (database, files, backups) |
| **Encryption in transit** | TLS 1.3 (all connections) |
| **Authentication** | JWT + refresh tokens, optional MFA |
| **Authorization** | RBAC with tenant isolation (row-level security) |
| **API security** | Rate limiting, CSRF tokens, CSP headers, CORS |
| **Data isolation** | Multi-tenant with per-tenant encryption keys (Enterprise) |
| **Backup** | Daily automated, 30-day retention, encrypted at rest |
| **Disaster recovery** | RPO: 1 hour, RTO: 4 hours (target) |
| **Penetration testing** | Annual (third-party), continuous dependency scanning |
| **Compliance** | FADP, GDPR, preparing for SOC 2 Type II |

---

## 14. Financial Projections & Scenario Analysis

### 14.1 Revenue Forecast (CHF)

| Year | Customers | ACV | ARR | MRR |
|---|---|---|---|---|
| **Year 1** | 20 | 22,000 | 440,000 | 36,700 |
| **Year 2** | 80 | 27,000 | 2,160,000 | 180,000 |
| **Year 3** | 200 | 32,000 | 6,400,000 | 533,000 |
| **Year 4** | 400 | 35,000 | 14,000,000 | 1,167,000 |
| **Year 5** | 700 | 38,000 | 26,600,000 | 2,217,000 |

### 14.2 Cost Structure (Year 1, CHF)

| Category | Amount | % of Revenue |
|---|---|---|
| **Personnel** (2 founders + 3 hires) | 450,000 | 102% |
| **Infrastructure** (Azure, tools) | 25,000 | 6% |
| **Sales & Marketing** | 40,000 | 9% |
| **Legal & Accounting** | 30,000 | 7% |
| **Office / Coworking** | 15,000 | 3% |
| **Insurance (D&O, cyber)** | 8,000 | 2% |
| **Miscellaneous** | 12,000 | 3% |
| **Total Costs** | **580,000** | **132%** |
| **Net Burn** | **(140,000)** | — |

> **Note:** Year 1 is investment-phase. Break-even projected in Month 18–22.

### 14.3 Cash Flow & Runway

| Scenario | Pre-seed Raise | Runway (months) |
|---|---|---|
| Bootstrap | CHF 0 | 6–9 (founder savings) |
| Pre-seed | CHF 300,000 | 15–18 |
| Seed | CHF 800,000 | 24–30 |

### 14.4 Break-Even Analysis

- **Break-even MRR:** ~CHF 45,000/month (≈30 Professional customers)
- **Projected break-even:** Month 18–22 (with pre-seed funding)
- **Gross margin at scale:** 82–85%

### 14.5 Scenario Analysis

#### Optimistic Scenario ("Product-Market Fit Hits Fast")

| Assumption | Value |
|---|---|
| Sales cycle | 30–60 days average |
| Monthly new customers | 3–5 by Month 6, 8–10 by Month 12 |
| Logo churn | <5% annual |
| NRR | 125% |

| Year | Customers | ARR (CHF) |
|---|---|---|
| Year 1 | 35 | 770,000 |
| Year 2 | 140 | 3,780,000 |
| Year 3 | 350 | 11,200,000 |
| Year 5 | 1,200 | 45,600,000 |

**Implication:** Accelerate seed round to Q3 2026. Series A at CHF 5–8M in Q4 2027. Break-even by Month 14.

#### Base Scenario ("Steady Builder")

| Assumption | Value |
|---|---|
| Sales cycle | 60–120 days average |
| Monthly new customers | 1–2 by Month 6, 3–5 by Month 12 |
| Logo churn | <10% annual |
| NRR | 110% |

| Year | Customers | ARR (CHF) |
|---|---|---|
| Year 1 | 20 | 440,000 |
| Year 2 | 80 | 2,160,000 |
| Year 3 | 200 | 6,400,000 |
| Year 5 | 700 | 26,600,000 |

**Implication:** This is the primary financial plan. Seed round Q1 2027. Series A Q1 2028. Break-even Month 18–22.

#### Pessimistic Scenario ("Slow Burn")

| Assumption | Value |
|---|---|
| Sales cycle | 120–180 days average |
| Monthly new customers | 0–1 by Month 6, 1–2 by Month 12 |
| Logo churn | 15% annual |
| NRR | 95% |

| Year | Customers | ARR (CHF) |
|---|---|---|
| Year 1 | 10 | 220,000 |
| Year 2 | 35 | 945,000 |
| Year 3 | 80 | 2,560,000 |
| Year 5 | 250 | 9,500,000 |

**Implication:** Extend runway via Innosuisse grant (CHF 100–200K). Defer 2 hires by 6 months. Pivot to vertical focus (e.g., pharma only). Break-even Month 28–32.

### 14.6 Unit Economics Deep-Dive

| Metric | Year 1 (Target) | Year 2 (Target) | Year 3 (Target) | Best-in-Class SaaS |
|---|---|---|---|---|
| **ACV** | CHF 22,000 | CHF 27,000 | CHF 32,000 | — |
| **CAC** (blended) | CHF 12,000 | CHF 8,000 | CHF 6,500 | — |
| **CAC payback** | 7 months | 4 months | 3 months | <12 months |
| **Gross margin** | 85% | 87% | 88% | >80% |
| **LTV** (3-yr, 10% churn) | CHF 56,000 | CHF 69,000 | CHF 82,000 | — |
| **LTV:CAC** | 4.7x | 8.6x | 12.6x | >3x |
| **NRR** | 105% | 115% | 120% | >100% |
| **Logo churn** | 8% | 6% | 4% | <10% |
| **Burn multiple** | 2.5x | 1.2x | 0.7x | <1.5x |
| **Rule of 40** | -30 (growth phase) | 25 | 45 | >40 |

### 14.7 Sensitivity Analysis

| Variable | -20% Impact on Year 2 ARR | +20% Impact on Year 2 ARR |
|---|---|---|
| **Customer count** | CHF 1,728,000 (-20%) | CHF 2,592,000 (+20%) |
| **ACV** | CHF 1,728,000 (-20%) | CHF 2,592,000 (+20%) |
| **Churn rate** (10%→12% vs 8%) | CHF 2,052,000 (-5%) | CHF 2,268,000 (+5%) |
| **Sales cycle** (+/- 30 days) | CHF 1,836,000 (-15%) | CHF 2,376,000 (+10%) |

> **Key insight:** Customer count and ACV are the two highest-leverage variables. Optimise for: (1) more customers, then (2) larger deals.

---

## 15. Funding & Use of Proceeds

### 15.1 Funding Strategy

| Round | Timing | Target (CHF) | Purpose |
|---|---|---|---|
| **Pre-seed** | Q2 2026 | 250,000–400,000 | First hires, GTM, pilot customers |
| **Seed** | Q1 2027 | 800,000–1,500,000 | Scale sales, DACH expansion, product maturity |
| **Series A** | Q1 2028 | 3,000,000–5,000,000 | European expansion, 50+ customers, enterprise features |

### 15.2 Pre-Seed Use of Proceeds

| Category | Allocation | Amount (CHF) |
|---|---|---|
| Engineering | 35% | 105,000 |
| Sales & BD | 30% | 90,000 |
| Marketing | 15% | 45,000 |
| Legal & IP | 10% | 30,000 |
| Reserve | 10% | 30,000 |
| **Total** | **100%** | **300,000** |

### 15.3 Target Investors

| Type | Examples | Rationale |
|---|---|---|
| Swiss angels | Swiss Startup Invest, Business Angels Switzerland | Local network, DACH domain expertise |
| Swiss VCs | Wingman Ventures, Lakestar, VI Partners | Swiss SaaS expertise |
| EU legal tech funds | Legal.io, Mishcon Ventures | Domain focus |
| Swiss govt grants | Innosuisse (CTI), Venture Kick | Non-dilutive, credibility |
| Strategic | Law firms, Big 4 innovation arms | Channel partnership potential |

---

## 16. Exit Strategy

### 16.1 Exit Options

| Exit Type | Timeline | Valuation Range | Likelihood |
|---|---|---|---|
| **Strategic acquisition (US CLM vendor)** | Year 4–6 | CHF 80–200M (15–25x ARR) | High if growing in EU |
| **Strategic acquisition (ERP/legal tech)** | Year 4–7 | CHF 50–150M (10–20x ARR) | Medium |
| **Private equity buyout** | Year 5–7 | CHF 40–120M (8–15x ARR) | Medium |
| **IPO (SIX Swiss Exchange or dual)** | Year 7–10 | CHF 200M+ (20–30x ARR) | Low (requires CHF 30M+ ARR) |
| **Management buyout (MBO)** | Year 5+ | CHF 30–80M (6–12x ARR) | Low |
| **Continue as profitable private** | Indefinite | N/A | Always an option |

### 16.2 Most Likely Exit Path

**Strategic acquisition by a US CLM vendor or enterprise software company seeking European/Swiss market entry.**

Rationale:

- US CLMs (Ironclad, Icertis, DocuSign) all face data sovereignty barriers in EU/Swiss markets
- Acquiring ConTigo gives immediate Swiss FADP compliance + EU customer base + Swiss-resident AI architecture
- More cost-effective than building Swiss infra from scratch
- Precedent: Numerous US SaaS acquisitions of European point solutions (e.g., Templafy, GetAccept, Precisely/Agiloft)

### 16.3 Value Maximisation Drivers

| Driver | Action | Impact on Valuation |
|---|---|---|
| **ARR growth rate** | Maintain >100% YoY through Year 3 | Primary valuation driver |
| **NRR >120%** | Expand existing customers via upsell | Signals product-market fit |
| **Swiss/EU compliance moat** | SOC 2, ISO 27001, FADP certified | Premium for regulated-market access |
| **Enterprise customer logos** | Land 3–5 brand-name Swiss companies | De-risks the acquisition |
| **Technology IP** | Patent-pending AI extraction methods | Adds IP value to deal |
| **Team & culture** | Retain key engineers through acquisition | Acqui-hire component |
| **Data network effects** | Cross-customer benchmarking data | Unique data asset |

### 16.4 Comparable Transactions

| Year | Target | Acquirer | Deal Value | Multiple |
|---|---|---|---|---|
| 2024 | Agiloft | Precisely | ~USD 700M | ~20x ARR |
| 2023 | ContractPodAi | [Private] | ~USD 200M | ~25x ARR |
| 2022 | Ironclad (Series E) | [Venture] | USD 3.2B valuation | ~50x ARR |
| 2022 | Icertis (Series F) | [Venture] | USD 5.0B valuation | ~40x ARR |
| 2021 | Kira Systems | Litera | ~USD 300M | ~30x ARR |
| 2020 | Seal Software | DocuSign | ~USD 188M | ~15x ARR |

---

## 17. Risk Analysis

### 17.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Slow enterprise sales cycles** | High | High | Free trial, self-serve onboarding, target SME first |
| **AI regulation (EU AI Act)** | Medium | Medium | Compliance-by-design, explainable AI, no high-risk classification |
| **Azure Switzerland outage** | Low | High | Multi-region DR plan, Mistral EU fallback |
| **Key person risk (CTO)** | Medium | Critical | Documentation, founder vesting, hire early |
| **Competitor replication** | Medium | Medium | Speed of execution, Swiss trust, rate card moat |
| **Data breach** | Low | Critical | Encryption at rest/transit, pen testing, cyber insurance |
| **CHF revenue / EUR costs mismatch** | Medium | Low | CHF invoicing, Swiss banking, hedge if needed |
| **Regulatory change (FADP)** | Low | Medium | Legal counsel on retainer, proactive compliance |
| **Customer concentration** | Medium | High | Diversify by industry, cap single-customer revenue at 25% |

### 17.2 Contingency Plans

- **If sales are slower than projected:** Extend runway by deferring hires 3–6 months; pursue Innosuisse grant (CHF 100K–200K non-dilutive)
- **If a competitor enters Swiss market:** Accelerate product velocity; leverage existing customer relationships and local trust
- **If Azure Switzerland pricing increases:** Multi-cloud readiness (architecture already uses Docker/Kubernetes-ready containers)

### 17.3 Insurance Strategy

| Insurance Type | Timing | Est. Annual Premium (CHF) | Coverage |
|---|---|---|---|
| **Berufshaftpflicht** (professional liability) | Incorporation | 2,000–4,000 | Professional errors, data breach liability |
| **Betriebshaftpflicht** (general liability) | Incorporation | 800–1,500 | Third-party property damage, injuries |
| **Cyber insurance** | Q2 2026 | 3,000–6,000 | Data breach response, ransomware, business interruption |
| **D&O insurance** | Post-seed round | 2,000–5,000 | Director & officer personal liability |
| **Rechtsschutz** (legal protection) | Incorporation | 1,000–2,000 | Employment disputes, contract disputes |
| **UVG** (accident insurance) | First employee | Mandatory (SUVA rates) | Employee workplace accidents |
| **KTG** (daily sickness benefits) | First employee | ~1–2% of insured payroll | 80% salary replacement during illness |

---

## 18. Milestones & KPIs

### 18.1 Key Milestones

| Quarter | Milestone |
|---|---|
| **Q1 2026** | MVP live, first 3 pilot customers onboarded |
| **Q2 2026** | GmbH incorporated, pre-seed closed, 10 paying customers |
| **Q3 2026** | First Enterprise customer, CHF 15K MRR |
| **Q4 2026** | 20 customers, CHF 35K MRR, German-language support |
| **Q1 2027** | Seed round closed, first DACH (non-CH) customer |
| **Q2 2027** | 50 customers, CHF 100K MRR, e-signature integration |
| **Q4 2027** | 100 customers, CHF 200K MRR, mobile apps launched |
| **Q2 2028** | Series A, 200 customers, European expansion |

### 18.2 North Star Metric

**Monthly Contracts Processed (active usage)** — this measures both acquisition and engagement.

### 18.3 KPI Dashboard

| KPI | Target (Month 12) | Target (Month 24) |
|---|---|---|
| ARR | CHF 440K | CHF 2.2M |
| MRR | CHF 37K | CHF 180K |
| Paying customers | 20 | 80 |
| Net Revenue Retention | 105% | 115% |
| Monthly churn | < 3% | < 2% |
| NPS | > 40 | > 50 |
| CAC payback (months) | < 8 | < 6 |
| Contracts processed (monthly) | 5,000 | 50,000 |

### 18.4 OKR Framework (Sample Quarter)

**Q2 2026 — "First Revenue & Founding"**

**Objective 1: Establish ConTigo as a credible Swiss CLM player**
| Key Result | Target | Metric |
|---|---|---|
| KR1 | Incorporate GmbH and register for MWST | Binary |
| KR2 | Close pre-seed round (CHF 250K+) | CHF raised |
| KR3 | Launch public website with Swiss positioning | Binary |
| KR4 | Publish 6 thought-leadership articles | Count |

**Objective 2: Prove product-market fit with paying customers**
| Key Result | Target | Metric |
|---|---|---|
| KR1 | 10 paying customers | Logos |
| KR2 | CHF 10K MRR | Revenue |
| KR3 | NPS > 40 from pilot customers | NPS |
| KR4 | < 5% monthly churn | Churn rate |

**Objective 3: Build the foundation for scalable sales**
| Key Result | Target | Metric |
|---|---|---|
| KR1 | Hire Sales/BD Lead (DACH) | Binary |
| KR2 | Create 3 case studies | Count |
| KR3 | Establish 2 referral partnerships | Count |
| KR4 | Build sales playbook (ICP, objections, demos) | Binary |

---

## 19. Legal & Regulatory

### 19.1 Corporate Setup Checklist

- [ ] GmbH incorporation (Notary + Handelsregister)
- [ ] Stammkapital deposit: CHF 20,000
- [ ] Business bank account (UBS, ZKB, Postfinance, or neobank)
- [ ] Treuhänder / fiduciary for bookkeeping
- [ ] AHV/IV employer registration
- [ ] Accident insurance (UVG) via SUVA or private insurer
- [ ] BVG (pension) provider setup when headcount ≥ 1 employee
- [ ] VAT registration (MWST) — mandatory above CHF 100K/year revenue
- [ ] D&O insurance
- [ ] Cyber liability insurance
- [ ] Domain & trademark filing (IGE Bern)

### 19.2 Data Protection

| Requirement | Status |
|---|---|
| Swiss FADP compliance | Architecture-ready |
| EU GDPR compliance | Architecture-ready |
| DPA template for customers | To be drafted with legal counsel |
| Privacy policy (website) | To be published |
| Cookie consent | To be implemented |
| DPIA (Data Protection Impact Assessment) | To be completed |
| Sub-processor register | Azure, Mistral AI — documented |

### 19.3 Contractual Templates Needed

- [ ] General Terms & Conditions (AGB) — English + German
- [ ] Data Processing Agreement (DPA / AVV)
- [ ] Service Level Agreement (SLA)
- [ ] Non-Disclosure Agreement (NDA)
- [ ] Employment contracts (Swiss OR-compliant)
- [ ] Freelancer / contractor agreements
- [ ] IP Assignment Agreement (founder → GmbH)

### 19.4 Data Protection Deep-Dive

#### FADP (nDSG) Compliance Matrix

| Requirement | Article | ConTigo Status | Action Needed |
|---|---|---|---|
| Data Processing Register | Art. 12 | ✅ Architecture-ready | Document all processing activities |
| Privacy by Design | Art. 7 | ✅ Built-in | No action |
| DPIA for high-risk processing | Art. 22 | ⬜ To do | Complete assessment with counsel |
| Cross-border transfer safeguards | Art. 16 | ✅ No cross-border (Swiss data stays in CH) | Document for customers |
| Data breach notification (72h) | Art. 24 | ⬜ Process needed | Create incident response plan |
| Right to information | Art. 25 | ⬜ Process needed | Build data export functionality |
| Right to deletion | Art. 32 | ⬜ Process needed | Build account deletion workflow |
| Data portability | Art. 28 | ✅ Export in CSV/JSON | Document in AGB |
| Consent management | Art. 6 | ⬜ To implement | Cookie banner, consent UX |
| Sub-processor documentation | Art. 9 | ⬜ To document | Azure, Mistral AI, Stripe, Resend |

#### GDPR Compliance (for EU Customers)

| Requirement | Status | Notes |
|---|---|---|
| Art. 28 DPA with customers | ⬜ To draft | Standard contractual clauses |
| Art. 30 Records of processing | ⬜ To create | Internal register |
| Art. 35 DPIA | ⬜ To complete | Same as FADP but GDPR-specific |
| Art. 37 DPO appointment | Not required (yet) | Required if monitoring at scale |
| EU representative (Art. 27) | ⬜ To appoint | If offering to EU from Switzerland |

---

## 20. Swiss Ecosystem & Support Programmes

### 20.1 Non-Dilutive Funding

| Programme | Amount | Type | Eligibility | Application |
|---|---|---|---|---|
| **Innosuisse** (Innovation agency) | CHF 100K–500K | Grant (50/50 co-funding) | Swiss-based, innovation-driven, academic partner | Rolling; partner with ETH or uni |
| **Venture Kick** | CHF 150K (3 stages) | Grant/award | Swiss startup, <1 year old | Quarterly jury presentations |
| **Swiss Startup Invest** | Access to investors | Matchmaking | Swiss startup with MVP | Application + pitch day |
| **digitalswitzerland** | Visibility, network | Ecosystem support | Swiss tech companies | Membership |
| **Gebert Rüf Stiftung** | CHF 50K–300K | Foundation grant | Innovation with societal impact | Application-based |
| **Hasler Stiftung** | CHF 50K–200K | Foundation grant | IT/CS innovation | Application-based |
| **Swiss Government innovation vouchers** | CHF 15K–50K | Voucher | SME innovation projects | Canton-specific |

### 20.2 Incubators & Accelerators

| Programme | Location | Duration | Equity | Benefits |
|---|---|---|---|---|
| **Kickstart Innovation** | Zurich | 11 weeks | 0% | Corporate partnerships, CHF 25K grant |
| **Venturelab / venture leaders** | National | Varies | 0% | Training, network, international bootcamps |
| **F10 FinTech Incubator** | Zurich | 6 months | 0–3% | FinServ partnerships (SIX, UBS, Julius Bär) |
| **Impact Hub Zurich** | Zurich | Varies | 0% | Coworking, community, events |
| **EPFL Innovation Park** | Lausanne | Ongoing | 0% | Deep tech ecosystem, academic connections |
| **ETH Entrepreneur Club** | Zurich | Varies | 0% | Student talent, events, hackathons |

### 20.3 Swiss Investor Landscape (Pre-Seed / Seed)

| Investor | Type | Typical Check (CHF) | Focus | Contact Path |
|---|---|---|---|---|
| **Wingman Ventures** | VC | 300K–1M | Swiss B2B SaaS, deep tech | Direct / intro |
| **VI Partners** | VC | 500K–2M | Swiss tech startups | Swiss Startup Invest |
| **b2venture (ex-btov)** | VC | 500K–3M | European B2B tech | Direct |
| **Business Angels Switzerland** | Angel network | 50K–250K (per angel) | Early-stage Swiss | Membership |
| **Swiss Startup Invest** | Angel platform | 50K–500K (syndicated) | Pre-seed to Series A | Pitch day |
| **Swisscom Ventures** | Corporate VC | 500K–2M | Swiss digital innovation | Intro via Swisscom partners |
| **SIX Fintech Ventures** | Corporate VC | 500K–2M | FinTech, RegTech | F10 programme |
| **Serpentine Ventures** | Family office | 200K–1M | European SaaS | Direct |
| **ZKB Pionier** | Bank | Startup banking package | Swiss startups | Application |

### 20.4 Tax Optimisation (Swiss Startup-Specific)

| Strategy | Detail | Savings |
|---|---|---|
| **Patent box** (STAF) | Reduced cantonal tax on IP income | Up to 90% reduction on patent/IP income |
| **R&D super-deduction** | 150% deduction for qualifying R&D costs | 50% extra deduction on R&D spend |
| **Startup valuation** (wealth tax) | IRS Kreisschreiben Nr. 28: startup shares valued at nominal value for first 3–5 years | Minimal founder wealth tax |
| **Cantonal tax competition** | Zurich effective corporate tax rate ~19.7% | Competitive vs. other cantons |
| **Holding company structure** | Founder holding GmbH + operating GmbH | Capital gains on share sale tax-free (Kapitalgewinnsteuer) for individuals |
| **Employee participation plan** | Tax-efficient ESOP structuring under KS Nr. 37 | Deferred taxation for employees |

---

## 21. Appendix

### A. Glossary

| Term | Definition |
|---|---|
| CLM | Contract Lifecycle Management |
| FADP | Swiss Federal Act on Data Protection (nDSG, effective Sept 2023) |
| GDPR | EU General Data Protection Regulation |
| RAG | Retrieval-Augmented Generation (AI architecture pattern) |
| ARR | Annual Recurring Revenue |
| MRR | Monthly Recurring Revenue |
| ACV | Annual Contract Value |
| CAC | Customer Acquisition Cost |
| LTV | Lifetime Value |
| NRR | Net Revenue Retention |
| SOW | Statement of Work |
| MSA | Master Service Agreement |
| DACH | Germany (D), Austria (A), Switzerland (CH) |

### B. Comparable Exits & Valuations

| Company | Last Valuation | Revenue Multiple | Notes |
|---|---|---|---|
| Icertis | USD 5.0B | ~40x ARR | Enterprise CLM leader |
| Ironclad | USD 3.2B | ~50x ARR | Growth-stage CLM |
| Juro | USD 150M | ~30x ARR | European CLM |
| SpotDraft | USD 100M | ~25x ARR | SMB CLM |

These comparables suggest that a well-positioned CLM company with ARR of CHF 5–10M could command a valuation of CHF 50–100M at Series A/B.

### C. Key Assumptions

1. Average sales cycle: 45–90 days (SME), 90–180 days (Enterprise)
2. Logo churn: < 10% annually
3. Revenue expansion (upsell): 15–20% annually per cohort
4. Infrastructure costs scale at ~15–20% of revenue
5. Fully loaded cost per engineer (Switzerland): CHF 150,000–180,000/year
6. Swiss MWST rate: 8.1% (standard rate, from Jan 2024)

---

*This document is confidential and intended for internal use and qualified investors only.*

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: February 2026*
