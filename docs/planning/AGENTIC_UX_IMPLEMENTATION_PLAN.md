# Agentic UX / Frontend Implementation Plan

- **Status:** Proposed (2026-08-06)
- **Basis:** UX audit of agentic procurement/contract-management surfaces (Aug 2026). Verified against code, not prior docs.
- **Scope:** `apps/web` frontend + the thin API slices it needs. Backend agent orchestration, model routing, and knowledge-graph work are explicitly **out of scope** (covered by `docs/agents/AGENTIC_ECOSYSTEM_IMPROVEMENT_PLAN.md`).

## Problem statement

The codebase has **more agentic UX built than surfaced**. Core trust components (approval queue with plan editing, chat with citations/self-critique, observability dashboard, AI-decision audit) exist, but several are unmounted or orphaned, the trust loop is missing evidence display / diffs / undo, agent autonomy settings are decorative, and attention is fragmented across disconnected queues. Users must go to `/contigo-labs` to get agent value instead of agent value coming to them.

## Success metrics (instrument first — see task 1.5)

| Metric | Source | Target |
|---|---|---|
| Human-intervention rate (approvals requested / agent actions) | telemetry | measurable, trend toward roadmap goal of 10% |
| Median approval latency (requested → decided) | telemetry | baseline, then −50% |
| Approval acceptance rate per agent/action | telemetry | drives autonomy graduation (Phase 2) |
| Notification click-through rate | telemetry | baseline, then +30% |
| % of decided approvals where evidence was viewed | telemetry | > 40% |
| Undo usage + post-undo re-approval rate | telemetry | baseline |

---

## Phase 0 — Surface what exists (weeks 1–2)

Principle: **no new components until the existing ones are mounted.**

### 0.1 Mount the agent notification bell in the global nav — S
- `components/ai/AgentNotificationBell.tsx` exists but the nav (`components/layout/EnhancedNavigation.tsx:701`) mounts the generic `components/collaboration/NotificationCenter.tsx`.
- First **verify the SSE endpoint**: `AGENTIC_AI_SYSTEM_AUDIT.md` (Feb 2026) reports `/api/ai/notifications/stream` missing → bell silently falls back to polling. Either create the route or repoint the bell at the existing `/api/agents/sse`.
- Merge system + agent notifications into one bell panel (tabs or type filter), keeping collaboration notifications intact.
- **Acceptance:** agent events (`approval_required`, `opportunity`) appear in the global nav bell within 5s on any page; click deep-links to the relevant queue item; no duplicate bells.

### 0.2 Un-orphan the observability dashboard — S
- `components/agents/AgentObservabilityDashboard.tsx` is mounted only at the unlinked route `app/(dashboard)/agents/observability/page.tsx`; no entry in `EnhancedNavigation.tsx` (verified) or Contigo Labs.
- Add an "Observability" tab to `app/contigo-labs/page.tsx` and a nav entry under Platform.
- **Acceptance:** reachable in ≤2 clicks from nav and Labs; existing live-mode polling still works.

### 0.3 Mount the proactive widgets — S
- `components/ai/PredictiveInsightsWidget.tsx` and `components/ai/AIActivityFeed.tsx` → default widgets on `app/dashboard/page.tsx` (via the existing `CustomDashboardBuilder` defaults).
- `components/ai/AIDecisionAuditDashboard.tsx` → new route under `app/governance/` (or admin), linked from nav.
- **Acceptance:** all three render with real data; loading/empty states present.

### 0.4 Dead-code sweep — S
- Delete (or move behind a dev-only flag): `app/ui-showcase/`, `app/ui-enhanced/`, `app/ui-features/`, `app/contracts/ContractsPageRefactored.tsx`, orphaned shells (`components/sidebar/Sidebar.tsx`, `components/shell/EnhancedAppShell.tsx`, `components/layout/GlobalHeader.tsx`).
- `components/agents/AgentStatus.tsx`: mount it in the Labs agents roster or delete it.
- Verify zero importers before each deletion (`rg` import graph; GitNexus `detect_changes` before commit per repo policy).
- **Acceptance:** build passes; no route 404s that were previously linked.

---

## Phase 1 — Close the trust loop (sprints 2–4)

### 1.1 Render evidence in the agent approval queue — M
- `AgentApprovalQueue.tsx:116-117` already types `citations`/`evidenceChain` and the API (`app/api/agents/approvals/route.ts:162-163`) already fetches them — they are never rendered.
- Extract a shared `CitationList` component from the chat's `RAGSource` rendering (`components/ai/FloatingAIBubble.tsx:459-488`) so approvals reuse the exact deep-link-to-source-span pattern (`/contracts/{id}?citeStart=…`).
- Render evidence (source spans, contract links, extraction snippets) inside both item types: field writes and goal plans.
- **Acceptance:** every approval item with citations shows clickable source spans that open the contract at the highlighted passage; items without evidence say "no evidence recorded".

### 1.2 Old-vs-new diff for field writes — M (backend touch)
- `AiDecision` (packages/clients/db/schema.prisma:5704) stores proposed `output` but **no previous value** (verified). Add `previousValue Json? @map("previous_value")` via migration.
- Capture the current value at the write gateway when a field write is proposed (before it enters the approval queue). Old decisions will lack snapshots — UI handles that gracefully.
- Render side-by-side old/new in `AgentApprovalQueue` (highlight changed value, format per field type).
- **Acceptance:** new pending writes show before/after; approving applies the new value; regression test on the approvals route.

### 1.3 Undo / revert of applied agent actions — M (depends on 1.2)
- Add `revertedAt DateTime? @map("reverted_at")` to `AiDecision`; extend `outcome` enum usage with `reverted`.
- New endpoint `POST /api/agents/decisions/[id]/revert`: restores `previousValue` to the target field, writes an audit-log entry, marks the decision reverted.
- UI: "Undo" action on applied/auto-applied decisions (inbox item + contract activity), using the existing `toastWithUndo` pattern for the common case.
- **Acceptance:** reverting restores the prior value, is visible in audit logs and the contract's activity view, and cannot be applied twice.

### 1.4 Unified "Needs you" inbox — L
- One queue merging: agent goal approvals, agent field writes, workflow approvals (`SimpleApprovalsQueue`), metadata review exceptions, RFx checkpoints.
- New aggregation endpoint `/api/inbox` (do **not** merge N sources client-side — one server-side query with a common `InboxItem` shape: type, title, risk, value, deadline, deep link, actions).
- Priority sort: risk × value × deadline; type filters; bulk actions for homogeneous items.
- Single badge count in `EnhancedNavigation`; `/approvals` redirect retargeted to `/inbox`.
- **Acceptance:** all five item types appear, are actionable in place, and deep-link correctly; the two legacy queues redirect to the inbox; badge count matches queue length.

### 1.5 UX telemetry baseline — S (do early in Phase 1)
- Emit events: `approval_requested`, `approval_decided` (with latency + outcome + evidence_viewed), `notification_impression`/`notification_click`, `agent_undo_used`, `autonomy_changed`.
- Reuse the existing analytics/monitoring plumbing (`app/monitoring`, sentry) or a minimal `analytics_events` table; a tiny internal dashboard page is enough.
- **Acceptance:** the six success metrics above are queryable; dashboard renders them.

---

## Phase 2 — Real autonomy + inspectability (sprints 4–8)

### 2.1 Wire per-agent autonomy settings — M (backend touch)
- The settings panel at `UnifiedAgentInterface.tsx:1215-1230` is **two decorative checkboxes** (verified: uncontrolled `<input defaultChecked>`); the `AgentConfiguration` type with `autoApprove` + confidence/cost/risk thresholds already exists (lines 143-151).
- New `AgentAutonomyConfig` table: tenant × agent × action-type → mode (`suggest` | `review` | `auto`) + thresholds (reuse the workflow `autoApproveBelow` precedent in `components/workflows/ApprovalTemplates.tsx`).
- Enforce at the write gateway / goal executor: below-threshold + mode=`auto` → apply with `outcome=auto_applied`; else → approval queue.
- UI: per-agent autonomy controls (slider or 3-state) in the Labs agents tab; show current mode as a badge on each agent card.
- **Acceptance:** toggling an agent to `auto` under thresholds measurably reduces its queue items; every auto-applied write carries `previousValue` (so it is revertible, per 1.3).

### 2.2 Graduation nudges — S (depends on 1.5, 2.1)
- Job computes acceptance stats per agent/action (e.g. "you accepted @sage's last 20 rate-anomaly suggestions").
- Inbox/dashboard card: "Automate these? One click." enabling mode=`auto` for that agent+action with the observed thresholds.
- **Acceptance:** nudge appears only after statistically meaningful history (≥10 decisions, ≥90% acceptance); enabling it changes real behavior.

### 2.3 Auto-approval digest — S (depends on 1.3, 2.1)
- Weekly (or on-dashboard) card: "Agents auto-applied N low-risk updates" with per-item revert links.
- **Acceptance:** every auto-applied decision is discoverable and revertible from the digest.

### 2.4 Run inspector — M
- `app/runs/[runId]/run-detail-client.tsx` is a stub (name+status lines). Rebuild on `AgentObservabilityDashboard` components: goal → steps → tool calls (args/results) → artifacts, timings, tokens/cost per step, errors/retries.
- Deep links: approval item → originating goal → run → trace; contract activity → runs that touched it.
- **Acceptance:** from any approval or activity entry, a user can answer "what did the agent do, why, and what did it cost" without leaving the app.

---

## Phase 3 — Convergence (quarter)

### 3.1 Chat ↔ agents — L
- One assistant: `FloatingAIBubble` can dispatch goals (`/api/agents/execute`), shows inline run-progress cards, and renders approve/reject actions for approvals in-stream.
- Merge `@mention` routing from `EmbeddedChatInterface` into the bubble; retire the legacy `DashboardChatbot` route (still on the deprecated endpoint per `CHATBOT_AI_AUDIT.md`).
- **Acceptance:** "ask → dispatch → watch → approve" happens inside one chat surface; duplicate chat implementations removed.

### 3.2 Design-system consolidation (opportunistic, no big bang) — ongoing
- Rule: **any file you touch gets migrated** — to the one sanctioned `DataTable`, a shared `PageShell` (kills the 223 copy-pasted gradient wrappers), and the single contract detail page (`app/contracts/[id]/page.tsx`; retire `[id]/enhanced` and `[id]/state-of-the-art`).
- Dedupe providers in `app/layout.tsx` (2 theme, 2 keyboard, 3 toast) when touching layout.
- **Acceptance:** per-PR: no new hand-rolled tables, no new gradient wrappers, no new providers.

### 3.3 i18n & list performance — M
- Either complete `messages/es|fr|it.json` (currently ~7% stubs vs 65-73 KB en/de) or reduce the shipped locale list to what's real; new modules must use `useTranslations` (spend/requests currently hardcode English).
- Virtualize long lists (`react-virtual` is a dependency used in only 2 files).
- **Acceptance:** no hardcoded user-facing strings in touched modules; inbox/contracts lists virtualized past N rows.

---

## Cross-cutting: docs hygiene (after Phase 0)

- Archive stale audits/plans into `docs/archive/2025-2026/` (agent counts contradict — 12/15/19/21/22 across docs; `INNOVATION_ROADMAP.md` "COMPLETE" markers are unreliable per `AGENT_READINESS_REVIEW.md` F15).
- Update `docs/features/USER_ONBOARDING.md` — it still teaches the blanket field-review model replaced by exception-based review (July 2026).
- This plan becomes the single source of truth for agentic-UX status; keep its task statuses current instead of writing new audit docs.

## Risks & notes

- **Notification SSE may not exist** (Feb 2026 audit) — task 0.1 starts with verification; worst case is a small new route.
- **No retroactive diffs:** `previousValue` capture starts at migration; older decisions can't show before-values. Acceptable; flag in UI as "prior value not recorded".
- **Unified inbox is the largest item** — the API aggregation shape is the risky part, not the UI. Spike the `InboxItem` contract first.
- **Don't repeat the anti-pattern this plan fixes:** no new components for anything an existing dead component already does — mount first, extend second.

## Effort summary

| Phase | Theme | Size | Key deliverable |
|---|---|---|---|
| 0 | Surface what exists | ~1–2 wks | Agent value visible outside Contigo Labs |
| 1 | Trust loop | ~3–4 wks | Evidence + diffs + undo + one inbox + telemetry |
| 2 | Autonomy + inspection | ~4 wks | Real progressive autonomy; run inspector |
| 3 | Convergence | quarter | One assistant; one design system; real i18n |
