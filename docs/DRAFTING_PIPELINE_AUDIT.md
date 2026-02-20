# Drafting Agentic System — Comprehensive Pipeline Audit

> **Scope:** Full audit of the contract drafting pipeline from user intent to final document.  
> **Codebase:** Next.js 15 monorepo (`/workspaces/CLI-AI-RAW`)  
> **Date:** 2025  
> **Auditor:** AI Architecture Review  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Capabilities — Backend](#2-current-capabilities--backend)
3. [Current Capabilities — UI/UX](#3-current-capabilities--uiux)
4. [End-to-End Flow Analysis](#4-end-to-end-flow-analysis)
5. [Critical Gaps & Issues](#5-critical-gaps--issues)
6. [Area Scoring (1–5)](#6-area-scoring-15)
7. [Recommendations](#7-recommendations)

---

## 1. Executive Summary

The ConTigo drafting pipeline is an **ambitious, largely implemented** system spanning three distinct entry points (Document Studio, Copilot Canvas, AI Draft Assistant), a rich service layer (OpenAI GPT-4o/4o-mini, RAG hybrid search, pgvector clause library matching), and a well-designed Prisma data model. The **CopilotDraftingCanvas** is the primary production-grade editor with real API integration. However, significant gaps exist in **draft finalization**, **document export from the editor**, **real-time collaboration**, and **comment/version APIs**. A parallel "SmartDraftingCanvas" uses entirely mocked data and appears to be a legacy prototype.

**Overall Maturity: 3.4 / 5** — Strong foundation with clear production-blocking gaps.

---

## 2. Current Capabilities — Backend

### 2.1 AI Contract Generation Service

**File:** `packages/data-orchestration/src/services/contract-generation.service.ts` (962 lines)

| Capability | Status | Details |
|---|---|---|
| Contract type detection | ✅ Implemented | 16 types: MSA, SOW, NDA, SaaS, Employment, Consulting, License, Lease, Vendor, Partnership, Amendment, Addendum, LOI, MOU, DPA, Custom |
| NL prompt → contract | ✅ Implemented | `analyzePrompt()` (GPT-4o-mini) → `generateContractContent()` (GPT-4o, temp=0.3) |
| Template-based generation | ✅ Implemented | `generateFromTemplate()` with variable substitution, clause library integration |
| Single clause generation | ✅ Implemented | `generateClause()` for on-demand clause authoring |
| Multi-language translation | ✅ Implemented | `translateContract()` — 11 languages (DE, FR, ES, IT, PT, NL, PL, ZH, JA, KO, AR) |
| Compliance mapping | ✅ Defined | GDPR, CCPA, SOX, HIPAA, PCI-DSS requirement structures mapped per type |
| Template structures | ✅ Defined | `MSA_TEMPLATE`, `SOW_TEMPLATE`, `NDA_TEMPLATE`, `SAAS_TEMPLATE`, `EMPLOYMENT_TEMPLATE` with section/clause breakdowns |
| Alternative versions | ✅ Typed | Types for generating conservative/balanced/aggressive contract alternatives |

**Key observation:** The generation pipeline is the most complete part of the backend. Prompt analysis uses gpt-4o-mini for speed, then routes to gpt-4o for full generation with structured output.

### 2.2 AI Copilot Service

**File:** `packages/data-orchestration/src/services/ai-copilot.service.ts` (1077 lines)

| Capability | Status | Details |
|---|---|---|
| Real-time clause suggestions | ✅ Implemented | `generateClauseSuggestions()` — 4-stage pipeline: clause library → playbook → AI → missing clauses |
| Vector-enhanced matching | ✅ Implemented | pgvector HNSW cosine similarity on `ContractEmbedding` table with Jaccard fallback |
| Playbook integration | ✅ Implemented | `matchPlaybook()` with preferred language matching and fallback negotiation positions |
| Risk detection (pattern) | ✅ Implemented | 8 regex-based risk patterns: unlimited liability, broad indemnity, unilateral termination, full IP assignment, perpetual irrevocable, broad waiver, sole remedy, ambiguous efforts |
| Risk detection (AI) | ✅ Implemented | `analyzeRisksWithAI()` using gpt-4o-mini for complex risk patterns beyond regex |
| Playbook risk thresholds | ✅ Implemented | Monetary threshold checks (e.g., liability cap below playbook minimum) |
| Auto-completions | ✅ Implemented | 3-source pipeline: library → historical (pgvector) → AI fallback; returns up to 5 |
| Negotiation insights | ✅ Implemented | `getNegotiationInsights()` — counterparty pattern analysis, position strength scoring |
| Missing clause detection | ✅ Implemented | Checks for governing law, dispute resolution, force majeure, confidentiality |
| Contextual tips | ✅ Implemented | Legal writing tips (e.g., "shall" vs "will", readability suggestions) |
| Suggestion ranking | ✅ Implemented | Priority: playbook > clause_library > regulatory > ai_generated/historical |

### 2.3 API Routes — Drafts CRUD

**File:** `apps/web/app/api/drafts/route.ts` (182 lines)

| Endpoint | Method | Status | Details |
|---|---|---|---|
| `/api/drafts` | GET | ✅ | Filters by status, type, sourceType; pagination; includes template/sourceContract/user relations; returns metrics grouped by status |
| `/api/drafts` | POST | ✅ | Creates `ContractDraft` with full field set: title, type, sourceType, templateId, content, clauses, variables, structure, AI metadata |
| `/api/drafts/[id]` | GET | ✅ | Single draft with includes |
| `/api/drafts/[id]` | PATCH | ✅ | Update with **locking mechanism** (`isLocked`, `lockedBy`, `lockedAt`), **version increment** on content changes |
| `/api/drafts/[id]` | DELETE | ✅ | Blocks deletion of FINALIZED drafts |

### 2.4 API Routes — Copilot

| Endpoint | Method | Status | Details |
|---|---|---|---|
| `/api/copilot` | POST | ✅ | Two modes: **"realtime"** → `AICopilotService.getSuggestions()`, **"assist"** → direct OpenAI + RAG context from `hybridSearch` |
| `/api/copilot/complete` | POST | ✅ | Delegates to `AICopilotService.getAutoCompletions()` |
| `/api/copilot/risks` | POST | ✅ | Delegates to `AICopilotService.detectRisks()`; returns categorized risk counts (critical/high/medium/low) |

**File:** `apps/web/app/api/copilot/route.ts`

Notable: The assist mode builds a rich system prompt with contract type context, counterparty info, negotiation rules, and includes RAG results. Errors from RAG are silently caught (`catch { // RAG unavailable }`).

### 2.5 API Routes — AI Draft Generation

**File:** `apps/web/app/api/ai/generate/draft/route.ts` (~130 lines)

| Input | Details |
|---|---|
| `templateId` | Optional — fetches `ContractTemplate` from DB |
| `contractType` | Required — maps to type-specific prompt |
| `variables` | Optional — `{{key}}` substitution context |
| `clauses` | Optional — fetches `ClauseLibrary` entries by IDs |
| `tone`, `jurisdiction`, `additionalInstructions` | Customization parameters |

Output: HTML + plainText + metadata via GPT-4o (temp=0.3).

### 2.6 Template Engine

**File:** `apps/web/lib/templates/template-engine.ts` (789 lines) — Singleton

| Capability | Status |
|---|---|
| Variable substitution (`{{variable}}`) | ✅ |
| Conditionals (`{{#if}}...{{/if}}`) | ✅ |
| Loops (`{{#each}}...{{/each}}`) | ✅ |
| Partial templates (`{{>partial}}`) | ✅ |
| Clause library section integration | ✅ |
| Table of contents generation | ✅ |
| Signature block generation | ✅ |
| Multi-format output (html, text, ooxml, docx) | ✅ Defined |
| Variable validation (min/max, patterns) | ✅ |

### 2.7 Clause Infrastructure

| Component | File | Status |
|---|---|---|
| Clause-level extraction | `clause-level-extraction.service.ts` (947 lines) | ✅ 27 clause types with regex + hierarchical detection + cross-references + risk per clause |
| Template learning | `contract-template-learning.service.ts` (619 lines) | ✅ Pattern discovery, template matching, field mapping, confidence scoring |
| Clause library API | `/api/word-addin/clauses/route.ts` | ✅ CRUD for clause library |
| Clause governance | `/api/clauses/governance/route.ts` | ✅ Clause approval workflow |
| Clause versioning | `/api/clauses/versions/route.ts` | ✅ Clause version management |

### 2.8 Templates API

| Endpoint | File | Status |
|---|---|---|
| CRUD | `/api/templates/route.ts`, `/api/templates/[id]/route.ts` | ✅ |
| Import | `/api/templates/import/route.ts` | ✅ |
| Export | `/api/templates/[id]/export/route.ts` | ✅ |
| Duplicate | `/api/templates/[id]/duplicate/route.ts` | ✅ |
| Favorite | `/api/templates/[id]/favorite/route.ts` | ✅ |
| Sync | `/api/templates/[id]/sync/route.ts` | ✅ |
| Variables | `/api/templates/[id]/variables/route.ts` | ✅ |

### 2.9 Streaming Tools (AI Chat Integration)

**File:** `apps/web/lib/ai/streaming-tools.ts` (1747 lines)

- `create_contract` tool: Creates a **`Contract`** record (not `ContractDraft`) via Prisma with DRAFT status. Returns navigation URL.
- `update_contract` tool: Updates existing Contract records.
- Additional tools: `search_contracts`, `get_contract_details`, `list_expiring_contracts`, `get_spend_analysis`, `get_risk_assessment`, workflow tools, intelligence tools.

⚠️ **Architecture inconsistency:** The chat's `create_contract` creates a `Contract` record, while the drafting UI creates a `ContractDraft` record. These are separate tables with no bridging (see §5.1).

### 2.10 Database Schema

**`ContractDraft` model** (`packages/clients/db/schema.prisma` ~L1188):

```
id, tenantId, templateId, title, type, sourceType, content (Text), clauses (Json),
variables (Json), structure (Json), status (DRAFT|IN_REVIEW|PENDING_APPROVAL|APPROVED|REJECTED|FINALIZED),
version, isLocked/lockedBy/lockedAt, estimatedValue, currency, startDate, endDate,
renewalDate, externalParties (Json), aiPrompt, aiModel, generationParams (Json),
currentStep, completionPercent, approvalWorkflow (Json)
```

**`ContractTemplate` model** (~L1155): `name, description, category, clauses (Json), structure (Json), metadata (Json), version, isActive, parentId, usageCount, lastUsedAt`

---

## 3. Current Capabilities — UI/UX

### 3.1 Document Studio Hub (`/drafting`)

**File:** `apps/web/app/drafting/page.tsx` (990 lines)

| Feature | Status | Notes |
|---|---|---|
| Hero section with gradient banner | ✅ Polished | Gradient purple-blue, rotating icon animations |
| Stats dashboard | ✅ Implemented | Total drafts, in-progress, from templates, AI-generated, templates available |
| AI Quick Generate | ✅ Implemented | Text input with suggestion chips (NDA, MSA, SOW, Employment, Partnership, SLA); navigates to `/drafting/copilot?prompt=...` |
| Quick Start cards | ✅ Implemented | 6 templates (NDA, MSA, SOW, Employment, Lease, Vendor) with icons; navigate to `/drafting/copilot?template=id&name=...` |
| "My Drafts" tab | ✅ Implemented | Fetches from `/api/drafts`; shows status badges (DRAFT/IN_REVIEW/etc.); edit/delete/duplicate actions |
| "Templates" tab | ✅ Implemented | Uses `useTemplates()` hook (React Query); grid display with usage counts; "Use Template" buttons |
| "AI Capabilities" tab | ✅ Implemented | Marketing-style showcase of AI features (generation, copilot, risk, negotiation, compliance, multi-language) |
| Draft deletion | ✅ Implemented | DELETE `/api/drafts/[id]` with confirmation toast |
| Draft duplication | ✅ Implemented | Fetches draft, creates new draft via POST with "(Copy)" suffix |
| Empty states | ✅ Implemented | Illustrations + CTAs for when no drafts/templates exist |
| Dark mode | ✅ Full | Consistent `dark:` classes throughout |
| Responsive | ✅ Implemented | Grid breakpoints (1/2/3 col), mobile-friendly stat cards |
| Framer Motion animations | ✅ Implemented | `staggerChildren`, `fadeInUp` on cards and sections |

### 3.2 Copilot Drafting Canvas (Primary Editor)

**File:** `apps/web/components/drafting/CopilotDraftingCanvas.tsx` (1267 lines)  
**Page:** `apps/web/app/drafting/copilot/page.tsx` (~200 lines)

| Feature | Status | Notes |
|---|---|---|
| **Textarea editor** | ✅ Implemented | Plain `<textarea>` with manual formatting helpers |
| **Markdown preview** | ✅ Implemented | Toggle between edit/preview; renders bold, italic, headings, lists, quotes via regex-to-HTML |
| **AI Suggestions** | ✅ Real API | `fetchSuggestions()` → POST `/api/copilot`; apply or dismiss per suggestion; debounced 2s after typing stops |
| **Auto-completion popup** | ✅ Real API | `fetchAutoCompletions()` → POST `/api/copilot/complete`; keyboard nav (↑↓, Tab/Enter accept, Esc dismiss); source badges (🔒 Library / 📚 Historical / ✨ AI) |
| **Risk detection** | ✅ Real API | `fetchRisks()` → POST `/api/copilot/risks` every 30s; summary grid (critical/high/medium/low counts); risk list with severity badges |
| **AI Assist** | ✅ Real API | Free-text prompt → POST `/api/copilot` with mode="assist"; prepends AI response to content |
| **Auto-save** | ✅ Implemented | Every 60s when content changes; calls `onSave(content)` |
| **Undo/Redo** | ✅ Implemented | Manual stack (50 levels) with Ctrl+Z/Ctrl+Y keyboard shortcuts |
| **Formatting toolbar** | ✅ Implemented | Bold, Italic, Underline, H1, H2, List, Quote buttons with markdown insertion |
| **Sidebar — Copilot tab** | ✅ Implemented | Risk summary, suggestion list with apply/dismiss, risk detail list |
| **Sidebar — Comments tab** | ⚠️ Empty shell | Input field exists but no API for comment CRUD; always shows empty state |
| **Sidebar — Versions tab** | ⚠️ Empty shell | Version list area but no API for version history retrieval; always shows empty state |
| **Mobile drawer** | ✅ Implemented | Sheet/drawer sidebar on mobile breakpoints |
| **Save button** | ✅ Implemented | Delegates to `onSave` → PATCH `/api/drafts/[id]` or POST `/api/drafts` |
| **Dark mode** | ✅ Full | Complete dark mode support |
| **ARIA** | ✅ Partial | Roles on tabs, toolbar, editor, radiogroup, listbox |
| **Draft ID URL management** | ✅ Implemented | After initial save, URL updated to include `?draft=id` without reload |

**Editor limitations:** Plain `<textarea>` — no rich text (WYSIWYG), no inline clause tagging, no cursor-position-aware inline suggestions, no track changes. The preview mode is read-only HTML rendered via `dangerouslySetInnerHTML`.

### 3.3 Smart Drafting Canvas (Legacy/Prototype)

**File:** `apps/web/components/drafting/SmartDraftingCanvas.tsx` (782 lines)

| Feature | Status | Notes |
|---|---|---|
| Content editing | ⚠️ Mock | Uses `contentEditable` div; hardcoded initial MSA content |
| AI assistance | ❌ Mock | `handleAIAssist` is a no-op: clears prompt and closes panel (`// Mock AI assistance`) |
| Collaborators | ❌ Mock | Hardcoded array: `[{ name: 'Sarah Chen', avatar: '...', ... }]` |
| Comments | ❌ Mock | Hardcoded `mockComments` array |
| Suggestions | ❌ Mock | Hardcoded `mockSuggestions` array |
| Version history | ❌ Mock | Hardcoded `mockVersions` array |

**Verdict:** This component should either be removed or clearly marked as demo-only. It is exported from `components/drafting/index.ts` alongside `CopilotDraftingCanvas` and could be accidentally used.

### 3.4 AI Draft Assistant (Chat-based Drafting)

**File:** `apps/web/components/contracts/AIDraftAssistant.tsx` (732 lines)  
**Page:** `apps/web/app/contracts/ai-draft/page.tsx`

| Feature | Status | Notes |
|---|---|---|
| Conversational UI | ✅ Implemented | Chat message interface with user/assistant bubbles |
| Prompt suggestions | ✅ Implemented | 6 pre-built prompts (NDA, software dev, consulting, employment, SLA, partnership) |
| AI generation | ⚠️ Partial | Calls `/api/ai/generate/draft`; falls back to `generateMockDraft()` on error |
| Draft preview panel | ✅ Implemented | Shows title, type, parties, key terms, suggested clauses |
| Save to drafts | Needs verification | References saving flow |
| Export/download | Needs verification | Download icon visible in imports |

**Key issue:** The `catch` block falls back to a fully mocked `generateMockDraft()` function that returns hardcoded content. In production, API failures would present users with obviously fake data.

### 3.5 Word Add-in Integration

**Files:** `apps/word-addin/` (separate app package)

| Feature | Status | Notes |
|---|---|---|
| Template-based generation | ✅ Implemented | `apiClient.generateContract()` → `/api/word-addin/generate` |
| Clause library panel | ✅ Implemented | Browse and insert clauses from shared library |
| Draft management panel | ✅ Exists | `DraftsPanel.tsx` |
| OOXML output | ✅ Implemented | Server generates Office Open XML for native Word insertion |

### 3.6 Navigation Integration

**File:** `apps/web/components/layout/EnhancedNavigation.tsx` (L114)

The main nav includes: `{ name: 'Drafting', href: '/drafting', icon: PenTool, description: 'AI-assisted contract drafting' }` — properly integrated into app navigation.

---

## 4. End-to-End Flow Analysis

### 4.1 Flow A: Document Studio → Copilot Canvas (Primary Happy Path)

```
User lands on /drafting (Document Studio)
  ├── "AI Quick Generate" → enters prompt → navigates to /drafting/copilot?prompt=<encoded>
  ├── "Quick Start" card → navigates to /drafting/copilot?template=<id>&name=<name>
  ├── "My Drafts" → Edit → navigates to /drafting/copilot?draft=<id>
  └── "Templates" → Use Template → navigates to /drafting/copilot?template=<id>&name=<name>

/drafting/copilot page loads:
  ├── Reads query params: mode, template, name, draft
  ├── Dynamically imports CopilotDraftingCanvas (SSR disabled)
  └── Passes onSave callback that POSTs/PATCHes to /api/drafts

CopilotDraftingCanvas:
  ├── User types → debounced fetchSuggestions() (2s) → /api/copilot
  ├── Each keystroke → may trigger fetchAutoCompletions() → /api/copilot/complete
  ├── Every 30s → fetchRisks() → /api/copilot/risks
  ├── AI Assist button → free-text prompt → /api/copilot (mode=assist)
  ├── Auto-save every 60s → onSave(content)
  └── Manual save → onSave(content)

onSave flow:
  ├── First save: POST /api/drafts → gets draft ID → updates URL
  └── Subsequent: PATCH /api/drafts/<id> → version incremented
```

**Status: ✅ Connected end-to-end** — from landing page to editor to persistent storage.

**BREAK POINT: ❌ Draft → Final Contract.** There is no "Finalize" or "Convert to Contract" flow. The `ContractDraft` status field supports `FINALIZED`, but no API endpoint transitions a draft to a `Contract` record. Users can edit drafts indefinitely but never produce a final contract from the drafting pipeline.

### 4.2 Flow B: AI Draft Assistant (Chat-based)

```
/contracts/ai-draft page loads:
  └── Renders AIDraftAssistant chat component

User types or selects prompt suggestion:
  ├── POST /api/ai/generate/draft → returns HTML/plainText/metadata
  ├── On error → falls back to generateMockDraft() ⚠️
  └── Draft displayed in side panel with title, parties, key terms, clauses

User actions on draft:
  ├── Copy to clipboard → ✅
  ├── Save → needs verification (likely POSTs to /api/drafts)
  └── "Open in Editor" → needs verification (should navigate to /drafting/copilot)
```

**Status: ⚠️ Partially connected.** The generation works, but the fallback-to-mock on API error is a production risk. The bridge from this assistant to the Copilot Canvas for further editing is unclear.

### 4.3 Flow C: Word Add-in

```
User opens Word → Contigo panel loads:
  ├── Templates Panel → select template → fill variables → "Generate"
  │     └── POST /api/word-addin/generate → returns OOXML → inserts into Word document
  ├── Clauses Panel → browse clause library → click → insert into document
  └── Drafts Panel → list/manage drafts
```

**Status: ✅ Self-contained flow.** The Word Add-in has its own complete loop from template to generated document in Word. It creates a `ContractDraft` record server-side for tracking.

### 4.4 Flow D: Chat Tool Integration

```
User in main AI chat → asks to create a contract:
  └── streaming-tools.ts → create_contract tool
      └── Creates a Contract record (NOT ContractDraft) with DRAFT status
      └── Returns navigation to /contracts/<id>
```

**Status: ⚠️ Disconnected from drafting pipeline.** This flow completely bypasses the drafting UI and creates a fundamentally different database record.

---

## 5. Critical Gaps & Issues

### 5.1 🔴 CRITICAL: No Draft → Contract Finalization Flow

**Impact:** Drafts can never become contracts.

The `ContractDraft` model has status values up to `FINALIZED`, and the `approvalWorkflow` JSON field exists, but:
- No API endpoint to transition `DRAFT → IN_REVIEW → PENDING_APPROVAL → APPROVED → FINALIZED`
- No API to convert a finalized `ContractDraft` into a `Contract` record
- No UI for the approval workflow
- The `currentStep` and `completionPercent` fields on `ContractDraft` are never written to

### 5.2 🔴 CRITICAL: No Document Export from Drafting Canvas

**Impact:** Users cannot download their drafted contracts.

- The `CopilotDraftingCanvas` has no export/download button
- No endpoint like `/api/drafts/[id]/export` exists
- The template engine supports html/text/ooxml/docx output formats, but these are not wired to the drafting UI
- The platform has artifact export (PDF/DOCX) elsewhere (`report-export.service.ts`), but it's not connected to the drafting canvas

### 5.3 🔴 CRITICAL: `create_contract` Tool Creates Wrong Entity

**Impact:** Data model confusion; contracts created via chat are invisible in drafting pipeline.

- `streaming-tools.ts` `executeCreateContract()` creates a `Contract` record
- The drafting UI creates `ContractDraft` records
- No foreign key or relationship between the two tables
- Users interacting via chat and via drafting UI see different data sets

### 5.4 🟡 HIGH: SmartDraftingCanvas Uses Entirely Mock Data

**Impact:** Risk of shipping a non-functional component.

- **File:** `apps/web/components/drafting/SmartDraftingCanvas.tsx` (L272: `// Mock AI assistance`)
- Exported from barrel file alongside the real `CopilotDraftingCanvas`
- All collaborators, comments, suggestions, and versions are hardcoded arrays
- `handleAIAssist` is a no-op

### 5.5 🟡 HIGH: Comments & Versions Not Wired

**Impact:** Collaboration features are empty shells.

- `CopilotDraftingCanvas` renders a comments tab (L758: placeholder input) and versions tab, but:
  - No `/api/drafts/[id]/comments` endpoint exists
  - No `/api/drafts/[id]/versions` endpoint exists
  - The Prisma schema has no `DraftComment` or `DraftVersion` model
  - Version number increments on PATCH but there's no version history retrieval

### 5.6 🟡 HIGH: Mock Fallback in AIDraftAssistant

**Impact:** API failures show obviously fake data instead of an error.

- **File:** `apps/web/components/contracts/AIDraftAssistant.tsx` (L123–145)
- `generateAIResponse()` catches all fetch errors and falls back to `generateMockDraft()`, which returns hardcoded generic clauses
- Should display an error state instead

### 5.7 🟡 HIGH: XSS Vector in Preview Mode

**Impact:** Potential security vulnerability.

- **File:** `apps/web/components/drafting/CopilotDraftingCanvas.tsx` (L1154)
- `dangerouslySetInnerHTML={{ __html: rendered }}` where `rendered` comes from regex transformation of user-authored content
- No sanitization library (e.g., DOMPurify) applied before injection
- Content can contain arbitrary HTML injected via the editor textarea

### 5.8 🟡 MEDIUM: No Real-Time Collaboration

**Impact:** Only one user can meaningfully edit a draft.

- The platform has WebSocket infrastructure (Socket.IO, separate websocket service) used for contract processing notifications
- The drafting canvas has no mention of WebSocket/SSE for collaborative editing
- The locking mechanism (`isLocked`, `lockedBy`, `lockedAt`) on PATCH provides basic conflict prevention but not concurrent editing
- No CRDT/OT or Yjs integration exists anywhere in the drafting codebase

### 5.9 🟡 MEDIUM: RAG Errors Silently Swallowed

**Impact:** Copilot assist mode may return lower-quality suggestions without user awareness.

- **File:** `apps/web/app/api/copilot/route.ts` — `catch { // RAG unavailable — continue without }`
- When RAG (hybrid search) fails, the copilot proceeds without context, potentially hallucinating more
- No indicator to the user that context retrieval failed

### 5.10 🟢 LOW: Editor Is a Plain Textarea

**Impact:** Subpar editing experience vs. modern contract editors.

- No WYSIWYG; users must know markdown-style formatting
- No inline clause boundaries / annotations
- No cursor-position-aware inline suggestions (suggestions appear in sidebar only)
- No track changes / redline view
- Auto-completion popup position is fixed (below cursor line) — not precisely cursor-following due to textarea limitations

### 5.11 🟢 LOW: No Template Variable Collection UI in Copilot Canvas

**Impact:** Template-based generation doesn't collect required variables interactively.

- When navigating with `?template=<id>`, the canvas opens empty
- No modal or form to collect template variables before generating
- The template engine has validation (min/max length, patterns) but no corresponding UI

---

## 6. Area Scoring (1–5)

| Area | Score | Rationale |
|---|---|---|
| **AI Generation Backend** | ⭐⭐⭐⭐ (4/5) | 16 contract types, multi-model pipeline, template engine, compliance mapping. Missing: generation caching, A/B quality scoring. |
| **AI Copilot Service** | ⭐⭐⭐⭐½ (4.5/5) | Excellent architecture: pgvector + Jaccard fallback, playbook integration, negotiation insights, pattern + AI risk detection. Best-in-class implementation. |
| **Draft CRUD API** | ⭐⭐⭐⭐ (4/5) | Solid REST with locking, versioning, pagination, filtering. Missing: status transition endpoints, version history, comments. |
| **Copilot Canvas UI** | ⭐⭐⭐½ (3.5/5) | Real API integration, auto-save, risk display, auto-completion with keyboard nav. Loses points for plain textarea, no export, empty comments/versions panels. |
| **Document Studio Hub** | ⭐⭐⭐⭐ (4/5) | Polished landing page with stats, AI quick generate, template grid, draft management. Well-designed with animations and responsive layout. |
| **Draft Finalization Flow** | ⭐ (1/5) | Status field exists but no state machine, no approval UI, no "draft → contract" conversion. |
| **Document Export (from editor)** | ⭐ (1/5) | Template engine supports multi-format but nothing is wired to the drafting canvas UI. |
| **Real-Time Collaboration** | ⭐ (1/5) | Basic lock exists; no concurrent editing capability. |
| **SmartDraftingCanvas** | ⭐½ (1.5/5) | Full UI structure but 100% mocked. Useful only as a design reference. |
| **AIDraftAssistant** | ⭐⭐⭐ (3/5) | Working chat interface with real API call, but mock fallback on error and unclear save/edit bridge. |
| **Word Add-in** | ⭐⭐⭐½ (3.5/5) | Self-contained generation loop with OOXML output. Clause library integration. Limited by server-side template generation. |
| **Template Infrastructure** | ⭐⭐⭐⭐ (4/5) | Full CRUD, import/export, duplicate, favorite, sync, variables. Rich engine with conditionals/loops/partials. |
| **Clause Library** | ⭐⭐⭐⭐ (4/5) | CRUD, governance/approval workflow, versioning, vector search, integration across copilot and generation. |
| **Security** | ⭐⭐½ (2.5/5) | Auth required on all routes, tenant isolation, but `dangerouslySetInnerHTML` XSS risk in preview mode. |

**Weighted Overall: 3.4 / 5**

---

## 7. Recommendations

### P0 — Must Fix Before Production

1. **Implement Draft Finalization API** — Status transition machine (`DRAFT → IN_REVIEW → PENDING_APPROVAL → APPROVED → FINALIZED`) with role-based guards. Add `POST /api/drafts/[id]/submit`, `POST /api/drafts/[id]/approve`, `POST /api/drafts/[id]/finalize` endpoints.

2. **Implement Draft → Contract Conversion** — When a draft reaches `FINALIZED`, create a `Contract` record from it (or add a `draftId` FK to `Contract`). Reconcile with the `create_contract` streaming tool to use `ContractDraft` flow.

3. **Add Document Export from Canvas** — Wire the template engine's multi-format output to a download button in `CopilotDraftingCanvas`. Minimum: PDF and DOCX. Endpoint: `GET /api/drafts/[id]/export?format=pdf|docx`.

4. **Sanitize HTML in Preview Mode** — Add DOMPurify before `dangerouslySetInnerHTML` in `CopilotDraftingCanvas.tsx` L1154. Install and call `DOMPurify.sanitize(rendered)`.

5. **Remove Mock Fallback in AIDraftAssistant** — Replace `generateMockDraft()` catch with a proper error state UI. Users should never see fake generated content.

### P1 — High Value

6. **Implement Comments API** — Add `DraftComment` Prisma model and CRUD endpoints. Wire to the existing comment input UI in `CopilotDraftingCanvas`.

7. **Implement Version History API** — Add `GET /api/drafts/[id]/versions` that returns previous versions (stored on each PATCH). Wire to the versions tab.

8. **Deprecate or Gate SmartDraftingCanvas** — Either remove from the barrel export or add a `process.env.ENABLE_LEGACY_CANVAS` guard. Prevent accidental production use.

9. **Unify Chat Tool with Drafting Pipeline** — Modify `create_contract` in streaming-tools.ts to create a `ContractDraft` (not `Contract`) and navigate to `/drafting/copilot?draft=<id>`.

10. **Add Template Variable Collection Modal** — When starting from a template, show a form collecting required variables before generating the initial draft content.

### P2 — Enhancement

11. **Upgrade Editor** — Replace `<textarea>` with a rich text editor (Tiptap, Lexical, or Plate) for WYSIWYG editing, inline clause annotations, and cursor-following completions.

12. **Add RAG Failure Indicator** — When hybrid search fails, show a subtle indicator ("AI suggestions may be less accurate") in the copilot sidebar.

13. **Real-Time Collaboration** — Integrate Yjs or similar CRDT with the WebSocket infrastructure for concurrent multi-user editing.

14. **Draft Analytics** — Track AI suggestion acceptance rates, time-to-completion, most-used templates to improve the copilot service over time.

---

*End of audit.*
