# ConTigo — Investor Presentation & Rocket Pitch Deck

**Purpose of this document:** slide-ready source material. Each section below maps 1:1 to a slide.
On-slide text is short and punchy; the *Speaker notes* carry the narrative.
Everything described is **live in the product demo today** — no roadmap items are presented as existing features.

**Date:** February 2026 · **Company:** ConTigo GmbH, Zurich, Switzerland · **Web:** contigo-app.ch

---
---

# PART 1 — INVESTOR PRESENTATION
*(Full deck — 18 slides, ~20 minutes)*

---

## Slide 1 — Title

# ConTigo
### AI-Powered Contract Intelligence — Swiss-Made

**Turning static contracts into decisions, and decisions into documents.**

- 100% Swiss / EU data residency
- Live product, demo-ready today
- Zurich, Switzerland

> **Speaker notes:** One sentence opener: "ConTigo reads your contracts, tells you what matters, flags what needs action, and helps you draft the next document — all under Swiss data protection. And it's not a concept: I can show it to you working right now."

---

## Slide 2 — The Problem

# Contract management is broken — and expensive

- **2–3 hours** to review one standard contract — **8–10+ hours** end-to-end with negotiation and approvals
- **71%** of companies cannot locate 10%+ of their own contracts *(industry research — WorldCC / Journal of Contract Management)*
- **~9%** of annual contract value leaks away on average — up to **15%** in complex or regulated sectors *(WorldCC)*
- Procurement overpays without rate benchmarks *(internal estimate: 10–25%)*
- Post-Schrems II: keeping sensitive legal data in US clouds is a **compliance liability** (FADP fines up to CHF 250K; GDPR up to 4% of turnover)

> **Speaker notes:** The problem is not storage — it's that critical business facts (dates, values, notice periods, obligations, rates) are trapped inside PDFs. Every missed renewal window or silent price increase is direct, measurable financial loss. And for European companies, the dominant CLM vendors are US-based, which creates a data-residency problem on top.

---

## Slide 3 — The Solution

# ConTigo: from PDF to decision to document

**One platform closes the full loop:**

```
UPLOAD  →  UNDERSTAND  →  DECIDE  →  ACT
contract    AI extracts the   renewals become   drafting creates the
arrives     facts that matter  an action queue   next document
```

- AI reads the contract (OCR + extraction) — not just file storage
- Facts become **actionable queues** — renewals, obligations, risks
- Drafting closes the loop — the next agreement starts from contract context

> **Speaker notes:** "Contigo is not a contract repository. It's an AI-native contract workspace. The demo shows one continuous story: a contract arrives, Contigo reads it, the facts drive a renewal decision, and the renewal decision produces a draft — reviewed and approved by a human. Understand, decide, act."

---

## Slide 4 — The Product Today (Live Demo)

# What you'll see in the demo — all working today

| Demo act | What happens |
|---|---|
| **1. Upload & Extraction** | PDF uploaded → OCR + AI pipeline → structured facts in ~1–2 minutes |
| **2. Contract Intelligence** | Decision snapshot: parties, value, dates, notice period, risks |
| **3. Renewals Queue** | Expiry & notice clauses become a prioritized, value-weighted work queue |
| **4. Governed Drafting** | Renewal amendment drafted from source context — human-reviewed |

**+ Grounded AI chat:** ask the contract questions in natural language, answers grounded in the actual document.

> **Speaker notes:** Emphasize credibility: "Nothing on this slide is a mockup. Upload a real contract during the meeting if you like." Demo safety line: AI accelerates review and drafting — humans approve. Contigo never claims to give legal advice.

---

## Slide 5 — Feature Deep-Dive: Upload & Extraction

# The contract stops being a PDF and becomes a business object

- **15+ formats:** PDF, DOCX, XLSX, TXT, HTML + scanned documents & images via OCR
- **30–120 seconds** processing per document, fully asynchronous pipeline
- Extracts: **parties, contract value, effective/end dates, notice periods, signature status, obligations, financial terms, risks**
- **50+ clause types** recognized (liability caps, termination, indemnification, confidentiality…)
- Structured artifacts per contract: **Financial, Renewal, Obligations, Timeline, Risk**
- Duplicate detection on upload; **uncertain fields flagged for review — never silently guessed**

> **Speaker notes:** The trust angle matters to legal buyers: when the AI is unsure, the system creates a review item instead of pretending certainty. That's the difference between AI as a toy and AI as infrastructure.

---

## Slide 6 — Feature Deep-Dive: Intelligence, Search & AI Chat

# Answers in seconds, grounded in your contracts

- **Decision snapshot** per contract: who, what it's worth, key dates, signature status, what needs attention
- **Risk scoring** with severity levels and explainable findings
- **Semantic search** across the whole portfolio — meaning, not just keywords — sub-second response (pgvector, 1536-dim embeddings)
- **AI chat grounded in the contract record** (RAG): *"What are the payment terms?" "When does this expire?" "What are the main renewal risks?"*
- Page-aware assistant with streaming answers and 18+ tools (contract search, clause lookup, obligation summaries, analytics)

> **Speaker notes:** Position the chatbot as supporting cast, not the main story: "It's not a generic assistant — it answers from your contract data, with evidence. The main storyline is the lifecycle loop."

---

## Slide 7 — Feature Deep-Dive: Renewals & Obligations

# Where contract intelligence becomes measurable money

- Expiry dates, notice windows, contract value and risk → **one prioritized renewal queue**
- **List, calendar and timeline views** of everything upcoming
- Renewal & obligation statuses: pending, in-progress, overdue, waived
- Proactive alerts before deadlines — **no more silent auto-renewals**
- Real demo proof point: **CHF 1.2M supplier renewal, notice overdue, flagged 24 days before expiry**

> **Speaker notes:** This is the ROI slide. One line lands it: "Missing one notice window or accepting one unnoticed price increase can cost more than the software costs for years. Renewals are where contract data turns into a P&L line you can see."

---

## Slide 8 — Feature Deep-Dive: Governed Drafting

# From analysis to action — without a blank page

- Renewal wizard & **Copilot editor**, seeded with the source contract's context
- **Templates, clause library, playbooks, variables** — drafting follows company policy
- **Drafting faithfulness:** user instructions survive generation (e.g. *"12-month term, cap price increase at 3%, preserve Swiss data residency, improve SLA credits"*)
- Human review, editing and approval built into the flow
- Output becomes a **managed contract** again — the loop closes

> **Speaker notes:** "The product doesn't stop at telling you a renewal is due. It helps you create the next document, governed by your templates and policies. AI drafts, humans approve — and the result re-enters the system as structured data. That's the loop no folder-based CLM can offer."

---

## Slide 9 — Platform Breadth (Enterprise-Ready)

# A complete platform around the core loop

- **Analytics & reporting:** portfolio dashboards, spend breakdown, forecasting, CSV export, scheduled reports
- **Rate card benchmarking:** ingest supplier rate cards, detect outliers, compare against baseline — *unique in the market*
- **Workflows & approvals:** configurable multi-step review chains with full audit trail
- **Collaboration:** comments, sharing, version history, custom metadata
- **Integrations:** Microsoft Word add-in, Google Drive, e-signatures, supplier portal, SCIM provisioning
- **API-first:** 80+ REST endpoints, signed webhooks (HMAC), service tokens

> **Speaker notes:** Keep this slide fast — it exists to answer "is it just a demo?" No: it's a multi-tenant, API-driven enterprise platform with the surrounding surface area (analytics, workflows, integrations) that enterprise buyers expect.

---

## Slide 10 — Architecture

# Modern, tenant-safe, event-driven

```
                         ┌────────────────────────────────────────┐
 Browser / Word Add-in   │              ConTigo Cloud             │
 ┌──────────────┐        │  ┌──────────────────────────────────┐  │
 │  Next.js UI  │───────▶│  │  Next.js App Router + REST API    │  │
 └──────────────┘  HTTPS │  │  Auth (SSO/SAML/MFA) · RBAC       │  │
        ▲  WebSocket      │  └───────┬───────────────┬─────────┘  │
        │  (live status)  │          │               │            │
        │                 │  ┌───────▼──────┐  ┌─────▼─────────┐  │
        └─────────────────│  │ BullMQ queue │─▶│ AI workers     │  │
                          │  │ (Redis)      │  │ OCR·extract·   │  │
                          │  └──────────────┘  │ analyze·embed  │  │
                          │                    └─────┬─────────┘  │
                          │  ┌───────────────┐ ┌─────▼──────┐     │
                          │  │ PostgreSQL 16 │ │ LLMs: Azure │     │
                          │  │ + pgvector    │ │ OpenAI (CH) │     │
                          │  │ (facts+vectors│ │ Mistral(EU) │     │
                          │  │  per tenant)  │ │ Claude      │     │
                          │  └───────────────┘ └────────────┘     │
                          │  ┌───────────────┐                    │
                          │  │ S3-compatible │ (documents)        │
                          │  │ object store  │                    │
                          │  └───────────────┘                    │
                          └────────────────────────────────────────┘
                              Azure Switzerland North region
```

- **Upload → queue → async AI pipeline → structured facts + embeddings → searchable, actionable record**
- **Strict multi-tenancy:** every record tenant-scoped; cross-tenant access impossible by design
- **Real-time UX:** processing status pushed over WebSocket; users never wait on a spinner

> **Speaker notes:** Deliberately boring, proven components — the innovation is in the data model and the pipeline, not in exotic infrastructure. Async workers mean AI latency never blocks the user; in production everything is queue-driven.

---

## Slide 11 — Tech Stack

# Proven, modern, capital-efficient

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript 5.7, Tailwind, Radix UI |
| **Backend** | Next.js API routes + Fastify, Prisma ORM (130+ models) |
| **Data** | PostgreSQL 16 + pgvector (semantic search), Redis 7 |
| **AI** | Azure OpenAI GPT-4o (Switzerland North), Mistral AI (EU), Anthropic Claude |
| **Pipeline** | BullMQ background workers, OCR (scanned docs), RAG embeddings |
| **Storage** | S3-compatible object storage (MinIO / Azure Blob) |
| **Real-time** | Socket.IO (live processing updates) |
| **Observability** | Sentry, OpenTelemetry, Prometheus, structured logging |
| **Delivery** | Turborepo monorepo (pnpm), Docker multi-stage, Azure Container Apps, Helm/K8s option |

**Why it matters to investors:** commodity, hireable stack; no exotic dependencies; infrastructure cost at pilot scale is **~CHF 200–310/month** — gross-margin friendly from day one.

> **Speaker notes:** Also mention multi-provider AI (Azure OpenAI CH + Mistral EU fallback) — no single-vendor lock-in on the AI layer, and EU/Swiss processing paths for regulated customers.

---

## Slide 12 — Security & Compliance

# Swiss-first is not a feature — it's the architecture

- **100% Swiss/EU data residency** — Azure Switzerland North; no US cloud dependency
- Encryption **AES-256 at rest, TLS 1.3 in transit**
- **SSO (Google, Microsoft, GitHub, SAML 2.0), TOTP MFA, IP allowlisting**
- Granular **RBAC** (resource + action permissions), enforced tenant isolation
- **Immutable, append-only audit logs** of every action
- GDPR data export & deletion built in; DPA (AVV), T&Cs (AGB), SLA documents ready — bilingual DE/EN
- Deployment flexibility: SaaS, self-hosted Docker, or Kubernetes — *a door-opener for the public sector*

> **Speaker notes:** "Every US competitor retrofits residency as an add-on. Contigo was designed around it — and we ship the legal paperwork (DPA, SLA, AGB) with the product. For Swiss enterprises and cantonal agencies, that's often the deciding factor."

---

## Slide 13 — Market Opportunity

# A multi-billion-dollar market with a sovereignty gap

| | |
|---|---|
| **TAM** | Global CLM software: **~USD 2–3B (2025) → USD 5–7B by 2032**, ~10–13% CAGR *(IMARC, Credence Research)* |
| **SAM** | Europe ≈ a quarter to a third of global spend → **~USD 1.5–2B by 2032** (DACH + Western EU) |
| **Beachhead** | Switzerland: **3,200+ enterprises** (250+ employees), ~48,000 DACH mid-market companies |

**Tailwinds:**
1. Post-Schrems II data localization — demand for EU/Swiss-sovereign SaaS
2. Revised Swiss FADP (in force since Sept 2023) — compliance urgency
3. AI adoption in legal is accelerating — Gartner expects GenAI to augment **30% of all knowledge-worker tasks by 2027**
4. CFO/CPO pressure for obligation & spend visibility
5. Swiss buyers pay a premium for quality, security and local support *(internal estimate: 20–40%)*

> **Speaker notes:** "The incumbents built for the US market and bolt residency on later. We're the only CLM built Swiss-first — and Switzerland is a dense, high-willingness-to-pay beachhead before DACH expansion."

---

## Slide 14 — Competition & Moats

# Positioned where incumbents can't follow easily

| | ConTigo | Ironclad / Icertis | Juro | DocuSign CLM |
|---|---|---|---|---|
| **Swiss-native residency** | ✅ architecture-first | ❌ US cloud | ❌ | ❌ |
| **Rate card benchmarking** | ✅ built-in | ❌ | ❌ | ❌ |
| **Intelligence-first UX** (upload→facts→action) | ✅ | ⚠️ process-first | ⚠️ | ⚠️ |
| **Price-performance** | **40–60% below** enterprise incumbents | high | mid | high |
| **CHF pricing, Swiss legal entity & support** | ✅ | ❌ | ❌ | ❌ |

**Defensibility:**
- **240,000+ lines of production TypeScript** — 18–24 months and ~CHF 1–2M to replicate
- Domain-tuned extraction & RAG pipeline (prompt library = trade secret)
- Rate-card extraction engine — no competitor ships it natively
- Per-tenant tuning compounds with every customer

> **Speaker notes:** Honest framing: "US incumbents have bigger teams. They cannot easily become Swiss-native, cannot easily reprice 40–60% down, and don't have rate benchmarking. Speed of execution is our defense — which is exactly what this round funds."

---

## Slide 15 — Business Model & Unit Economics

# Subscription SaaS with services attach

| Plan | CHF/month | Includes |
|---|---|---|
| **Starter** | 490 | 500 contracts, 3 users, core AI, Swiss storage |
| **Professional** | 1,490 | 5,000 contracts, 10 users, benchmarking, API, priority support |
| **Enterprise** | custom | unlimited, SSO/LDAP, white-label, 99.9% SLA, self-host option |

Annual billing: 2 months free. Secondary revenue: implementation (CHF 2–15K), custom integrations (CHF 5–25K), training.

**Target unit economics (Year 2):**

| ACV | CAC | LTV:CAC | Gross margin | NRR | Payback |
|---|---|---|---|---|---|
| CHF 25K | CHF 8K | **>5:1** | 80–85% | >110% | <6 months |

> **Speaker notes:** "Lean infrastructure (~CHF 200/month at pilot scale) means the margin structure works from the first customer. The model is classic high-retention B2B SaaS: land with legal/procurement, expand across departments."

---

## Slide 16 — Traction: Where We Are Today

# A working product, not a promise

- ✅ **MVP live** — full demo loop (upload → extraction → renewals → drafting) running today
- ✅ **240K+ lines** of production TypeScript; 130+ data models, 60+ app pages, 80+ API endpoints
- ✅ **95%+ extraction accuracy**; contract review **70–95% faster** than manual
- ✅ Enterprise surface already built: RBAC, SSO, MFA, audit logs, workflows, Word add-in, webhooks
- ✅ Full commercial & legal package ready: pricing, DPA/AVV, SLA, T&Cs (DE/EN), onboarding playbook
- 🔄 Onboarding **first pilot customers** now

> **Speaker notes:** "The engineering risk is largely retired — what remains is go-to-market execution. That's what this round is for."

---

## Slide 17 — Financial Plan & The Ask

# Pre-seed: CHF 250–400K to convert product into pipeline

**Base-case ARR trajectory:**

| Year | Customers | ARR |
|---|---|---|
| Y1 | 20 | CHF 440K |
| Y2 | 80 | CHF 2.16M |
| Y3 | 200 | CHF 6.4M |
| Y5 | 700 | CHF 26.6M |

Break-even **month 18–22** (~CHF 45K MRR ≈ 30 Professional customers).

**The ask: CHF 250–400K pre-seed** → 15–18 months runway

| Use of proceeds | Share |
|---|---|
| Engineering (extraction quality, DACH readiness) | 35% |
| Sales & business development (founder-led + first sales hire) | 30% |
| Marketing (content, events, SEO) | 15% |
| Operations, legal, certifications | 20% |

**Milestones this funds:** 15–25 paying customers, 3–5 public case studies, SOC 2 preparation started, Seed round (CHF 800K–1.5M) Q1 2027.

> **Speaker notes:** "Capital-efficient by design: the product exists, infra is cheap, so nearly every franc goes to revenue-generating activity. Next round is sized by traction, not by burn."

---

## Slide 18 — Why Invest / Why Now

# The sovereign-CLM window is open — briefly

**Why now**
- FADP enforcement + Schrems II uncertainty = active buying trigger in Switzerland & EU
- AI in legal is crossing from experiment to budget line (Gartner: GenAI to augment 30% of knowledge work by 2027)
- Incumbents are structurally slow to become Swiss-native or to reprice

**Why ConTigo**
- **Only Swiss-first CLM** — residency, legal entity, pricing, support all local
- **Product done, demo live** — capital goes to growth, not to building v1
- **Unique wedge:** rate card benchmarking + renewals value capture = concrete, sellable ROI
- **Capital efficient:** CHF ~200/month pilot infra; gross margin 80%+ from the start

### Vision: *the default contract intelligence platform for privacy-conscious European enterprises.*

**Contact:** founders@contigo-app.ch · contigo-app.ch · Zurich, Switzerland

> **Speaker notes:** Close on the loop: "Understand, decide, act. Contigo turns contracts into decisions — and we'd like to turn this round into the company that owns sovereign contract intelligence in Europe."

---
---

# PART 2 — ROCKET PITCH DECK
*(Short deck — 8 slides, ~3 minutes / elevator format)*

---

## R1 — Title

# ConTigo
### Your contracts, read. Your renewals, caught. Your next draft, started.

AI-powered contract intelligence — 100% Swiss data residency. **Live product, demo in 12 minutes.**

---

## R2 — The Pain

# Companies lose real money inside their own PDFs

- **71%** of companies can't find 10% of their contracts *(industry research)*
- **~9%** of annual contract value leaks away on average — up to **15%** in complex sectors *(WorldCC)*
- **2–3 hours** to review one standard contract — a full workday end-to-end
- And EU/Swiss legal data sits in **US clouds** — a compliance risk post-Schrems II

> One missed renewal window can cost more than years of software. Everyone has the problem; almost nobody can see it.

---

## R3 — The Solution

# Upload → Understand → Decide → Act

**ConTigo turns contracts into structured intelligence, and intelligence into action:**

1. **Upload** any contract (PDF, scans — OCR included)
2. **AI extracts** parties, values, dates, notice periods, risks, obligations — in ~1–2 minutes
3. **Renewals queue** turns those facts into prioritized, value-weighted action
4. **Governed drafting** creates the next document from that context — human-approved

*Not a repository. A loop.*

---

## R4 — Proof (Demo in 4 Screens)

# See it working, not slideware

| Screen | You see |
|---|---|
| **Contract overview** | Decision snapshot: parties, CHF value, dates, signature status, risks |
| **Renewals** | CHF 1.2M supplier renewal, notice overdue, 24 days to expiry — flagged |
| **Drafting copilot** | Renewal amendment generated with your constraints (e.g. 3% price cap) |
| **AI chat** | *"What are the payment terms?"* — answered from the contract itself |

---

## R5 — Why We Win

# Three advantages competitors can't copy quickly

1. 🇨🇭 **Swiss-first architecture** — Azure Switzerland North, no US dependency, DPA/SLA ready; incumbents bolt this on, we were built on it
2. 💰 **Renewals + rate card benchmarking** — unique, quantifiable ROI no competitor ships natively
3. ⚡ **Product done** — 240K+ lines of production code, enterprise security (SSO, MFA, RBAC, audit logs) already built; capital goes to sales, not R&D

*40–60% cheaper than enterprise incumbents. Priced in CHF. Supported from Zurich.*

---

## R6 — Market

# CH-sized beachhead, EU-scale market

- Global CLM: **~$2–3B today → $5–7B by 2032** (~10–13% CAGR — IMARC, Credence Research)
- Europe SAM: **~$1.5–2B** — with a sovereignty gap no US vendor fills
- Beachhead: **3,200+ Swiss enterprises**, 48,000 DACH mid-market
- Tailwinds: FADP enforcement, post-Schrems II localization, rapid legal-AI adoption (Gartner: GenAI to augment 30% of knowledge work by 2027)

---

## R7 — Business Model

# High-margin SaaS, fast payback

- **CHF 490 / 1,490 / custom** per month (Starter / Professional / Enterprise)
- Targets: ACV CHF 25K · LTV:CAC **>5:1** · gross margin **80–85%** · payback **<6 months**
- Lean ops: pilot infrastructure ≈ **CHF 200/month**
- Base case: CHF 440K ARR (Y1) → **CHF 6.4M (Y3)**; break-even month 18–22

---

## R8 — The Ask

# CHF 250–400K pre-seed → 15–25 paying customers

| Funds | Outcome |
|---|---|
| Engineering 35% · Sales 30% · Marketing 15% · Ops 20% | 15–25 customers, 3–5 case studies, SOC 2 prep |
| **15–18 months runway** | Seed round (CHF 800K–1.5M) Q1 2027 |

### ConTigo — *Understand. Decide. Act.*

**Let's show you the product.** founders@contigo-app.ch · contigo-app.ch

---
---

# APPENDIX — Notes for Slide Production

**Suggested visual language**
- Colors: Swiss red accent + deep navy/charcoal; clean, Swiss-grid layouts (think "precision")
- One idea per slide; the tables above are maximum density — split if needed
- Demo screenshots to capture: contract overview (decision snapshot), renewals list with the CHF 1.2M card, drafting copilot with the amendment prompt, chatbot answer with citation

**Numbers sourcing — verified February 2026**

*Verified against public sources (safe to present):*
- **71% of companies can't locate 10%+ of their contracts** — widely cited; attributed variously to WorldCC and the Journal of Contract Management, hence the soft "industry research" attribution (e.g. [Mercell/WorldCC](https://info.mercell.com/en/blog/when-contract-chaos-undermines-public-trust-and-how-to-reclaim-control/), [Malbek/JCM](https://www.malbek.io/blog/contract-management-challenges))
- **~9% average contract value leakage, up to 15% in complex/regulated sectors** — [WorldCC 2025 report](https://www.eqs-news.com/news/corporate/new-worldcc-report-reveals-businesses-lose-up-to-15-in-value-due-to-inefficient-contract-management/16d46584-7af5-4f08-8d32-fcf35be542b4_en) (8.6% avg, 15% worst case); consistent with the older WorldCC 9.2% figure and the 2026 WorldCC/Ironclad finding of 11% average post-signature value loss
- **CLM market ~$2–3B (2025) → $5–7B by 2032, ~10–13% CAGR** — [IMARC](https://www.imarcgroup.com/contract-lifecycle-management-software-market) ($2.1B 2023 → $5.2B 2032, 10.1% CAGR), [Credence Research](https://www.credenceresearch.com/report/contract-management-software-market) ($2.9B 2024 → $7.3B 2032), [Zion](https://www.zionmarketresearch.com/report/contract-lifecycle-management-market) ($1.2B 2023 → $3.4B 2032). Estimates vary by scope — the deck uses a conservative range
- **Gartner: GenAI to augment 30% of knowledge-worker tasks by 2027** — [Gartner via IDM](https://idm.net.au/article/0015050-generative-ai-set-transform-business-operations-2027-gartner-reports)
- **Contract review time 2–3h standard / 8–10h end-to-end** — [DocJuris](https://www.docjuris.com/post/contract-review-process-taking-weeks)
- Legal facts confirmed: FADP fines up to CHF 250K (individuals), GDPR up to 4% of global turnover, revised FADP in force 1 Sept 2023, Schrems II ruling July 2020, Switzerland #1 on the WIPO Global Innovation Index

*Corrected during verification (do not revert to these):*
- ~~"$2.9B → $11.2B by 2032, 21% CAGR"~~ — from the internal business plan; not corroborated by any public market research found
- ~~"Gartner: 67% of legal departments plan AI adoption by 2027"~~ — could not be verified; replaced with the sourced Gartner knowledge-work prediction
- ~~"15–25% of contract value lost"~~ — overstated vs. the WorldCC evidence (8.6–9.2% avg, 15% worst case)
- ~~"8–12 hours manual review per contract"~~ — high end; public sources support 2–3h standard, 8–10h end-to-end

*Internal company figures (present as "our estimates/targets", not as market facts):*
- Procurement overpayment (10–25%), Swiss price premium (20–40%), 3,200+ Swiss enterprises (BFS-based)
- Product metrics: 95%+ extraction accuracy, 70–95% review speedup, 30–120s processing — from internal testing; be ready to show the demo or audit scripts as proof
- ARR trajectory, unit economics, break-even — company projections from `docs/planning/BUSINESS_PLAN.md`

**Product claims** (formats, 50+ clause types, security features) reflect `docs/features/PLATFORM_CAPABILITIES.md`.
**Demo disclaimers** (from the demo playbook): AI accelerates review/drafting, humans approve; never claim legal advice.

**Deliberately excluded** (per current messaging): unreleased R&D initiatives and roadmap-stage capabilities. Add them back (as a clearly-labeled roadmap slide) when ready.
