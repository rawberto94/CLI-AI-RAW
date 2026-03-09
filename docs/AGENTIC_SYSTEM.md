# ConTigo Agentic AI System

> A multi-agent, AI-powered contract intelligence platform with autonomous reasoning, hybrid search, and human-in-the-loop safeguards.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│                   (ConTigo Labs Dashboard)                       │
│                                                                 │
│   @sage  @merchant  @scout  @vigil  @warden  @clockwork  ...   │
│                    @mention routing                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  POST /api/agents/chat                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Intelligence Gate                           │    │
│  │  shouldUseAgent() → complexity detection                 │    │
│  │  Complex queries → full agentic reasoning loop           │    │
│  └────────────┬────────────────────────┬───────────────────┘    │
│               │                        │                        │
│         Complex query            Simple query                   │
│               │                        │                        │
│               ▼                        ▼                        │
│  ┌────────────────────┐   ┌────────────────────────────┐       │
│  │   Agentic Chat     │   │  15 Specialized Agent      │       │
│  │   Service          │   │  Handlers                  │       │
│  │                    │   │                            │       │
│  │  OpenAI function-  │   │  DB queries + AI-enhanced  │       │
│  │  calling loop      │   │  responses via GPT         │       │
│  │  with 8 tools      │   │                            │       │
│  └────────┬───────────┘   └──────────┬─────────────────┘       │
│           │                          │                          │
│           ▼                          ▼                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Tool Layer                              │   │
│  │                                                          │   │
│  │  Hybrid Search (RAG)  │  Prisma DB  │  OpenAI GPT       │   │
│  │  Vector + Keyword     │  Queries    │  Reasoning         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. @Mention Routing

Users interact with agents through natural language in the chat interface. To address a specific agent, use `@mention` syntax:

```
@sage What are our riskiest contracts?
@merchant Create an RFP for cloud hosting services
@vigil Show me compliance alerts
```

When no agent is mentioned, messages route to **Sage** (the default conversational agent).

Multiple agents can be mentioned in the same message for cross-functional insights:

```
@vigil @warden Analyze ACME Corp's risk and compliance status
```

### 2. Intelligence Gate

Before routing to individual agents, every message passes through the **Intelligence Gate** — a complexity detector that determines whether the query needs multi-step AI reasoning.

**How complexity is detected:**

| Signal | Score |
|--------|-------|
| Analysis patterns (analyze, compare, evaluate) | +1 each |
| Multi-step keywords (first, then, also, furthermore) | +1 each |
| Deep analysis keywords (thorough, comprehensive, risk audit) | +1 each |
| Multiple conditions (and/or/but conjunctions ≥ 2) | +2 |
| Multiple question parts or ordered steps | +2 |
| Long queries (> 20 words) | +1 |

**Score ≥ 3** → Routes to the **Agentic Chat Service** (full AI reasoning loop)
**Score < 3** → Routes to individual agent handlers (fast DB + AI enhancement)

### 3. The Agentic Chat Service

For complex queries, the system uses OpenAI's **function-calling** API in an iterative reasoning loop:

```
User Question
     │
     ▼
┌─────────────┐
│  GPT Model  │ ◄── System prompt + conversation history
│  (gpt-4o)   │
└──────┬──────┘
       │
       ▼
  Tool calls?  ──No──► Return final answer
       │
      Yes
       │
       ▼
  Execute tools in parallel
       │
       ▼
  Feed results back to GPT
       │
       ▼
  Loop (up to 5 iterations)
```

**Available Tools:**

| Tool | Purpose |
|------|---------|
| `search_contracts` | Hybrid search (semantic + keyword) across all contracts via RAG |
| `get_contract_details` | Full contract data including clauses, artifacts, versions |
| `list_expiring_contracts` | Contracts expiring in 30/60/90 days with value-at-risk |
| `get_spend_analysis` | Spend breakdown by supplier, category, month, or year |
| `get_risk_assessment` | Portfolio risk scoring — expiration, auto-renewal, high-value |
| `compare_contracts` | Side-by-side comparison of contract terms and values |
| `get_supplier_info` | Supplier relationship summary — spend, contract count, tenure |
| `extract_clause` | Extract specific clause types from contract text |

The model decides which tools to call, can chain multiple tool calls across iterations, and synthesizes all results into a coherent response.

### 4. Hybrid Search (RAG)

Contract search uses a sophisticated Retrieval-Augmented Generation pipeline:

```
Query: "auto-renewal clauses in IT contracts"
         │
         ├─► Query Expansion (generate synonyms/variations)
         ├─► HyDE (generate hypothetical answer document)
         ├─► Step-Back Prompting (broader abstract query)
         │
         ▼
    ┌─────────────────────────────┐
    │     Parallel Search         │
    │                             │
    │   Semantic: pgvector        │
    │   Keyword: pg_trgm + tsvec  │
    │                             │
    └──────────┬──────────────────┘
               │
               ▼
         Score Fusion (RRF)
               │
               ▼
         Cross-Encoder Reranking
               │
               ▼
         Deduplicated Results
```

This replaces the basic Prisma `contains` search that was previously used, providing:
- **Semantic understanding** — finds contracts by meaning, not just keywords
- **Query expansion** — automatically generates search variations
- **Reranking** — a second-pass model scores relevance more precisely
- **Fallback** — degrades gracefully to keyword search if embeddings unavailable

---

## The Agent Roster

### Core Intelligence

| Agent | @Mention | Specialty | AI-Powered |
|-------|----------|-----------|------------|
| **Sage** 🔮 | `@sage` | Search, analysis, Q&A (default agent) | ✅ Full agentic reasoning with 8 tools |
| **Merchant** 🤝 | `@merchant` | RFx procurement lifecycle | ✅ GPT for requirements generation |

### Risk & Compliance

| Agent | @Mention | Specialty | AI-Powered |
|-------|----------|-----------|------------|
| **Vigil** ⚖️ | `@vigil` | Compliance monitoring & alerts | ✅ AI pattern analysis on DB data |
| **Warden** 🔥 | `@warden` | Risk detection & mitigation | ✅ AI risk assessment & recommendations |
| **Sentinel** 🛡️ | `@sentinel` | Contract validation & completeness | DB-powered field checks |

### Operations & Deadlines

| Agent | @Mention | Specialty | AI-Powered |
|-------|----------|-----------|------------|
| **Clockwork** ⏰ | `@clockwork` | Deadline management & alerts | ✅ AI prioritization & action planning |
| **Orchestrator** 🎼 | `@orchestrator` | Workflow execution monitoring | DB-powered status tracking |

### Analysis & Discovery

| Agent | @Mention | Specialty | AI-Powered |
|-------|----------|-----------|------------|
| **Scout** 🎯 | `@scout` | RFx opportunity detection | DB-powered opportunity scanning |
| **Prospector** 💎 | `@prospector` | Hidden value & savings discovery | ✅ AI portfolio analysis & consolidation |
| **Synthesizer** 🔄 | `@synthesizer` | Portfolio-level analytics & reporting | ✅ AI trend analysis & insights |

### Contract Intelligence

| Agent | @Mention | Specialty | AI-Powered |
|-------|----------|-----------|------------|
| **Conductor** 🎼 | `@conductor` | Clause conflict detection | ✅ AI conflict & redundancy analysis |
| **Builder** 🏗️ | `@builder` | Template generation & management | DB-powered template library |
| **Memorykeeper** 📚 | `@memorykeeper` | Version history & audit trail | DB-powered artifact tracking |

### Platform & Guidance

| Agent | @Mention | Specialty | AI-Powered |
|-------|----------|-----------|------------|
| **Architect** 🏛️ | `@architect` | Workflow design & authoring | DB-powered workflow templates |
| **Navigator** 🧭 | `@navigator` | Onboarding & platform guidance | Context-aware onboarding |

---

## AI Enhancement Layer

Agents that handle structured data (Vigil, Warden, Clockwork, Prospector, Conductor, Synthesizer) use an **AI Enhancement** pattern:

```
1. Agent handler executes DB queries (fast, reliable)
2. Raw data passed to enhanceWithAI()
3. GPT receives: agent role + user query + structured data
4. Returns intelligent, contextual analysis instead of template markdown
5. Falls back to template response if GPT unavailable
```

This means every agent provides useful responses even without an API key, but with GPT available, they deliver:
- **Pattern analysis** instead of data dumps
- **Actionable recommendations** instead of lists
- **Risk scoring** with prioritization
- **Trend insights** from aggregated data

---

## The ReAct Agent Layer

For multi-step reasoning tasks, the system includes a **ReAct (Reasoning + Acting) agent** built on LangChain:

```
┌──────────────────────────────────────────────┐
│              ReAct Agent Loop                 │
│                                              │
│   1. THINK  – reason about what to do next   │
│   2. ACT    – call a tool                    │
│   3. OBSERVE – interpret the result          │
│   4. REFLECT – assess confidence             │
│   5. Repeat until confident or max steps     │
│                                              │
│   Built-in tools:                            │
│   • search_database_contracts                │
│   • get_contract_artifacts                   │
│   • analyze_portfolio_risk                   │
│                                              │
│   Config:                                    │
│   • Max iterations: 6                        │
│   • Temperature: 0.3 (factual)               │
│   • Self-reflection: enabled                 │
│   • Confidence threshold: 0.7                │
└──────────────────────────────────────────────┘
```

The agent integration layer (`agent-integration.ts`) provides:
- **`shouldUseAgent(query)`** — Determines if a query needs multi-step reasoning
- **`executeWithAgent(query)`** — Runs the full ReAct loop
- **`processWithAgentDecision(query)`** — Combined decision + execution

---

## Autonomous Orchestrator

The most advanced layer is the **Autonomous Orchestrator** (2,300+ lines), which provides:

- **Goal Decomposition** — Breaks complex objectives into sub-tasks
- **Proactive Triggers** — Monitors conditions and fires autonomous actions
- **Learning Records** — Tracks what worked and adapts over time
- **A/B Testing** — Queries `ab_test_winners` table for model selection
- **Human-in-the-Loop** — Escalates to humans at critical decision points
- **Multi-Agent Coordination** — Orchestrates multiple agents working together

---

## Graceful Degradation

The system is designed to work at every tier:

| Tier | Capability | Requirement |
|------|------------|-------------|
| **Full AI** | Agentic reasoning, hybrid search, AI enhancement | `OPENAI_API_KEY` set |
| **Search + DB** | Hybrid RAG search + structured DB responses | `OPENAI_API_KEY` set |
| **DB Only** | Prisma queries + template markdown responses | No API key needed |

Every AI call is wrapped in:
- **Timeout** (15–40s) with fallback to non-AI response
- **Retry** (exponential backoff, max 2 retries)
- **Error isolation** — one agent failure never crashes others

---

## Data Flow

```
User sends: "@sage Compare our top 5 IT vendors by spend and risk"
                              │
                              ▼
                    Intelligence Gate
                    Score: 5 (complex)
                              │
                              ▼
                    Agentic Chat Service
                    Model: gpt-4o (high complexity)
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
      get_spend_analysis  get_risk_assessment  get_supplier_info
      (by supplier)       (portfolio-wide)     (× 5 vendors)
              │               │                │
              └───────────────┼────────────────┘
                              │
                              ▼
                    GPT synthesizes all results
                    into comparative analysis
                              │
                              ▼
                    "Based on the data, your top IT vendors
                     ranked by combined spend and risk:
                     1. ACME Corp — $2.4M, 3 critical risks...
                     2. ..."
```

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `app/api/agents/chat/route.ts` | Main agent chat API with 15 handlers, intelligence gate, AI enhancement | ~1,500 |
| `lib/ai/agentic-chat.service.ts` | OpenAI function-calling loop with 8 tools | ~800 |
| `lib/ai/agent-integration.ts` | ReAct agent integration + complexity detection | ~550 |
| `lib/rag/advanced-rag.service.ts` | Hybrid search: semantic + keyword + reranking | ~1,200 |
| `packages/agents/src/react-agent.ts` | ReAct (Reason + Act) agent pattern | ~760 |
| `packages/agents/src/orchestrator.ts` | LangChain-based multi-chain orchestrator | ~180 |
| `packages/agents/src/autonomous-orchestrator.ts` | Goal decomposition, triggers, learning | ~2,300 |
| `lib/ai/agent-context-enrichment.service.ts` | Deep context gathering for agent decisions | Variable |

---

## Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `OPENAI_API_KEY` | Enables AI reasoning, search, and enhancement | — |
| `OPENAI_MODEL` | Default model for AI calls | `gpt-4o-mini` |
| `RFX_AI_MODEL` | Model for Merchant RFx generation | `gpt-4o-mini` |
| `RFX_AGENT_ENABLED` | Enable/disable Merchant agent | `true` |
| `RFX_DEFAULT_DEADLINE_DAYS` | Default RFx response deadline | `30` |
| `RAG_EMBED_MODEL` | Embedding model for hybrid search | `text-embedding-3-small` |
| `RAG_EMBED_DIMENSIONS` | Embedding dimensions | Auto |
| `RAG_STEP_BACK` | Enable step-back prompting in search | `true` |
| `RAG_QUERY_DECOMPOSE` | Enable query decomposition | `true` |
| `LOG_LEVEL` | Agent chat log verbosity | `info` |
