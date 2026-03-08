# Chatbot / AI Chat System — Comprehensive Audit

> **Date:** June 2025  
> **Scope:** All AI chat endpoints, libraries, RAG pipeline, agent system, and UI components  
> **Type:** Read-only code audit — no changes made

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Capabilities List](#2-capabilities-list)
3. [Gaps and Weaknesses](#3-gaps-and-weaknesses)
4. [Mock vs Real](#4-mock-vs-real)
5. [Specific Code Issues](#5-specific-code-issues)
6. [Model Configuration](#6-model-configuration)

---

## 1. Architecture Overview

### High-Level Flow

```
User (Browser)
  │
  ├─ FloatingAIBubble ──→ POST /api/ai/chat/stream   (preferred — SSE streaming + tools)
  ├─ DashboardChatbot ──→ POST /api/ai/chat           (legacy — JSON response)
  ├─ (Any client) ──────→ POST /api/ai/chat/actions    (bi-directional contract updates)
  ├─ (Contract page) ──→ POST /api/ai/contract-analyst (scoped contract Q&A with RAG)
  └─ (@mention agents) → POST /api/agents/chat         (15 specialist agent personas)
```

### API Endpoints

| Endpoint | Method | Lines | Purpose |
|---|---|---|---|
| `/api/ai/chat/route.ts` | POST | 1567 | Legacy non-streaming chat (marked `@deprecated`) |
| `/api/ai/chat/stream/route.ts` | POST | 1226 | **Primary** — SSE streaming with agentic function calling |
| `/api/ai/chat/actions/route.ts` | POST/GET | 168 | Bi-directional contract field updates with confirmation flow |
| `/api/ai/contract-analyst/route.ts` | POST | 333 | Scoped contract Q&A with dedicated RAG |
| `/api/agents/chat/route.ts` | POST/DELETE | 1275 | 15 specialist @mention agents |

### Request Lifecycle (Streaming Route — Primary Path)

1. **Auth & Rate Limit** — `withAuthApiHandler` validates session; `checkRateLimit` enforces per-tenant limits (shared bucket with legacy)
2. **Semantic Cache Check** — `semanticCache.get()` checks for embedding-similar cached responses (0.95 cosine threshold)
3. **Episodic Memory Retrieval** — `retrieveRelevantMemories()` loads prior interaction context
4. **Token Budget Allocation** — `allocateBudget()` prevents context window overflow
5. **Parallel RAG** — `parallelMultiQueryRAG()` runs HyDE + query expansion + legal synonyms in parallel, fused via RRF
6. **Complexity Detection** — `detectQueryComplexity()` classifies query as simple/moderate/complex
7. **Model Chain Construction** — `buildModelChain()` selects ordered model list based on complexity
8. **@mention Agent Detection** — Extracts persona mentions, injects persona system prompt overlay
9. **ReAct Agent Decision** — `shouldUseAgent()` decides if multi-step reasoning is needed
10. **Agentic Tool Loop** — Up to 3 iterations of: stream tokens → accumulate tool calls → execute tools in parallel → feed results back
11. **Self-Critique** — Checks response grounding ratio against RAG context, detects hedging language
12. **Post-processing** — Cache storage, episodic memory storage, conversation persistence to DB, AI cost recording
13. **SSE Done Event** — Emits confidence, self-critique score, model used, tools used, suggested actions

### Core Library Modules

| File | Lines | Purpose |
|---|---|---|
| `lib/ai/chat/intent-detection.ts` | 1222 | Regex-based intent classification (60+ action subtypes) |
| `lib/ai/chat/response-builder.ts` | 338 | OpenAI API caller with RAG context enrichment |
| `lib/ai/chat/contract-queries.ts` | 414 | Prisma DB queries for contract retrieval |
| `lib/ai/chat/contract-intelligence.ts` | 440 | Full contract data extraction (artifacts, risks, obligations) |
| `lib/ai/chat/procurement-analytics.ts` | 360 | Spend, savings, risk, compliance, supplier analytics |
| `lib/ai/chat/deep-analysis.ts` | 288 | Dynamic portfolio analysis with filtering |
| `lib/ai/chat/contract-comparison.ts` | 970 | 1v1, clause-level, and group contract comparisons |
| `lib/ai/chat/taxonomy-operations.ts` | ~200 | Hierarchical category tree and contract classification |
| `lib/ai/chat/contract-hierarchy.ts` | 210 | Master/sub-agreement relationships and linking |
| `lib/ai/universal-handler.ts` | 349 | Fallback handler for edge-case messages |
| `lib/ai/streaming-tools.ts` | 1833 | 25 OpenAI function-calling tool definitions and executors |
| `lib/chatbot/action-handlers/` | 14 files | Action execution registry (updates, workflows, analytics, etc.) |

### RAG Pipeline

| File | Lines | Purpose |
|---|---|---|
| `lib/rag/advanced-rag.service.ts` | 1477 | Core hybrid search (BM25 + vector), RRF fusion, reranking, query routing |
| `lib/rag/parallel-rag.service.ts` | 555 | Multi-query RAG with HyDE, expansion, and legal synonyms in parallel |
| `lib/rag/semantic-cache.service.ts` | 484 | Redis-backed embedding-similarity cache with in-memory LRU |
| `lib/rag/reranker.service.ts` | — | Cross-encoder reranking (GPT-based) with MMR diversity |
| `lib/rag/self-corrective-rag.service.ts` | — | CRAG: LLM grades chunks, auto-reformulates on low confidence |
| `lib/rag/parent-document-retrieval.service.ts` | — | Two-tier chunking: small for matching, large for context |
| `lib/rag/contextual-retrieval.service.ts` | — | Anthropic-style chunk contextualization |
| `lib/rag/chunk-graph.service.ts` | — | Legal concept ontology for co-retrieval |
| `lib/rag/query-expansion.service.ts` | — | HyDE, decomposition, step-back queries |
| `lib/rag/semantic-chunker.service.ts` | — | Structure-aware document splitting |
| `lib/rag/rag-evaluation.service.ts` | — | Evaluation framework with golden test set |

### UI Components

| Component | Lines | Endpoint Used | Streaming |
|---|---|---|---|
| `FloatingAIBubble.tsx` | 2919 | `/api/ai/chat/stream` | Yes (SSE) |
| `DashboardChatbot.tsx` | 296 | `/api/ai/chat` (legacy) | No |

---

## 2. Capabilities List

### Contract Search & Retrieval
- Semantic search across all contracts (hybrid BM25 + vector via RAG)
- Multi-field flexible search (title, supplier, description, fileName, category)
- Search by supplier, status, value range, signature status, document type
- List expiring contracts (configurable day window)
- List auto-renewal contracts
- List contracts needing signature
- List non-contract documents
- Contract count and supplier summary aggregations

### Contract Intelligence
- Full artifact extraction: OVERVIEW, FINANCIAL, CLAUSES, RISK, COMPLIANCE, RENEWAL, OBLIGATIONS, RATES
- Insights generation, risk identification, compliance status extraction
- Rate card data retrieval
- Proactive insights (critical expiring, auto-renewals approaching)
- Recent activity tracking (24h uploads/updates)

### Contract Comparison
- 1-vs-1 full contract comparison
- Clause-level comparison between two contracts
- Group comparison across multiple contracts
- Comparison entities detected from natural language

### Procurement Analytics
- Spend analysis (total, annual, by supplier, by category)
- Cost savings opportunities (from `costSavingsOpportunity` table)
- Risk assessment (expiration risk, auto-renewal risk)
- Compliance status reporting
- Supplier performance analysis
- Rate comparison across contracts
- Top suppliers ranking
- Category-level spend breakdown

### Deep Analysis
- Portfolio-level analysis with dynamic query building
- Filters by supplier, category, year
- Duration, risk, category, and status breakdowns

### Contract Updates (Bi-Directional)
- Update fields via natural language: expiration date, effective date, value, status, title, supplier, client, category
- Confirmation flow: pending action → user confirms/rejects → write to DB
- Field mappings for natural language → database fields
- Separate `/api/ai/chat/actions` endpoint for update execution

### Workflow Management (via Streaming Tools)
- Start workflow by name or type
- List workflow templates
- Get pending approvals
- Approve or reject workflow steps
- Get workflow status
- Create new workflow definitions
- Cancel workflows
- Assign approvers
- Escalate workflows
- Suggest appropriate workflows

### Taxonomy Operations
- View hierarchical category tree
- Get category details (fuzzy name match)
- Suggest category for a contract (keyword-based)
- List contracts in a category

### Contract Hierarchy
- Find master agreements (MSA/MASTER types)
- View parent-child contract relationships
- Create linked contract drafts
- Find suitable parent contracts
- Renewal workflow discovery and execution

### Agent Personas (15 @mention Agents)
| Agent | @mention | Domain |
|---|---|---|
| Sage | `@sage` | Intelligent search (DEFAULT) |
| Scout | `@scout` | RFx opportunity detection |
| Merchant | `@merchant` | RFx procurement workflows |
| Sentinel | `@sentinel` | Validation |
| Vigil | `@vigil` | Compliance monitoring |
| Warden | `@warden` | Risk detection |
| Architect | `@architect` | Workflow authoring |
| Prospector | `@prospector` | Opportunity discovery |
| Clockwork | `@clockwork` | Deadline management |
| Conductor | `@conductor` | Conflict resolution |
| Navigator | `@navigator` | Onboarding coach |
| Builder | `@builder` | Template generation |
| Memorykeeper | `@memorykeeper` | Contract transformation |
| Orchestrator | `@orchestrator` | Workflow orchestration |
| Synthesizer | `@synthesizer` | Data synthesis |

### Streaming & UX Features
- True token-level SSE streaming (OpenAI and Anthropic)
- Tool call progress events (`tool_start`, `tool_preview`, `tool_done`)
- Plan step events for multi-step reasoning
- Confidence scoring with tier classification
- Self-critique grounding analysis
- Suggested follow-up actions
- Database-backed conversation persistence (survives sessions/devices)
- Offline message queue (UI-side)
- Voice input
- Chat export
- Feedback dialog
- Cost widget

### System Monitoring
- System health status
- Queue status
- AI performance metrics
- Categorization accuracy

### Conversation Intelligence
- Multi-turn conversation history (last 10 messages)
- Reference resolution ("it", "that contract", "this one")
- Clarification prompt generation
- Suggestion generation based on context
- Thread-based agent conversations (Redis-cached)

---

## 3. Gaps and Weaknesses

### Critical

1. **In-Memory Pending Actions** — `update-actions.ts` stores pending update confirmations in a JavaScript `Map`, not Redis or DB. Data is lost on server restart or deployment. Any pending confirmation a user hasn't clicked "yes" on will vanish silently.

2. **Legacy Route Still Active** — `/api/ai/chat` (1567 lines) is marked `@deprecated` but `DashboardChatbot.tsx` still calls it. Two entry points to maintain with divergent feature sets (the legacy route has NO tool calling, NO self-critique, NO semantic cache, NO episodic memory).

3. **Intent Detection is Purely Regex** — `intent-detection.ts` (1222 lines of regex patterns) does not use any LLM-based classification. Edge cases and nuanced queries that don't match patterns fall through to a generic `type: 'question', action: 'general'` bucket. No LLM fallback for intent disambiguation.

### High

4. **Monolithic Route Handlers** — The legacy route is a single ~1500-line function. The streaming route is similarly large at ~1200 lines. Both are difficult to test in isolation and prone to merge conflicts.

5. **Anthropic Path Has No Tool Calling** — When the system falls back to Anthropic models, the agentic tool loop is skipped entirely (`iteration = MAX_TOOL_ITERATIONS` forces exit). Users on the Anthropic fallback path get a significantly degraded experience — no search, no analytics, no workflow tools.

6. **Token Estimation is Approximate** — Token counts are estimated as `Math.round(text.length / 4)` throughout. This is a rough heuristic (actual tokenization varies). Budget allocation, cost recording, and AI usage logging all use this estimate, meaning reported costs and token counts are inaccurate.

7. **Taxonomy Suggestion is Keyword-Based** — `suggestCategoryForContract()` in `taxonomy-operations.ts` uses simple keyword matching to suggest categories, not AI-based classification. Could misclassify contracts that don't contain obvious keywords.

### Medium

8. **DashboardChatbot Uses Legacy Non-Streaming Endpoint** — `DashboardChatbot.tsx` calls `/api/ai/chat` (the deprecated route). Users on the dashboard get no streaming, no tool calling, no self-critique, no episodic memory — a significantly worse experience than the floating bubble.

9. **No Retry Logic on Legacy Route** — The legacy `/api/ai/chat` route calls `getOpenAIResponse()` once with a 30-second timeout but has no retry or model failover. If OpenAI is down, the request fails immediately. The streaming route has full model failover chain; the legacy route does not.

10. **Rate Limiting Shares Bucket** — Both streaming and legacy endpoints share the same rate limit bucket. Heavy legacy usage could starve streaming users and vice versa.

11. **Self-Critique is Simplistic** — The grounding check compares individual words (>4 chars) against RAG text. This is a bag-of-words approach that doesn't capture semantic meaning. A response could use many of the same words as RAG context but still be factually wrong (or vice versa).

12. **No Streaming for Contract Analyst** — `/api/ai/contract-analyst` returns a full JSON response, not streaming. For long answers about complex contracts, users wait for the complete response.

13. **Agent Execution Has No Circuit Breaker** — If an agent handler consistently fails or times out, there's no circuit breaker to stop routing to it. It will retry on every request (up to 2 retries × 15s timeout = 45s wasted per call).

### Low

14. **Hardcoded Model Names in Anthropic Failover** — Model identifiers like `claude-3-haiku-20240307` are hardcoded in the model chain builder rather than being configurable via environment variables.

15. **Tool Result Truncation is Crude** — Results over 30K chars are sliced with `... [truncated]`. No intelligent summarization; the LLM may get a mid-sentence cutoff.

16. **ReAct Agent Decision is Likely Regex-Based** — `shouldUseAgent()` makes the decision without calling an LLM, so complex queries that don't match heuristic patterns may miss the agent path.

---

## 4. Mock vs Real

### Verdict: **Everything is Real**

There is **no mock data** anywhere in the chat system. Every database query uses Prisma against the actual PostgreSQL database. Every AI call uses real OpenAI / Anthropic API clients.

| Component | Real/Mock | Details |
|---|---|---|
| Contract queries | **Real** | All use Prisma (`prisma.contract.findMany`, etc.) |
| Procurement analytics | **Real** | Queries `contract`, `costSavingsOpportunity`, `rateCardEntry` tables |
| RAG search | **Real** | `hybridSearch` runs actual vector + BM25 search against embeddings |
| OpenAI calls | **Real** | `openai.chat.completions.create()` with real API key |
| Anthropic calls | **Real** | `anthropic.messages.stream()` with real API key (failover only) |
| Conversation persistence | **Real** | Writes to `chatConversation` / `chatMessage` tables |
| Agent conversations | **Real** | Writes to `agentConversation` table, cached in Redis |
| Semantic cache | **Real** | Redis-backed with in-memory LRU hot path |
| Cost recording | **Real** | `recordAICost()` logs to AI usage tracking |
| Workflow operations | **Real** | Prisma queries against workflow tables |
| Contract updates | **Real** | Prisma `update()` calls on the contract table |
| RFx creation (Merchant) | **Real** | Creates `rFxEvent` records, generates requirements via OpenAI |

### Template/Fallback Responses (Not Mock Data)

The `universal-handler.ts` returns hardcoded template strings for greetings, help, and thanks. These are intentional UX fallbacks (no need to call OpenAI to say "Hello!"), not mock data.

---

## 5. Specific Code Issues

### Bugs

1. **Conversation History Splice Bug** (`contract-analyst/route.ts` ~L269) — History messages are inserted at index 1 (`messages.splice(1, 0, ...historyMessages)`) but the user's current question is at index 1. This means history is inserted **before** the current question, which is correct for chronological order. However, the system message at index 0 contains the current query in its text, so the model sees the query twice (once in system, once in user). Minor but wasteful of tokens.

2. **Latency Not Tracked** (`contract-analyst/route.ts` ~L301) — The usage log has `latencyMs: 0` with a comment `// Could track actual latency`. Easy fix, not done.

3. **Pending Action Expiry Not Enforced Proactively** (`update-actions.ts`) — Expired pending actions are only cleaned up when queried. If users never confirm, the in-memory `Map` accumulates stale entries until server restart.

### Dead Code / Redundancy

4. **Duplicate Intent Detection** — Both the legacy route (`route.ts`) and the action handlers (`action-handlers/index.ts`) include their own intent detection logic. The streaming route delegates to OpenAI function calling instead. Three partially-overlapping intent detection paths exist.

5. **Universal Handler Overlap** — `universal-handler.ts` has `handleAnyMessage()` with its own categorization (greeting/thanks/help/question/command/unclear) that overlaps with `intent-detection.ts`. It's used as a fallback but duplicates logic.

### Structural Issues

6. **No Shared Type Definitions for SSE Events** — SSE event shapes (`content`, `tool_start`, `tool_done`, `done`, `error`, `metadata`, `plan`, `tool_preview`) are defined inline as JSON objects in the streaming route. The frontend parses them without shared types — fragile contract.

7. **Model Router Inconsistency** — The streaming route uses `routeToModel` from `model-router` service AND `buildModelChain()` locally. Two model-selection mechanisms that could contradict each other.

8. **Action Handler Registry Uses String Keys** — `index.ts` maps action strings to handler functions without type safety. A typo in an action name would silently fall through to the default case.

---

## 6. Model Configuration

### OpenAI (Primary Provider)

| Setting | Value | Source |
|---|---|---|
| **Default model** | `gpt-4o-mini` | `process.env.OPENAI_MODEL` (fallback: `gpt-4o-mini`) |
| **Complex queries** | `gpt-4o` | Hardcoded in model chain builder |
| **Temperature** | `0.3` | Hardcoded in `response-builder.ts` and `contract-analyst` |
| **Max tokens** | `2000` | Hardcoded (legacy + streaming routes) |
| **Contract analyst max tokens** | `1500` | Hardcoded in `contract-analyst/route.ts` |
| **Timeout** | `30s` | `AbortSignal.timeout(30_000)` |
| **Streaming** | Yes | `stream: true` on OpenAI call in streaming route |
| **Tool calling** | Yes | 25 tools via `STREAMING_TOOLS` |
| **Max tool iterations** | 3 | `MAX_TOOL_ITERATIONS` constant |
| **Tool execution timeout** | 15s | Per-tool `Promise.race` timeout |
| **RFx AI model** | `gpt-4o-mini` | `process.env.RFX_AI_MODEL` (fallback: `gpt-4o-mini`) |
| **Response format** | JSON (for Merchant RFx) | `response_format: { type: 'json_object' }` for requirements generation |

### Anthropic (Failover Only)

| Setting | Value | Source |
|---|---|---|
| **Activation** | Only if `ANTHROPIC_API_KEY` is set | Conditional import |
| **Haiku** | `claude-3-haiku-20240307` | Hardcoded in failover chain |
| **Sonnet** | `claude-3-sonnet-20240229` | Hardcoded in failover chain |
| **Sonnet 3.5** | `claude-3-5-sonnet-20241022` | Hardcoded in failover chain |
| **Max tokens** | `2000` | Hardcoded in Anthropic call |
| **History** | Last 10 messages | Sliced before sending |
| **Tool calling** | **No** — content-only streaming | Exits agentic loop immediately |
| **Timeout** | `30s` | `AbortSignal.timeout(30_000)` |

### Model Selection Logic

```
detectQueryComplexity(message) → simple | moderate | complex

simple   → [gpt-4o-mini, claude-3-haiku, gpt-4o, claude-3-sonnet]
moderate → [gpt-4o-mini, gpt-4o, claude-3-haiku, claude-3-sonnet]
complex  → [gpt-4o, gpt-4o-mini, claude-3-5-sonnet, claude-3-sonnet]
```

The system tries models in order. If one fails (non-quota error), it moves to the next. Quota/auth errors (429, 401) cause immediate abort — no point trying other models from the same provider.

### RAG Configuration

| Setting | Value |
|---|---|
| **Search mode** | Hybrid (BM25 + vector) with intelligent routing |
| **Top-K** | 8 results |
| **Min score** | 0.3 |
| **Reranking** | Enabled (GPT cross-encoder + MMR diversity) |
| **Query expansion** | Enabled (HyDE, decomposition, legal synonyms) |
| **Cache similarity threshold** | 0.95 cosine |
| **Cache TTL** | 30 minutes (configurable via `RAG_CACHE_TTL_MS`) |
| **Cache max entries** | 2000 (configurable via `RAG_CACHE_MAX_ENTRIES`) |
| **Cache max per tenant** | 500 (configurable via `RAG_CACHE_MAX_PER_TENANT`) |
| **Self-corrective RAG** | Available (CRAG — grades chunks, auto-reformulates) |

### Rate Limiting

- Shared bucket between streaming and legacy endpoints via `checkRateLimit`
- Limits enforced per-tenant
- VIEWER role blocked from write tool operations (`WRITE_TOOLS` set)

### Confidence Scoring

- Dynamic confidence calculated from RAG source scores, match types, and content alignment
- Adjusted upward (+0.1) when all tools succeed
- Multiplied by self-critique score (0.5–1.0 based on grounding ratio)
- Confidence tier classification included in done event

---

## Summary

The chatbot system is **feature-rich and production-grade**, with real AI calls, real database queries, a sophisticated RAG pipeline, and an impressive agent system. The main areas of concern are:

1. **In-memory pending actions** need to move to Redis/DB to survive deployments
2. **Legacy route** should be retired — migrate `DashboardChatbot` to the streaming endpoint
3. **Intent detection** could benefit from an LLM fallback for ambiguous queries
4. **Anthropic failover** provides a degraded experience (no tools) — worth documenting or warning users
5. **Monolithic handlers** (1200–1500 lines each) should be decomposed for maintainability
