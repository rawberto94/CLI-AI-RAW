# RFx System — Comprehensive Research Report

> Generated from full codebase analysis of the Contigo Platform monorepo.  
> Covers database models, API routes, UI components, documentation, AI integration, existing features, and contract integration.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Database Models](#2-database-models)
3. [API Routes](#3-api-routes)
4. [UI Components](#4-ui-components)
5. [AI Integration & Agents](#5-ai-integration--agents)
6. [Existing Implemented Features](#6-existing-implemented-features)
7. [Contract & Ecosystem Integration](#7-contract--ecosystem-integration)
8. [Documentation & Roadmap](#8-documentation--roadmap)
9. [Configuration & Feature Flags](#9-configuration--feature-flags)
10. [Implementation Status Matrix](#10-implementation-status-matrix)
11. [Gaps & Recommendations](#11-gaps--recommendations)

---

## 1. Executive Summary

The RFx system is a **production-grade, partially completed** procurement automation platform within the Contigo ecosystem. It centers on two AI agents (**Scout** for opportunity detection and **Merchant** for procurement lifecycle management), backed by dedicated Prisma models, a full Next.js API layer, and a rich React UI inside the Contigo Labs page.

**Key findings:**
- **2 database models** (`RFxEvent`, `RFxOpportunity`) plus 2 related models with RFx references
- **1 dedicated API route file** (`/api/agents/rfx-opportunities`) with GET/POST/PATCH + 4 detection algorithms re-implemented at the API layer
- **2 agent implementations** (836 + 707 lines) with full OpenAI integration
- **1 major UI view** (`RFxStudioView`) with 5 sub-tabs, 2 modals, and an AI Template Studio
- **Chat integration** via `@merchant` and `@scout` mentions
- **Environment configuration** with 3 feature flags
- **Significant planned features** in 2 roadmap docs (993 + 525 lines) that are NOT yet implemented

---

## 2. Database Models

**Schema file:** `packages/clients/db/schema.prisma` (lines 5817–5960)

### 2.1 `RFxEvent` (table: `rfx_events`)

The primary model representing an RFx sourcing event (RFP, RFQ, RFI, Auction, RFT).

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `title` | String | Event title |
| `description` | String? | Detailed description |
| `type` | String | RFP / RFQ / RFI / Auction / RFT |
| `status` | String (default: "draft") | draft / published / open / closed / awarded / cancelled / awaiting_approval |
| `category` | String? | Contract category |
| `contractType` | String? | Type classification |
| `sourcingContractId` | String? | Originating contract reference |
| `estimatedValue` | Decimal? | Expected total value |
| `currency` | String (default: "USD") | Currency code |
| `publishDate` | DateTime? | When published to vendors |
| `responseDeadline` | DateTime? | Vendor response deadline |
| `awardDate` | DateTime? | When award decision made |
| `contractStartDate` | DateTime? | New contract start date |
| `requirements` | Json? | AI-generated requirements (JSONB) |
| `evaluationCriteria` | Json? | Weighted scoring criteria (JSONB) |
| `invitedVendors` | String[] | Array of vendor identifiers |
| `responses` | Json? | Vendor bid responses (JSONB) |
| `winner` | String? | Awarded vendor |
| `awardJustification` | String? | Explanation for award decision |
| `savingsAchieved` | Decimal? | Actual savings realized |
| `notes` | String? | Internal notes |
| `createdAt` | DateTime | Record creation |
| `updatedAt` | DateTime | Last update |
| `createdBy` | String? | Creator user ID |

**Indexes:**
- `[tenantId, status]` — Tenant-scoped status queries
- `[tenantId, type]` — Tenant-scoped type filtering
- `[responseDeadline]` — Deadline-based queries
- `[status, responseDeadline]` — Status + deadline compound

### 2.2 `RFxOpportunity` (table: `rfx_opportunities`)

Represents a detected sourcing opportunity before it becomes a formal RFx event.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Primary key |
| `tenantId` | String | Multi-tenant isolation |
| `contractId` | String? | Source contract |
| `algorithm` | String | Detection algorithm: expiration / savings / performance / consolidation |
| `status` | OpportunityStatus (default: IDENTIFIED) | IDENTIFIED / CONVERTED / REJECTED / SNOOZED |
| `urgency` | OpportunityUrgency | CRITICAL / HIGH / MEDIUM / LOW |
| `confidence` | Float | 0-1 confidence score |
| `title` | String | Human-readable title |
| `description` | String? | Detailed explanation |
| `reasoning` | String? | AI-generated reasoning |
| `currentValue` | Decimal? | Current contract value |
| `savingsPotential` | Decimal? | Estimated savings amount |
| `savingsPercent` | Float? | Savings as percentage |
| `marketRate` | Decimal? | Current market rate |
| `expiryDate` | DateTime? | Contract expiry |
| `daysToExpiry` | Int? | Days until expiry |
| `evidence` | Json? | Supporting data points |
| `recommendedAction` | String? | Suggested next step |
| `rfxId` | String? | Linked RFx event (set on conversion) |
| `rejectedAt` | DateTime? | When rejected |
| `rejectionReason` | String? | Why rejected |
| `snoozedUntil` | DateTime? | Snooze expiry |
| `detectedAt` | DateTime | When detected |
| `convertedAt` | DateTime? | When converted to RFx |
| `metadata` | Json? | Additional metadata |

**Indexes:**
- `[tenantId]` — Tenant isolation
- `[tenantId, status]` — Status filtering
- `[tenantId, algorithm]` — Algorithm filtering
- `[detectedAt]` — Chronological ordering

### 2.3 Related Models with RFx References

**`ApprovalAction`** — Has `approvalType` enum including `'rfx_award'` for RFx award approval workflows.

**`AgentConversation`** — Has `agentId` field that can be `'rfx-procurement-agent'`, and `context` JSONB that can include `rfxId` for conversation continuity.

**`AgentEvent`** — Used to log Scout/Merchant activity (e.g., `opportunity_found`, `opportunity_converted`).

**`RiskDetectionLog`** — Queried by the performance detection algorithm to find contracts with CRITICAL/HIGH severity issues.

---

## 3. API Routes

### 3.1 Dedicated RFx API: `/api/agents/rfx-opportunities/route.ts` (742 lines)

**File:** `apps/web/app/api/agents/rfx-opportunities/route.ts`

This is the **primary RFx API** — a fully implemented route with its own detection algorithms running directly against Prisma (not delegating to the worker agents).

#### `GET /api/agents/rfx-opportunities`

Lists detected RFx opportunities with filtering and pagination.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `algorithm` | enum | `'all'` | expiration / savings / performance / consolidation / all |
| `urgency` | enum | `'all'` | critical / high / medium / low / all |
| `category` | string | — | Contract type filter |
| `minSavings` | number | — | Minimum savings threshold |
| `limit` | number | 50 | Page size (1-200) |
| `offset` | number | 0 | Pagination offset |

**Response shape:**
```json
{
  "opportunities": [...],
  "stats": {
    "total": 12,
    "byUrgency": { "critical": 2, "high": 5, ... },
    "byAlgorithm": { "expiration": 4, "savings": 3, ... },
    "totalSavingsPotential": 450000,
    "avgConfidence": 0.87
  },
  "pagination": { "total": 12, "limit": 50, "offset": 0, "hasMore": false },
  "scout": { "lastScan": "...", "algorithmsRun": [...] }
}
```

**Detection Algorithms (run in parallel via `Promise.allSettled`):**

1. **Expiration Detection** — Finds contracts expiring within 180 days where status is ACTIVE/EXECUTED. Urgency: critical (<30d), high (<90d), medium (90-180d).
2. **Savings Opportunity** — Compares contract annual value to 3+ comparable contracts of same type. Flags if >5% above market rate. Confidence scales with savings %.
3. **Performance Issues** — Queries `riskDetectionLog` for unacknowledged HIGH/CRITICAL severity with risk types: PERFORMANCE_ISSUE, DELIVERY_RISK, QUALITY_ISSUE.
4. **Consolidation** — Groups contracts by supplier, flags suppliers with 2+ active contracts, estimates 15% consolidation savings.

#### `POST /api/agents/rfx-opportunities`

Triggers a new detection scan. Same algorithms as GET but also creates an `agentEvent` log entry. Returns `{ success, opportunities, message }`.

#### `PATCH /api/agents/rfx-opportunities`

Handles opportunity lifecycle actions:

| Action | Behavior |
|--------|----------|
| `accept` / `create_rfx` | Creates `RFxEvent` (draft) from opportunity, creates `RFxOpportunity` record (CONVERTED), logs `agentEvent`. Uses a Prisma transaction. |
| `reject` | Updates `RFxOpportunity` status to REJECTED with timestamp and reason |
| `snooze` | Updates `RFxOpportunity` status to SNOOZED with `snoozedUntil` date (1-90 days) |

**Validated with Zod schemas:** `DetectionFilterSchema`, `OpportunityActionSchema`

### 3.2 Agent Chat: `/api/agents/chat/route.ts` (608 lines)

**@mention routing:**
- `@merchant` → routes to `rfx-procurement-agent`
- `@scout` → routes to `rfx-detection-agent`

**Navigation actions sent in responses:**
- "Create New RFx" → `/contigo-lab?action=create_rfx`
- "View All RFx" → `/contigo-lab?tab=rfx`

**Agent codenames:** Merchant (avatar: 🤝), Scout (avatar: 🎯)

### 3.3 Agent Status: `/api/agents/status/route.ts` (451 lines)

- **Cluster config:** Scout in "Oracles" cluster, Merchant in "Strategists" cluster
- **Quick actions:** "Scan for RFx Opportunities" → `POST /api/agents/rfx-opportunities/detect`, "Create New RFx" → `/contigo-lab?action=create_rfx`
- **`getPendingApprovalsCount()`:** Counts `rFxEvent` records with status `'awaiting_approval'`
- **`getOpportunityStats()`:** Queries `rFxOpportunity.count()`, `.groupBy({by:['algorithm']})`, `.aggregate({_sum:{savingsPotential:true}})`

### 3.4 Agent SSE: `/api/agents/sse/route.ts`

Real-time Server-Sent Events endpoint. Queries `rFxOpportunity.count()` for live dashboard metrics.

### 3.5 Agent Opportunities: `/api/agents/opportunities/route.ts` (97 lines)

Generic opportunities endpoint using `opportunityDiscoveryEngine` (not RFx-specific). Pulls from `agentEvent` records with `eventType='opportunity_discovered'`.

### 3.6 Missing/Stub Routes

- **No `/api/rfx/` standalone routes** — All RFx operations go through agent-prefixed APIs
- **`analytical-intelligence.service.ts`** has a stub: `triggerRfxGeneration: async (renewalId: string) => ({ rfxId: '' })` — returns empty string

---

## 4. UI Components

**All UI lives in:** `apps/web/app/contigo-labs/page.tsx` (4,418 lines)

### 4.1 `RFxStudioView` (line 2248)

The main RFx interface, rendered when the user navigates to `/contigo-labs?tab=rfx-studio`.

**State management:** Local React state (no global store). Fetches from 3 APIs on mount:
1. `GET /api/agents/rfx-opportunities` → opportunities
2. `GET /api/requests` → RFx events (falls back to hardcoded demo data)
3. `GET /api/analytics/suppliers?timeframe=12months` → vendor data (falls back to hardcoded)

**Header section:**
- Gradient card (violet/purple/indigo)
- "Scout Opportunities" button → triggers `POST /api/agents/rfx-opportunities` detection
- "New RFx" button → opens CreateRFxModal
- 5 stat badges: Opportunities count, Active RFx, Completed, Vendors, Savings %

**5 sub-tabs:**

| Tab | Component | Description |
|-----|-----------|-------------|
| `opportunities` (default) | Inline + `OpportunityCardEnhanced` | Filter bar (search, algorithm, urgency) + opportunity cards with "Start RFx" / snooze / dismiss |
| `events` | Inline + `RFxEventRowEnhanced` | Timeline summary (draft/active/evaluating/completed counts + pipeline value), clickable event rows |
| `templates` | `AITemplateStudio` | Template library + AI generator + importer + builder + preview modes |
| `vendors` | Inline + `VendorCard` | Vendor directory with ratings, completed RFx, avg savings, response rate, "Invite Vendor" stub |
| `analytics` | Inline | Savings by category bars, RFx performance grid (avg vendor rating, response rate, savings %, days to award), recent awards list |

### 4.2 `CreateRFxModal` (line ~2910)

3-step wizard modal:

| Step | Fields |
|------|--------|
| 1. Basic Details | Title, Type (RFP/RFQ/RFI radio cards), Description |
| 2. Requirements & Timeline | Estimated Value, Response Deadline, Standard Requirements checkboxes (Technical, Commercial, SLA, Security & Compliance) |
| 3. Vendor Selection | Multi-select vendor list from directory with preferred badges |

**Submit behavior:** Currently shows toast `"RFx creation is being finalized — full submission coming soon"` — **does NOT call any API**. Has an "Advanced Mode" button linking to `/requests`.

### 4.3 `EventDetailModal` (line ~3186)

Shows RFx event details:
- 5-stage timeline: Draft → Published → Bids Due → Evaluation → Award (with progress indicators)
- Stats grid: Estimated Value, Invited Vendors, Bids Received, Projected Savings
- Action buttons: View Documents, Message Vendors, Compare Bids (all are stubs — link to `/requests/${event.id}`)

### 4.4 `AITemplateStudio` (line 856)

Multi-mode template management system:

| Mode | Description |
|------|-------------|
| `library` | Searchable/filterable grid of 8 pre-loaded templates (IT Services RFP, Software Licensing RFQ, Consulting Services RFI, etc.) with usage counts and avg savings |
| `ai-generate` | `AITemplateGenerator` component — generates templates from natural language prompts |
| `upload` | `TemplateImporter` — imports templates from external sources |
| `builder` | `TemplateBuilder` — visual template editor |
| `preview` | `TemplatePreview` — read-only preview with "Use Template" action |

**Note:** Templates are currently stored in React state only (not persisted to database).

### 4.5 Helper Components

| Component | Purpose |
|-----------|---------|
| `OpportunityCardEnhanced` | Opportunity card with urgency coloring, algorithm icons (Clock/TrendingUp/AlertTriangle/Layers), confidence/savings/days metrics, reasoning box, Start RFx / snooze / dismiss actions |
| `RFxEventRowEnhanced` | Table row showing RFx event with type badge, vendor/bid/deadline stats, value, savings %, status badge |
| `VendorCard` | Vendor card with initial avatar, rating, completed RFx count, avg savings, response rate, "View Profile" stub |
| `StatBadgeWhite` | Translucent stat badge for dark backgrounds |
| `TabButton` | Pill tab button with icon and count badge |
| `EmptyState` | Empty state card with icon, title, description, CTA |

### 4.6 Navigation Integration

**`apps/web/components/layout/EnhancedNavigation.tsx`:**
- "RFx Studio" nav item → `/contigo-labs?tab=rfx-studio`, icon: Gavel, description: "AI-powered sourcing"
- Sub-item: "Scout Opportunities" → `/contigo-labs?tab=rfx-studio`

---

## 5. AI Integration & Agents

### 5.1 Scout — RFx Detection Agent

**File:** `packages/workers/src/agents/rfx-detection-agent.ts` (707 lines)  
**Class:** `RFxDetectionAgent extends BaseAgent`  
**Persona:** Scout (handle: `scout`, avatar: 🎯, tagline: "Opportunity spotter")  
**Cluster:** Oracles

**Capabilities:** `rfx-opportunity-detection`, `contract-renewal-timing`, `savings-opportunity-identification`, `vendor-performance-monitoring`

**Configuration thresholds:**
- `EXPIRY_WARNING_DAYS`: 180
- `EXPIRY_CRITICAL_DAYS`: 90
- `MIN_SAVINGS_PERCENTAGE`: 10
- `MIN_CONTRACT_VALUE`: $50,000
- `PERFORMANCE_THRESHOLD`: 3.0/5.0

**Detection algorithms** (run in parallel via `Promise.allSettled`):

1. **Expiration** — Contracts expiring within 180 days with totalValue ≥ $50K. Skips if renewal already initiated. Urgency: critical (<90d), high (90-180d). Estimates savings from similar past RFx events or defaults to 12%.
2. **Savings** — Compares contract rate to similar completed contracts. Triggers if savings >10%. Confidence scales with number of similar contracts found.
3. **Performance** — Checks obligation issues (overdue/at_risk/breached), health score, vendor performance rating vs. 3.0 threshold.
4. **Consolidation** — Finds 2+ contracts with same supplier. Estimates 8% consolidation savings.

**RFx Type Determination:** RFP if >$500K or high complexity, RFQ if >$100K or medium, else RFI.

**Output:** Prioritized by urgency then savings amount. Generates recommended actions: `create_rfx` for top opportunity, `monitor_market`, `schedule_rfx_reminders`.

### 5.2 Merchant — RFx Procurement Agent

**File:** `packages/workers/src/agents/rfx-procurement-agent.ts` (836 lines)  
**Class:** `RFxProcurementAgent extends BaseAgent`  
**Persona:** Merchant (handle: `merchant`, avatar: 🤝, tagline: "Master negotiator — manages RFx lifecycles")  
**Cluster:** Strategists

**Capabilities:** `rfx-creation`, `vendor-shortlisting`, `bid-comparison`, `award-recommendation`, `negotiation-support`, `savings-analysis`

**5 Actions (via `execute()` switch):**

#### Action 1: `create_rfx`
- Validates title + deadline
- **AI: GPT-4o-mini** generates requirements in JSON mode based on RFx type and description
- Merges AI requirements with any user-supplied requirements
- Generates weighted evaluation criteria (weights adjusted by type: RFQ = commercial-heavy, RFI = technical-heavy)
- Suggests vendors from contract history (`prisma.contract.groupBy` by supplierName)
- **Persists:** `prisma.rFxEvent.upsert()` — creates or updates the RFx event

#### Action 2: `shortlist_vendors`
- Queries `prisma.contract.groupBy` by supplierName for the tenant
- Builds `VendorProfile` objects: pastContracts, riskScore, financialHealth, capacityScore
- Filters by `minPerformance` parameter
- Sorts by total value descending

#### Action 3: `compare_bids`
- Takes `VendorResponse[]` as input
- Calculates composite scores and rankings
- Price analysis: lowest, highest, average, spread
- **AI: GPT-4o-mini** generates recommendation with justification (falls back to highest scorer)

#### Action 4: `recommend_award`
- Wraps `compare_bids` + generates formal award justification document
- **AI: GPT-4o-mini** generates structured justification

#### Action 5: `generate_negotiation`
- Takes vendorName, currentBid, targetPrice, requirements
- **AI: GPT-4o (full model)** generates comprehensive negotiation strategy:
  - Opening position
  - Key levers
  - Concession strategy
  - Walk-away price
  - Counter-offer templates

**Persistence:** `persistRFxEvent()` uses `prisma.rFxEvent.upsert()`, wrapped in try/catch that logs warning if model unavailable (graceful degradation).

### 5.3 AI Model Usage Summary

| Action | Model | Mode |
|--------|-------|------|
| Generate requirements | GPT-4o-mini | JSON mode |
| Compare bids | GPT-4o-mini | JSON mode |
| Award justification | GPT-4o-mini | Text |
| Negotiation strategy | GPT-4o (full) | JSON mode |

### 5.4 Agent Registration

**File:** `packages/workers/src/agents/index.ts`  
Both agents registered in **"Phase 5: RFx Procurement & Detection"** of the agent registry. Exported as named classes and singletons.

---

## 6. Existing Implemented Features

### Fully Implemented (Working Code)

| Feature | Location | Status |
|---------|----------|--------|
| RFx opportunity detection (4 algorithms) | API route + Agent | ✅ Dual implementation |
| Opportunity listing with filtering | API GET + UI | ✅ |
| Opportunity actions (accept/reject/snooze) | API PATCH | ✅ |
| Opportunity-to-RFx conversion | API PATCH + Prisma transaction | ✅ |
| RFx event creation via agent | Merchant agent `create_rfx` | ✅ |
| AI requirement generation | Merchant agent + OpenAI | ✅ |
| Vendor shortlisting | Merchant agent | ✅ |
| Bid comparison + scoring | Merchant agent | ✅ |
| Award recommendation | Merchant agent | ✅ |
| Negotiation strategy generation | Merchant agent + GPT-4o | ✅ |
| Chat @mention routing | Chat API | ✅ |
| RFx Studio 5-tab UI | Contigo Labs page | ✅ |
| Agent status + opportunity stats | Status API + SSE | ✅ |
| Template library (8 static templates) | AITemplateStudio | ✅ (in-memory only) |
| Pending approvals count | Status API | ✅ |

### Partially Implemented (Stub/Incomplete)

| Feature | Location | Status |
|---------|----------|--------|
| CreateRFxModal submission | contigo-labs/page.tsx | ⚠️ Toast only — no API call |
| EventDetailModal actions | contigo-labs/page.tsx | ⚠️ Stub buttons (View Documents, Message Vendors, Compare Bids) |
| Vendor invitation | VendorCard | ⚠️ Toast "coming soon" |
| Template persistence | AITemplateStudio | ⚠️ React state only, no DB |
| Export report | RFxStudioView | ⚠️ Toast "Export started", no actual export |
| `triggerRfxGeneration()` | analytical-intelligence.service.ts | ⚠️ Returns `{ rfxId: '' }` |
| `VendorCard` "View Profile" | contigo-labs/page.tsx | ⚠️ No-op button |

### Not Implemented (Roadmap Only)

| Feature | Roadmap Phase |
|---------|---------------|
| Market intelligence / price benchmarking | Phase 2 |
| What-If scenario analysis | Phase 2 |
| Monte Carlo risk simulation | Phase 2 |
| AI-powered negotiation UI (counter-offer generation) | Phase 3 |
| Multi-party auction mode | Phase 3 |
| Supplier portal (external access) | Phase 4 |
| E-signature integration (DocuSign/Adobe) | Phase 4 |
| Blockchain audit trail | Phase 4 |
| Agent collaboration visualization | Platform enhancement |

---

## 7. Contract & Ecosystem Integration

### 7.1 Contract Model Integration

**Scout agent** queries the `Contract` model directly:
- `prisma.contract.findMany()` with filters: `tenantId`, `status` (ACTIVE/EXECUTED), `expirationDate`, `totalValue`
- `prisma.contract.groupBy()` by `supplierName` for consolidation detection
- Joins with `contract.clauses` when creating RFx from opportunity

**Merchant agent** queries:
- `prisma.contract.groupBy()` by `supplierName` for vendor shortlisting
- Uses contract history (past contracts, total value) to build vendor profiles

### 7.2 Risk Detection Integration

The performance detection algorithm queries `prisma.riskDetectionLog`:
- Filters: `tenantId`, `acknowledged: false`, `severity: HIGH/CRITICAL`
- Risk types: `PERFORMANCE_ISSUE`, `DELIVERY_RISK`, `QUALITY_ISSUE`
- Includes parent `contract` for context

### 7.3 Knowledge Graph (Neo4j)

**File:** `packages/data-orchestration/src/services/graph/neo4j-graph.service.ts`

Node types include `'rfx'` and `'bid'`. Relationship types include `'competes_with'`, `'bid_on'`, `'awarded_to'`. This indicates planned graph-based RFx analytics but the integration between the graph service and the RFx agents is not wired up.

### 7.4 Contract Type Profiles

**File:** `packages/workers/src/contract-type-profiles.ts`

Two RFx-specific profiles:
- `REQUEST_FOR_PROPOSAL` (line 3012) — Classification keywords: rfp, proposal, tender, bidding
- `REQUEST_FOR_QUOTE` (line 3540) — Classification keywords: rfq, quote, pricing, bid

These profiles are used by the document classification system to identify RFx documents uploaded to the platform.

### 7.5 Procurement Analytics

**File:** `apps/web/lib/ai/chat/procurement-analytics.ts` (360 lines)

Functions providing supporting procurement intelligence:
- `getSpendAnalysis()` — Category-level spend data
- `getCostSavingsOpportunities()` — Cost reduction candidates
- `getTopSuppliers()` — Supplier rankings
- `getRiskAssessment()` — Supplier risk profiles
- `getAutoRenewalContracts()` — Auto-renewal detection
- `getCategorySpend()` — Category spend breakdown

These are accessed via the chat intent detection system (intent type: `'procurement'`).

### 7.6 Approval Workflow

The `ApprovalAction` model supports `approvalType: 'rfx_award'` for human-in-the-loop award decisions. The status API counts RFx events with status `'awaiting_approval'` for the pending approvals badge.

---

## 8. Documentation & Roadmap

### 8.1 `RFx_ENHANCEMENT_ROADMAP.md` (993 lines)

A comprehensive 4-phase enhancement roadmap:

| Phase | Timeline | Key Features |
|-------|----------|-------------|
| Phase 1: Quick Wins | 2-4 weeks | Smart RFx Triggers (auto detection), Template Library, Supplier Performance Prediction |
| Phase 2: Intelligence | 1-2 months | Market Intelligence, What-If Analysis, Monte Carlo Risk Simulation |
| Phase 3: AI-Powered Negotiation | 2-3 months | Intelligent Counter-Offer Generation, Multi-Party Auction Mode |
| Phase 4: Ecosystem & Integrations | 3-6 months | Supplier Portal, E-Signature Integration, Blockchain Audit Trail |

**Priority matrix highlights:**
- P0: Auto RFx Detection (✅ implemented), Template Library (⚠️ partial)
- P1: Performance Prediction, Market Intelligence, What-If Scenarios
- P2: Negotiation Strategy (✅ agent implemented, ❌ UI not built), Supplier Portal, E-Signature
- P3: Auction Mode, Blockchain

### 8.2 `RFx_UI_BEHAVIOR_SPEC.md` (525 lines)

Defines a 6-phase UI workflow with **5 Human-in-the-Loop (HITL) checkpoints**:

| Phase | HITL Checkpoint | Status |
|-------|-----------------|--------|
| 1. RFx Creation | User reviews AI-generated requirements | ⚠️ Agent supports it, UI modal incomplete |
| 2. Vendor Shortlisting | User approves/modifies shortlist | ❌ No UI |
| 3. Bid Collection | Background (no HITL) | ❌ No UI |
| 4. Bid Comparison | User reviews scoring matrix | ❌ No UI |
| 5. Award Recommendation | **Critical HITL** — User approves/rejects award | ⚠️ Approval model exists, no dedicated UI |
| 6. Negotiation Support | User guides negotiation with AI assistance | ❌ No UI |

**Entry points defined:**
1. Approval Queue → Navigate to pending RFx
2. Contract Page → "Create RFx" button
3. Chat → `@Merchant` mention

---

## 9. Configuration & Feature Flags

### Environment Variables (`.env.example`, lines 540-544)

```env
# RFx Procurement Agent Configuration
RFX_AGENT_ENABLED="true"
RFX_DEFAULT_DEADLINE_DAYS="14"
RFX_MIN_BID_COMPARE="2"
```

| Variable | Default | Description |
|----------|---------|-------------|
| `RFX_AGENT_ENABLED` | `"true"` | Master toggle for RFx agent functionality |
| `RFX_DEFAULT_DEADLINE_DAYS` | `"14"` | Default response deadline for new RFx events |
| `RFX_MIN_BID_COMPARE` | `"2"` | Minimum bids required for comparison |

**Note:** These env vars are defined in `.env.example` but are **not referenced** in the agent code — the Merchant agent currently hardcodes its own logic. This is an integration gap.

---

## 10. Implementation Status Matrix

| Component | Files | Lines | Impl Status | Notes |
|-----------|-------|-------|-------------|-------|
| **Database Schema** | schema.prisma | ~140 | ✅ Complete | 2 models, 8 indexes |
| **Scout Agent** | rfx-detection-agent.ts | 707 | ✅ Complete | 4 detection algorithms |
| **Merchant Agent** | rfx-procurement-agent.ts | 836 | ✅ Complete | 5 actions, OpenAI integration |
| **API - Opportunities** | rfx-opportunities/route.ts | 742 | ✅ Complete | GET/POST/PATCH, Zod validation |
| **API - Chat routing** | agents/chat/route.ts | 608 | ✅ Complete | @merchant, @scout |
| **API - Status** | agents/status/route.ts | 451 | ✅ Complete | Stats, quick actions |
| **UI - RFxStudioView** | contigo-labs/page.tsx | ~800 | ✅ Complete | 5 tabs, filters, fallbacks |
| **UI - CreateRFxModal** | contigo-labs/page.tsx | ~200 | ⚠️ Partial | No API submission |
| **UI - EventDetailModal** | contigo-labs/page.tsx | ~150 | ⚠️ Partial | Stub action buttons |
| **UI - AITemplateStudio** | contigo-labs/page.tsx | ~200 | ⚠️ Partial | In-memory only |
| **Navigation** | EnhancedNavigation.tsx | ~10 | ✅ Complete | Nav items wired |
| **Agent Personas** | agent-personas.ts | ~20 | ✅ Complete | Scout + Merchant defined |
| **Contract Type Profiles** | contract-type-profiles.ts | ~100 | ✅ Complete | RFP + RFQ profiles |
| **Knowledge Graph** | neo4j-graph.service.ts | ~5 | ⚠️ Stub | Types defined, not wired |
| **Env Configuration** | .env.example | 5 | ⚠️ Stub | Defined but not consumed |

**Approximate total implemented code:** ~4,000 lines across 10+ files.

---

## 11. Gaps & Recommendations

### Critical Gaps

1. **CreateRFxModal doesn't submit** — The 3-step wizard collects all necessary data but only shows a toast. Wire it to `POST /api/agents/rfx-opportunities` with `action: 'create_rfx'` or call the Merchant agent's `create_rfx` action directly.

2. **Dual detection algorithm implementations** — The API route (`rfx-opportunities/route.ts`) re-implements all 4 detection algorithms independently from the Scout agent (`rfx-detection-agent.ts`). These should be consolidated to avoid divergence. The API route algorithms are more complete (Prisma Decimal handling, better error handling), so consider making the agent delegate to the API or extracting shared detection logic.

3. **Environment variables not consumed** — `RFX_AGENT_ENABLED`, `RFX_DEFAULT_DEADLINE_DAYS`, `RFX_MIN_BID_COMPARE` are defined but not consumed by any code. Wire them into agent/API behavior.

4. **No HITL UI for phases 2-6** — The spec doc defines 5 HITL checkpoints but only phase 1 (creation) has any UI, and that UI doesn't submit. Phases 2-6 (shortlisting review, bid comparison, award approval, negotiation) have agent backend support but zero UI.

5. **Template persistence** — The 8 templates in `AITemplateStudio` are hardcoded in React state. No Prisma model exists for RFx templates. Need a `RFxTemplate` model and CRUD API.

### Medium Priority

6. **No dedicated RFx detail page** — EventDetailModal links to `/requests/${event.id}` but there's no evidence this route handles RFx events specifically. Consider a dedicated `/contigo-labs/rfx/[id]` page.

7. **Knowledge graph unused** — Neo4j graph types for `'rfx'` and `'bid'` are defined but never populated. Wire RFx events and bid submissions to create graph nodes/edges.

8. **`triggerRfxGeneration` stub** — The analytical intelligence service returns `{ rfxId: '' }`. Either implement or remove the stub to avoid confusion.

9. **Vendor data fallbacks** — The `RFxStudioView` uses extensive hardcoded fallback data when APIs return empty. This is fine for demo but should be clearly flagged or removed for production.

### Low Priority

10. **Export functionality** — "Export Report" button shows toast only. Implement CSV/PDF export of RFx events.

11. **Vendor profile page** — "View Profile" button on VendorCard is a no-op. Consider linking to a vendor detail view.

12. **Procurement analytics integration** — The 6 procurement analytics functions in `procurement-analytics.ts` could feed the RFx Studio analytics tab instead of computing analytics from in-memory event data.

---

*End of report.*
