# ConTigo — End-to-End Architecture

**How the data lakehouse, RAG, agents, and services work as one system**

Version 1.0 · August 2026

---

## Table of Contents

1. [What This Document Covers](#1-what-this-document-covers)
2. [Platform at a Glance](#2-platform-at-a-glance)
3. [Monorepo & Package Map](#3-monorepo--package-map)
4. [The Data Lakehouse (How “Data Lake” Works Here)](#4-the-data-lakehouse-how-data-lake-works-here)
5. [Ingestion & Processing Pipeline](#5-ingestion--processing-pipeline)
6. [RAG System (Search & Retrieval)](#6-rag-system-search--retrieval)
7. [Agent System](#7-agent-system)
8. [How Everything Works Seamlessly Together](#8-how-everything-works-seamlessly-together)
9. [Event Bus, Queues & Real-Time Glue](#9-event-bus-queues--real-time-glue)
10. [Multi-Tenancy, Security & Isolation](#10-multi-tenancy-security--isolation)
11. [Key Runtime Paths (Examples)](#11-key-runtime-paths-examples)
12. [Observability & Resilience](#12-observability--resilience)
13. [Where to Look in the Code](#13-where-to-look-in-the-code)
14. [Related Documents](#14-related-documents)

---

## 1. What This Document Covers

ConTigo is an AI-powered Contract Lifecycle Management (CLM) platform. Users upload contracts; the platform extracts text, builds structured intelligence (artifacts, metadata, obligations), indexes everything for semantic search (RAG), and exposes that intelligence to multi-agent chat and autonomous workers.

There is no separate product named “Data Lake.” Instead, the platform implements a **practical data lakehouse** across three stores and progressive refinement stages:

| Concern | Where it lives |
|--------|----------------|
| **Raw documents** | MinIO / Azure Blob (object storage) |
| **Structured operational data** | PostgreSQL 16 + Prisma |
| **Semantic / vector intelligence** | pgvector (`ContractEmbedding`) |
| **Cache, queues, real-time** | Redis 7 + BullMQ |
| **Business orchestration** | `packages/data-orchestration` |
| **Background processing** | `packages/workers` |
| **Agents & reasoning** | `packages/agents` + `apps/web/lib/ai/*` |

This document explains how those layers connect so upload → OCR → artifacts → RAG → agents feel like one continuous system.

---

## 2. Platform at a Glance

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                          │
│   Browser (Next.js)  ·  Word Add-in  ·  Public/Service API               │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS / WebSocket
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION + API LAYER                              │
│   Next.js 15 App Router · RSC · API routes · NextAuth · Socket.IO        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Service layer    │  │ Agents           │  │ Workers          │
│ data-orchestration│  │ @mention chat   │  │ BullMQ pipeline  │
│ contracts, RAG   │  │ ReAct, tools     │  │ OCR→artifacts→   │
│ analytics, lineage│  │ autonomous goals│  │ metadata→RAG     │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         DATA PLANE                                       │
│  PostgreSQL + pgvector  ·  Redis  ·  MinIO/Blob  ·  Azure OpenAI / LLM   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Design principles

| Principle | How it shows up |
|-----------|-----------------|
| **AI-first** | Every contract is OCR’d, artifacted, embedded, and queryable by agents |
| **Async by default** | Heavy work runs on BullMQ workers; UI gets progress via Redis events / WS |
| **Tenant isolation** | `tenantId` on domain tables, RAG filters, and agent tools |
| **Graceful degradation** | Full AI → hybrid search + DB → DB-only templates if LLMs are unavailable |
| **Swiss / EU residency** | Azure Switzerland-ready; Azure OpenAI preferred over US endpoints |

---

## 3. Monorepo & Package Map

```
contigo/
├── apps/
│   ├── web/                 # Next.js UI + API routes + agent chat + RAG query path
│   └── word-addin/          # Office add-in surface
├── packages/
│   ├── agents/              # Orchestrator, ReAct agent, tool registry, autonomous goals
│   ├── clients/
│   │   ├── db/              # Prisma schema, repositories, migrations
│   │   ├── openai/          # LLM client wrappers
│   │   └── rag/             # Low-level chunk / embed / retrieve helpers
│   ├── data-orchestration/  # Core services: contracts, artifacts, RAG reindex, analytics
│   ├── schemas/             # Shared Zod contracts
│   ├── utils/               # Queues, events, storage, semantic chunkers, tracing
│   └── workers/             # BullMQ processors (OCR, artifacts, RAG, agents, schedules)
```

| Package | Role in the seamless path |
|---------|---------------------------|
| **`apps/web`** | User entry (upload, chat, dashboards); hybrid search; agent API |
| **`data-orchestration`** | Single business logic hub; reindex hooks; event bus; lineage |
| **`workers`** | Pipeline stages that turn files into searchable intelligence |
| **`agents`** | Multi-step reasoning over tools that read DB + RAG |
| **`clients/db`** | Source of truth schema (`Contract`, `Artifact`, `ContractEmbedding`, …) |
| **`clients/rag` + `utils/rag`** | Chunking/embedding primitives shared by workers and web |
| **`utils` queues/events** | Job names, Redis event bus, progress publishing |

---

## 4. The Data Lakehouse (How “Data Lake” Works Here)

Think of the platform as a **medallion-style lakehouse** built into the CLM product—not a separate Hadoop/Spark lake.

### 4.1 Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  BRONZE — Raw / landing                                         │
│  • PDF/DOCX/images in MinIO or Azure Blob                       │
│  • checksum, mimeType, storagePath on Contract                  │
│  • OCR rawText + DI paragraph hints in Contract / aiMetadata    │
└────────────────────────────┬────────────────────────────────────┘
                             │ OCR + extraction workers
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  SILVER — Structured / curated                                  │
│  • Contract metadata, taxonomy, parties, clauses                │
│  • Artifacts (overview, risk, financial, obligations, …)        │
│  • Rate cards, obligations, renewals, workflows                 │
│  • Provenance via data lineage + audit logs                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ RAG indexing + analytical services
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  GOLD — Intelligence / serving                                  │
│  • ContractEmbedding (pgvector chunks + artifact-type chunks)   │
│  • Hybrid search index (vector + BM25/tsvector + rerank)        │
│  • Knowledge graph entities/relationships                       │
│  • Benchmarks, analytics, agent tool surfaces                   │
│  • Semantic cache for repeated queries                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Store responsibilities

| Store | Bronze | Silver | Gold |
|-------|--------|--------|------|
| **Object storage** | Original files | Versioned artifacts (optional) | — |
| **PostgreSQL** | Job/status fields | Contracts, artifacts, clauses, users | Analytics tables, lineage, audit |
| **pgvector** | — | — | Embeddings for RAG |
| **Redis** | Job queue payloads | Cache of silver reads | Semantic cache, rate limits, progress |
| **Neo4j (optional)** | — | — | Graph relationships when configured |

### 4.3 Data orchestration package

`packages/data-orchestration` is the **control plane for silver/gold data**:

- **Services** — contracts, artifacts, RAG reindex, taxonomy, analytics, rate cards, workflows
- **DAL adapters** — database + cache
- **Event bus** — `contract:created`, `artifact:generated`, `processing:completed`, etc.
- **Data lineage** — tracks contract → artifact → rate card → benchmark derivations
- **Providers** — pluggable data-source factory for integrations

Consumers (web API, workers, agents) should go through services rather than ad-hoc SQL so cache invalidation, events, and lineage stay consistent.

### 4.4 Core silver entities (simplified)

```
Tenant
 └── Contract
      ├── storagePath / rawText / taxonomy fields
      ├── Artifact[]          (typed intelligence blobs)
      ├── ContractEmbedding[] (RAG chunks)
      ├── Clause[]
      ├── Obligation[]
      ├── ContractMetadata
      └── ProcessingJob steps
```

Artifacts are the main **curated intelligence** unit. Each type (overview, clauses, financial, risk, compliance, obligations, renewal, …) is JSON in `Artifact.data`, versioned and editable, then **re-projected into RAG** as dedicated embedding chunks.

---

## 5. Ingestion & Processing Pipeline

Upload is never “store and forget.” It kicks a **chained worker pipeline** that fills bronze → silver → gold.

### 5.1 End-to-end flow

```
User uploads PDF
       │
       ▼
 POST /api/contracts/upload
       │
       ├─► Persist file → MinIO/Blob (bronze)
       ├─► Create Contract row (status=PROCESSING)
       └─► Enqueue CONTRACT_PROCESSING (BullMQ)
                 │
                 ▼
        ┌────────────────────┐
        │ OCR Artifact Worker│  Azure DI / Mistral / OpenAI OCR
        │                    │  deskew, hybrid LLM cleanup
        └─────────┬──────────┘
                  │ writes rawText, signature evidence
                  │ plan steps via workflow/planner
                  ▼
        ┌────────────────────┐
        │ Metadata Extraction│  parties, dates, TCV, fields
        └─────────┬──────────┘
                  ▼
        ┌────────────────────┐
        │ Categorization     │  taxonomy / contract type
        └─────────┬──────────┘
                  ▼
        ┌────────────────────┐
        │ Artifact Generator │  multi-type AI artifacts
        └─────────┬──────────┘
                  │
                  ├─► Event: ARTIFACT_GENERATED
                  └─► Enqueue RAG_INDEXING
                            │
                            ▼
                   ┌────────────────────┐
                   │ RAG Indexing Worker│  chunk → embed → ContractEmbedding
                   │ + reindex artifacts│  per-type metadata chunks
                   └─────────┬──────────┘
                             │
                             ▼
                   Contract READY for search, chat, agents
```

### 5.2 Queues

Defined in `packages/utils/src/queue/contract-queue.ts`:

| Queue | Purpose |
|-------|---------|
| `contract-processing` | OCR + initial pipeline |
| `artifact-generation` | AI artifact generation |
| `metadata-extraction` | Structured field extraction |
| `contract-categorization` | Taxonomy / type detection |
| `rag-indexing` | Semantic + metadata embeddings |
| `embedding-refresh` | Stale embedding re-index |
| `agent-orchestration` | Background agent runs |
| `webhook-delivery` | Outbound webhooks |
| `rate-card-import` / `benchmark-calculation` | Rate intelligence |

Each queue has a **DLQ** counterpart for poison jobs. Priorities range from `URGENT` (1) to `BACKGROUND` (50).

### 5.3 Processing plan

`workers/src/workflow/planner.ts` decides steps (e.g. skip RAG if text is too short or `AUTO_RAG_INDEXING=false`). Progress is written to processing-job steps and published on Redis so the UI can stream status.

### 5.4 Workers registered at startup

From `packages/workers/src/index.ts`:

- OCR artifact, artifact generator, RAG indexing
- Metadata extraction, categorization
- Renewal alerts, obligation tracker
- Agent orchestrator, autonomous scheduler, goal execution
- Embedding refresh, forecast refresh
- Contract source sync, cleanup, outbox poller
- Health server + metrics + dead-letter management

---

## 6. RAG System (Search & Retrieval)

RAG is the **gold-layer serving path** that turns lakehouse data into context for LLMs and agents.

### 6.1 Index-time (write path)

**A. Document chunks (from OCR text)**

`rag-indexing-worker`:

1. Load `Contract.rawText` (+ optional Azure DI paragraph structure)
2. **Chunk** via:
   - `semanticChunk` (structure-aware, default), or
   - `adaptiveChunk` (embedding-similarity breakpoints)
3. Optional **contextual retrieval**: prepend 1–2 sentence context per chunk (Anthropic-style)
4. Optional **RAPTOR**-style hierarchical summaries (`utils/rag/raptor-summarizer`)
5. **Embed** with `text-embedding-3-small` (Azure OpenAI preferred; dims via `RAG_EMBED_DIMENSIONS`, often 1024)
6. Upsert into `ContractEmbedding` with `chunkType`, `section`, `tenantId`, `contractType`

**B. Artifact / taxonomy chunks (intelligence projection)**

`RagIntegrationService.reindexContract()`:

- Each artifact type gets a **fixed high chunkIndex** (e.g. overview=9901, risk=9904, …)
- Taxonomy + rich metadata get chunk **9950**
- Text is labeled `[ARTIFACT: FINANCIAL]` etc. for keyword/BM25
- Updates after artifact edits keep the chat index fresh

This dual indexing is why agents can answer both “what does section 4 say?” (body chunks) and “what’s our portfolio risk?” (artifact intelligence chunks).

### 6.2 Query-time (read path)

Primary implementation: `apps/web/lib/rag/advanced-rag.service.ts` (`hybridSearch`).

```
User query
    │
    ├─► Intent router → semantic | keyword | hybrid
    ├─► Chunk-type detection (clause / table / risk → filters)
    ├─► Query expansion / HyDE / step-back / decompose (flags)
    │
    ▼
 Parallel retrieval
    ├─ Semantic: pgvector cosine (tenant-filtered)
    └─ Keyword: full-text / trigram (BM25-style)
    │
    ▼
 Reciprocal Rank Fusion (RRF)
    │
    ▼
 Optional cross-encoder / progressive rerank
    │
    ▼
 Graph expansion (chunk relationship graph)
    │
    ▼
 Self-corrective RAG (CRAG) if confidence low
    │
    ▼
 Parent-document expansion (small chunk → larger parent context)
    │
    ▼
 Semantic cache (similar query reuse)
    │
    ▼
 Ranked SearchResult[] → LLM / agent tools
```

### 6.3 RAG features at a glance

| Feature | Role |
|---------|------|
| Hybrid + RRF | Best of meaning + exact terms |
| Intent routing | Skip expensive vector path when ID/date lookup is enough |
| Metadata filters | Tenant, type, status, suppliers, chunk types |
| Contextual chunks | Better standalone retrieval accuracy |
| Parent retrieval | Precise match + broad context for generation |
| Chunk graph | Co-retrieve related legal concepts |
| Semantic cache | Lower latency/cost for repeated questions |
| CRAG | Reformulate when retrieval is weak |
| Graceful fallback | Text-only / keyword if embeddings fail |

### 6.4 Client package vs advanced service

| Component | Use |
|-----------|-----|
| `packages/clients/rag` | Simple chunk/embed/retrieve for workers/scripts |
| `apps/web/lib/rag/advanced-rag.service` | Production hybrid search for chat, copilot, agents |
| `packages/utils/src/rag/*` | Shared chunkers (semantic, adaptive, RAPTOR) |
| `data-orchestration` `rag-integration.service` | Reindex after artifact/metadata changes |

---

## 7. Agent System

Agents are **consumers of the gold layer** (and silver DB), not a separate data store. They never invent contracts; they call tools that read RAG + Prisma.

### 7.1 Surfaces

| Surface | Entry | Behavior |
|---------|-------|----------|
| **@mention chat** | `POST /api/agents/chat` | Route to Sage, Merchant, Vigil, Warden, … |
| **Agentic chat tools** | `lib/ai/agentic-chat.service.ts` | OpenAI function-calling loop (≤5 iters) |
| **ReAct agent** | `packages/agents` + `agent-integration.ts` | Think → Act → Observe → Reflect |
| **Autonomous orchestrator** | `autonomous-orchestrator.ts` + workers | Goals, triggers, HITL, learning |
| **Background agents** | `workers/src/agents/*` | Risk, validation, RFx, search, deadlines, … |

### 7.2 Intelligence gate

Before heavy reasoning:

1. Score query complexity (analysis words, multi-step, length, conjunctions)
2. **Score ≥ 3** → full agentic tool loop (GPT-4o-class)
3. **Score < 3** → specialized agent handler (DB + light AI enhancement)

### 7.3 Agent roster (product-facing)

| Agent | Specialty |
|-------|-----------|
| **Sage** | Default Q&A / search / analysis (full tools) |
| **Merchant** | RFx procurement lifecycle |
| **Vigil / Warden / Sentinel** | Compliance, risk, validation |
| **Clockwork / Orchestrator** | Deadlines & workflows |
| **Scout / Prospector / Synthesizer** | Opportunities, savings, portfolio analytics |
| **Conductor / Builder / Memorykeeper** | Clauses, templates, history |
| **Architect / Navigator** | Workflow design & onboarding |

### 7.4 Tools (how agents touch the lakehouse)

Agentic tools (representative):

| Tool | Data source |
|------|-------------|
| `search_contracts` | **RAG** `hybridSearch` over gold embeddings |
| `get_contract_details` | **Silver** Prisma: contract + artifacts + versions |
| `list_expiring_contracts` | Silver dates / values |
| `get_spend_analysis` | Silver financial fields + analytics |
| `get_risk_assessment` | Artifacts + portfolio heuristics |
| `compare_contracts` | Details + optional RAG context |
| `get_supplier_info` | Aggregated silver |
| `extract_clause` | RAG snippets + clause tables |

### 7.5 AI enhancement pattern

Structured agents (Vigil, Warden, Clockwork, …):

1. Fast **DB query** (reliable, tenant-scoped)
2. Pass rows to **enhanceWithAI()**
3. GPT returns narrative insights
4. Fallback to template markdown if LLM fails

### 7.6 Autonomous layer

- Goal decomposition and multi-agent coordination
- Proactive triggers (renewals, obligations, health)
- Learning records / A/B winners for model selection
- Human-in-the-loop escalation queues
- Worker: `agent-orchestrator-worker`, `goal-execution-worker`, `autonomous-scheduler`

---

## 8. How Everything Works Seamlessly Together

Seamless UX is the result of **one pipeline + shared IDs + events + tools**, not a single mega-service.

### 8.1 Shared contract identity

Every stage uses the same `contractId` + `tenantId`:

```
Upload → Contract.id
   → OCR writes Contract.rawText
   → Artifacts.contractId
   → ContractEmbedding.contractId
   → Agent tools filter by tenantId / contractId
   → WebSocket progress keyed by contractId
```

No ETL batch is required for chat to “see” a document: as soon as RAG indexing finishes (and even partially after OCR), search and agents can use it.

### 8.2 Write-path coupling (pipeline)

```
OCR complete
  → metadata + categorization
  → artifacts generated
       → event ARTIFACT_GENERATED
       → queue RAG_INDEXING
            → body chunks + artifact chunks
            → embeddings ready
```

Artifact **edits** in the UI call reindex (`RagIntegrationService.reindexContract`) so gold stays consistent with silver without full re-OCR.

### 8.3 Read-path coupling (agents + RAG + DB)

```
User: "@sage Compare top IT vendors by spend and risk"
         │
         ▼
 Intelligence Gate → Agentic loop
         │
         ├─ get_spend_analysis     → Prisma aggregates (silver)
         ├─ get_risk_assessment    → artifacts / scores (silver→gold)
         └─ search_contracts       → hybridSearch (gold vectors)
         │
         ▼
 GPT synthesizes one answer with sources
```

### 8.4 Closed loop: humans improve the lake

```
User edits artifact field
  → silver Artifact updated
  → lineage / audit recorded
  → reindex artifact chunk in ContractEmbedding
  → next agent answer uses corrected intelligence
```

### 8.5 Continuous maintenance of gold

| Job | Why seamless stays true |
|-----|-------------------------|
| Embedding refresh scheduler | Re-embeds stale or model-changed content |
| Obligation / renewal workers | Keep operational silver current for agents |
| Forecast refresh | Analytical gold for predictive agents |
| Outbox poller | Reliable event delivery after commits |
| Cleanup worker | Orphaned temp chunks don’t pollute storage |

### 8.6 Mental model (one sentence)

> **Object storage holds the file; PostgreSQL holds the truth; pgvector holds the meaning; Redis coordinates work; agents only talk through tools that read that truth under tenant isolation.**

---

## 9. Event Bus, Queues & Real-Time Glue

### 9.1 In-process event bus

`data-orchestration` `Events` enum drives lineage and cache invalidation:

- Contract lifecycle: `contract:created|updated|deleted|metadata:updated`
- Artifacts: `artifact:generated|validated|field:updated`
- Processing: `processing:started|completed|failed`
- Benchmarks / market: `benchmark:calculated`, `market:shift:detected`

### 9.2 Redis event bus

Cross-process progress (workers → web):

- `publishJobProgress(jobId, contractId, tenantId, percent, stage, message)`
- UI / Socket.IO subscribe for live processing bars

### 9.3 Transactional outbox

`outbox-poller-worker` relays committed domain events so downstream systems don’t miss messages if the primary process dies mid-emit.

---

## 10. Multi-Tenancy, Security & Isolation

| Layer | Mechanism |
|-------|-----------|
| API | Session → inject `tenantId` (never trust client body) |
| Prisma / queries | `tenantId` on domain models + composite indexes |
| RAG | Filters on `ContractEmbedding.tenantId` / contract ownership |
| Agents | Tools receive tenant context from the authenticated session |
| Storage | Paths keyed by tenant; object ACLs as configured |
| Auth | NextAuth v5, MFA, CSRF, RBAC |

Embeddings and hybrid search are always **tenant-scoped** so semantic neighbors never leak across organizations.

---

## 11. Key Runtime Paths (Examples)

### 11.1 “Upload a contract and ask about liability”

1. Upload → bronze file + `Contract` row  
2. OCR worker → `rawText`  
3. Artifacts → risk / clauses JSON in silver  
4. RAG worker → clause chunks + `[ARTIFACT: RISK]` embedding  
5. User: “What’s the liability cap?”  
6. Intent → semantic/hybrid → top chunks  
7. Chat / Sage tools assemble answer with citations  

### 11.2 “@warden show high-risk renewals”

1. Intelligence gate may use handler or agentic path  
2. DB query: expiring contracts + risk artifacts  
3. Optional RAG for clause evidence  
4. AI enhancement narrates prioritization  
5. Response lists actions for Clockwork-style follow-up  

### 11.3 “Edit financial artifact after bad extraction”

1. UI patches `Artifact.data`  
2. Validation + version bump  
3. Event + `reindexContract`  
4. Gold chunk 9903 updated  
5. Spend tools and chat immediately reflect correction  

---

## 12. Observability & Resilience

| Concern | Implementation |
|---------|----------------|
| Logging | Pino structured logs (workers, services) |
| Tracing | OpenTelemetry spans on workers; `traceId` on jobs |
| Metrics | Worker metrics collector + Prometheus rules |
| Health | Worker health server (`HEALTH_PORT`, default 9090) |
| Retries | BullMQ attempts + adaptive retry / circuit breakers |
| DLQ | Per-queue dead-letter queues |
| Backpressure | High/low water marks on queue depth |
| AI cost | Usage logging on OCR/RAG/agent token spend |
| Degradation | No API key → DB templates; embed fail → BM25 text index |

---

## 13. Where to Look in the Code

| Topic | Path |
|-------|------|
| System layers / ADRs | `docs/architecture/ARCHITECTURE.md` |
| Agentic product design | `docs/AGENTIC_SYSTEM.md` |
| Prisma models | `packages/clients/db/schema.prisma` |
| Queue names & job types | `packages/utils/src/queue/contract-queue.ts` |
| OCR + pipeline | `packages/workers/src/ocr-artifact-worker.ts` |
| Artifacts | `packages/workers/src/artifact-generator.ts` |
| RAG index worker | `packages/workers/src/rag-indexing-worker.ts` |
| Artifact reindex | `packages/data-orchestration/src/services/rag-integration.service.ts` |
| Hybrid search | `apps/web/lib/rag/advanced-rag.service.ts` |
| Agentic tools | `apps/web/lib/ai/agentic-chat.service.ts` |
| Agent chat API | `apps/web/app/api/agents/chat/route.ts` |
| ReAct / orchestrator | `packages/agents/src/*` |
| Background agents | `packages/workers/src/agents/*` |
| Event bus | `packages/data-orchestration/src/events/event-bus.ts` |
| Lineage | `packages/data-orchestration/src/lineage/data-lineage.ts` |
| Knowledge graph | `packages/data-orchestration/src/services/knowledge-graph.service.ts` |
| Worker bootstrap | `packages/workers/src/index.ts` |

---

## 14. Related Documents

| Document | Focus |
|----------|--------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layered system design, multi-tenancy, deployment, ADRs |
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Legacy setup notes (historical) |
| [TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md) | Stack, DB, API, workers (if present at docs root) |
| [AGENTIC_SYSTEM.md](../AGENTIC_SYSTEM.md) | Mentions, tools, ReAct, autonomous layer |
| [DOCKER_ARCHITECTURE.md](./DOCKER_ARCHITECTURE.md) | Compose topology |
| [CLOUD_STORAGE_INTEGRATION.md](./CLOUD_STORAGE_INTEGRATION.md) | MinIO / Blob |
| [DATA_MODELS.md](./DATA_MODELS.md) | Table-level reference (legacy pointer) |

---

## Appendix A — Environment knobs (RAG & agents)

| Variable | Effect |
|----------|--------|
| `OPENAI_API_KEY` / Azure OpenAI vars | Enables embeddings, agents, enhancement |
| `RAG_EMBED_MODEL` | Embedding model (default `text-embedding-3-small`) |
| `RAG_EMBED_DIMENSIONS` | Vector size (e.g. 1024 on Azure) |
| `RAG_STEP_BACK` / `RAG_QUERY_DECOMPOSE` | Query-time expansion features |
| `AUTO_RAG_INDEXING` | Toggle auto index after OCR |
| `OPENAI_MODEL` | Default chat model |
| `REDIS_*` | Queue and event fabric |
| `DATABASE_URL` | PostgreSQL + pgvector |

---

## Appendix B — One-diagram summary

```
                 ┌──────────── UI / Agents / API ────────────┐
                 │  Chat · Copilot · Dashboards · @mentions  │
                 └───────────────┬───────────────────────────┘
                                 │ tools + hybridSearch
                 ┌───────────────▼───────────────────────────┐
                 │           GOLD (Intelligence)              │
                 │  Embeddings · Graph · Analytics · Cache    │
                 └───────────────┬───────────────────────────┘
                                 ▲ reindex / refresh
                 ┌───────────────┴───────────────────────────┐
                 │           SILVER (Structured)              │
                 │  Contracts · Artifacts · Clauses · Meta    │
                 └───────────────┬───────────────────────────┘
                                 ▲ OCR / extract / AI
                 ┌───────────────┴───────────────────────────┐
                 │           BRONZE (Raw Lake)                │
                 │  Files in Blob/MinIO · OCR raw text        │
                 └───────────────────────────────────────────┘
                                 ▲
                        Upload / external sync
```

**Bottom line:** ConTigo’s “data lake + RAG + agents” story is a continuous refinement pipeline: land raw contracts, curate structured intelligence, serve meaning via pgvector hybrid search, and reason over it with tool-using agents—all keyed by tenant and contract identity, coordinated by queues and events.

---

*ConTigo — AI-Powered Contract Lifecycle Management*
