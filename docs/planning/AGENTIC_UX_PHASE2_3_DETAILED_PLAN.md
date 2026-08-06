# Agentic UX — Phase 2 & 3 Detailed Implementation Plan

Companion to `AGENTIC_UX_IMPLEMENTATION_PLAN.md` and
`AGENTIC_UX_PHASE1_DETAILED_PLAN.md`. Same method: every reference below was
checked directly against the working tree on 2026-08-06, not assumed from the
original audit. Two of the plan's own facts turned out to be stale — flagged
inline where that happened.

Phase 2 depends on Phase 1 (1.3, 1.5) being done first for two of its four tasks;
see the dependency notes per task. None of Phase 2/3 has been started.

---

## Phase 2 — Real autonomy + inspectability

### 2.1 Wire per-agent autonomy settings — M (backend touch)

**Current state (verified):**
- `components/agents/UnifiedAgentInterface.tsx`, function `AgentSettings` (~line
  1211): renders two `<input type="checkbox" className="w-5 h-5" defaultChecked />`
  elements — no `onChange`, no `useState`, no persistence. Confirmed exactly as the
  plan states: purely decorative, `defaultChecked` means they render checked once
  and never do anything again regardless of interaction.
- `interface AgentConfiguration` (line 143) has the right shape already
  (`autoApprove: boolean`, `thresholds: { confidence, cost, risk }`,
  `notificationPreferences`) — **but it's dead**: grep confirms zero other
  references to `AgentConfiguration` in the file. It's declared and never
  instantiated, never used to type any state, never passed anywhere. Don't assume
  this type is "half-wired" — it's pure documentation of an intended shape.
- Reuse precedent confirmed: `components/workflows/ApprovalTemplates.tsx` has a
  real, working `autoApproveBelow?: number` pattern (line 83, editable input at
  line 868-870, conditional badge at line 515-524) — a numeric dollar threshold
  that governs auto-approval on workflow steps. This is the actual pattern to copy
  for the confidence/cost/risk thresholds, not a hypothetical one.

**Plan:**
1. New `AgentAutonomyConfig` table: `tenantId`, `agentId`, `actionType` (the
   granularity matters — one row per tenant×agent×action-type, e.g. an agent could
   be `auto` for low-value field writes but `review` for goal execution), `mode`
   (`suggest | review | auto`), `confidenceThreshold`, `costThreshold`,
   `riskThreshold` (reuse `Priority` type already used for `thresholds.risk` in
   `AgentConfiguration`).
2. Enforcement point: **the write gateway and goal executor**, not the UI. Specifically
   `packages/workers/src/services/agent-write-gateway.ts` (already touched in Phase
   1.2's plan for the `previousValue` snapshot — do both changes together, they're
   in the same function) — before creating the `AiDecision` as `pending`, check
   `AgentAutonomyConfig` for this tenant/agent/action; if `mode === 'auto'` and the
   proposed change is below all configured thresholds, apply immediately with
   `outcome: 'auto_applied'` (already a valid value on the existing `outcome`
   string column) instead of `pending`.
3. UI: replace `AgentSettings`'s two checkboxes with real per-agent controls (3-state
   toggle or slider) in the Labs `agents` tab (`contigo-labs/page.tsx`, `TabsContent
   value="agents"` → `UnifiedAgentInterface`). Show current mode as a badge on each
   agent card — check what agent-card component `UnifiedAgentInterface` already
   renders for the agent list before adding a new one.
4. Delete the dead `AgentConfiguration` interface once the new table/types replace
   it, rather than keeping both around.

**Acceptance:** toggling an agent to `auto` under thresholds measurably reduces its
queue items; every auto-applied write carries `previousValue` (from Phase 1.2 — this
is why 2.1 and 1.2 touch the same function together).

**Depends on:** Phase 1.2 (the write gateway needs the `previousValue` snapshot
logic regardless, and 2.1's enforcement check sits right next to it — sequencing
them separately would mean touching the same function twice).

**Risk:** high relative to the rest of this plan. This is the task that changes
*enforcement* — a bug here means real field writes get auto-applied when they
shouldn't, or an agent that should be autonomous keeps generating approval noise.
Needs real test coverage on the threshold-comparison logic before shipping, and
should ship with `mode` defaulting to `review` for every existing agent (nobody
gets silently upgraded to `auto`).

---

### 2.2 Graduation nudges — S (depends on 1.5, 2.1)

**Current state:** nothing found (confirmed absent, matches the audit).

**Plan:**
1. Requires 1.5's `approval_decided` events to exist and accumulate real history
   first — this task computes acceptance stats from that event stream (or from
   `AiDecision.outcome` directly, which is simpler and doesn't strictly require 1.5
   to be done first if queried straight from the table — worth reconsidering
   whether this truly depends on 1.5 or just on there being decision history at
   all).
2. Scheduled job (check what job-scheduling mechanism already exists in this repo —
   likely a worker cron pattern in `packages/workers` — before adding a new one):
   per tenant/agent/action, compute acceptance rate over the last N decisions.
3. Surface as a dashboard/inbox card: "You accepted @{agent}'s last 20
   {action}s — automate these?" One-click enables `mode: 'auto'` in
   `AgentAutonomyConfig` (2.1) with thresholds set from the observed data (e.g. the
   90th-percentile confidence of accepted decisions).

**Acceptance:** nudge appears only after ≥10 decisions with ≥90% acceptance;
accepting it changes real behavior (verifiable: next matching action for that
agent+action is auto-applied, not queued).

**Depends on:** 2.1 (needs `AgentAutonomyConfig` to exist to write to), and
loosely on 1.5 (see note above — may not be a hard dependency).

**Risk:** low-medium. The nudge itself is just UI; the risk is entirely inherited
from 2.1's enforcement correctness.

---

### 2.3 Auto-approval digest — S (depends on 1.3, 2.1)

**Current state:** nothing found (confirmed absent).

**Plan:**
1. Query `AiDecision` where `outcome = 'auto_applied'` (populated once 2.1 ships)
   over the digest period (weekly, or live on-dashboard — the plan allows either).
2. Card: "Agents auto-applied N low-risk updates" with a list, each item linking to
   the revert action (1.3's endpoint).
3. Placement: dashboard (near the 0.3 proactive widgets already mounted there) or
   inbox (1.4) — inbox is the more natural home once it exists, since this is
   exactly the kind of "things that happened without you" surface the inbox is for.

**Acceptance:** every auto-applied decision is discoverable and revertible from the
digest.

**Depends on:** 1.3 (revert endpoint must exist for the links to do anything), 2.1
(need `auto_applied` decisions to exist at all).

**Risk:** low — read-only surface, no new write paths beyond what 1.3/2.1 already
introduce.

---

### 2.4 Run inspector — M

**Current state (verified — worse than the audit states):**
- `app/runs/[runId]/run-detail-client.tsx` is exactly the stub the plan describes:
  renders `<b>{s.name}</b>: {s.status}` for each step, a summary paragraph, and a
  "Completed" line. No tool call args/results, no timings, no cost.
- **New finding not in the original audit:** this stub subscribes to
  `EventSource('/api/v2/stream/${runId}')` — **that route does not exist**. I
  searched `app/api` for anything under `v2/stream` and found nothing (the actual
  streaming routes in this app are `ai/streaming`, `ai/chat/stream`,
  `ai/analyze/stream`, `contracts/[id]/orchestrator/stream`,
  `contracts/[id]/artifacts/stream` — none named `v2/stream`). This page is calling
  a dead endpoint today, not just under-rendering — it likely never receives a
  single event in production. Confirm the intended real event source before
  rebuilding the UI; it's possible `orchestrator/stream` or a not-yet-written route
  is the actual intended source.
- Reusable shape already exists: `AgentObservabilityDashboard.tsx`'s
  `AgentStep` interface (line 100) already has `type: 'thought' | 'action' |
  'observation' | 'tool_call' | 'critique' | 'decision'`, `toolId`, `toolInput`,
  `toolOutput`, `confidence`, `tokens`, `durationMs` — exactly what a run inspector
  needs. Reuse this type and whatever rendering `AgentObservabilityDashboard`
  already does per-step rather than inventing a new shape.

**Plan:**
1. **First, find or build the real event/data source** — this blocks everything
   else. Either fix `run-detail-client.tsx` to point at a route that actually
   exists and emits `AgentStep`-shaped events, or build one.
2. Rebuild `RunDetailClient` using `AgentObservabilityDashboard`'s step-rendering
   components (don't duplicate — extract/reuse if they're not already exported
   separately from the dashboard).
3. Structure: goal → steps → tool calls (args/results expandable) → artifacts →
   timings/tokens/cost per step → errors/retries surfaced distinctly from normal
   steps.
4. Deep links: from an approval item (Phase 1.1/1.4) → originating goal → this run
   view → (if traces exist) the trace. From contract activity → runs that touched
   that contract (needs a `contractId` on the run record — verify it exists before
   promising this link).

**Acceptance:** from any approval or activity entry, a user can answer "what did
the agent do, why, and what did it cost" without leaving the app.

**Depends on:** nothing in Phase 1 strictly, but pairs naturally with 1.1 (both are
"render existing/needed data properly") and the deep-link acceptance criterion
needs 1.4 (inbox) or at least the approvals queue to link *into* it.

**Risk:** medium — the missing `/api/v2/stream` endpoint means step 1 is real
investigation work, not a known quantity. Scope this task's estimate up until
that's resolved.

---

## Phase 3 — Convergence

### 3.1 Chat ↔ agents — L

**Current state (verified — one correction to the original audit):**
- `app/api/agents/execute` exists as a route (confirmed present) — `FloatingAIBubble`
  dispatching goals through it is plausible without a new endpoint, assuming its
  request shape matches what the bubble would send (not yet verified in detail).
- **Correction:** `DashboardChatbot.tsx` **no longer exists** in this codebase —
  it's referenced in `docs/CHATBOT_AI_AUDIT.md` (lines 227, 243) as the thing to
  retire, but it's already gone. The underlying problem it named hasn't gone away
  though: the legacy non-streaming `/api/ai/chat` route (marked `@deprecated` in
  its own file per the audit doc) is still called directly by **two** live files:
  `components/ai/FloatingAIBubble.tsx:1604` and
  `components/ai/unified-chat/useStreamingHandler.ts:329`. So "retire the legacy
  endpoint" is still live work — the target moved from a whole duplicate component
  to a fallback code path inside the primary one. Read both call sites to
  determine whether the `/api/ai/chat` calls are genuine fallback (e.g.
  non-streaming-capable client) or dead code that never executes — that
  determines whether this is a deletion or a real feature gap to fix first.
- `EmbeddedChatInterface` is **not** a separate component file — it's a local
  function defined inside `app/contigo-labs/page.tsx` (line 3631), rendered at
  line 3600. This is itself an instance of the "duplicate chat implementations"
  problem: a whole second chat UI hand-rolled inline in the Labs page instead of
  reusing `FloatingAIBubble`.
- `@mention` handling for agent personas is real and live in
  `components/ai/chat/EnhancedChatInput.tsx` (lines ~170, 238, 357) — this is
  probably closer to what the plan means by "merge `@mention` routing" than
  anything named `EmbeddedChatInterface.tsx`, since no such file exists. Re-read
  the plan's intent against `EnhancedChatInput.tsx` before starting.

**Plan:**
1. Confirm `FloatingAIBubble` can dispatch goals via `/api/agents/execute` (check
   the route's expected request body against what the bubble already sends for
   regular chat messages — this may need a new "intent: dispatch a goal" branch in
   the bubble, not just a URL swap).
2. Add inline run-progress cards in the chat stream (feeds from 2.4's fixed event
   source once that exists) and inline approve/reject actions for approval items
   surfaced mid-conversation.
3. Replace `contigo-labs/page.tsx`'s inline `EmbeddedChatInterface` function with
   the real `FloatingAIBubble` (embedded/non-floating mode — check if it already
   supports an embedded layout prop, referenced elsewhere in this plan doc set as
   `isEmbedded`).
4. Resolve the `/api/ai/chat` legacy-route question from the "current state" notes
   above — either delete the fallback call sites or document why they're needed.

**Acceptance:** "ask → dispatch → watch → approve" happens inside one chat surface;
duplicate chat implementations removed (the inline `EmbeddedChatInterface` in
particular, now that its actual location is known).

**Depends on:** loosely on 2.4 (run-progress cards need a real event source) and
Phase 1.1/1.4 (inline approve/reject needs the evidence rendering and ideally the
unified inbox's action model to stay consistent).

**Risk:** high — largest single-file blast radius in this plan (`FloatingAIBubble.tsx`
is already 2800+ lines) and changes a core, high-traffic user surface.

---

### 3.2 Design-system consolidation (opportunistic, no big bang) — ongoing

**Current state (verified):**
- Contract detail duplicates confirmed: `app/contracts/[id]/page.tsx` (live, 1863
  lines per Phase 0's investigation) plus **two** siblings —
  `app/contracts/[id]/enhanced/` and `app/contracts/[id]/state-of-the-art/` both
  exist as separate route directories. (Phase 0.4 already deleted the *third*
  duplicate, `ContractsPageRefactored.tsx`, which was a duplicate of the *list*
  page, not the detail page — different problem, already fixed.)
- Provider nesting in `app/layout.tsx` (lines 92-120) is deep: confirmed
  `EnterpriseThemeProvider`, `AuthProvider`, `CSRFProvider`, `QueryProvider`,
  `WebSocketProvider`, `RealTimeSyncProvider`, `DataModeProvider`, `ToastProvider`,
  `UndoToastProvider`, `ModuleProvider`, `FeedbackProvider`,
  `CommandPaletteProvider`, `ConfirmProvider`, `AnnouncerProvider`,
  `GlobalKeyboardShortcutsProvider`, `WelcomeTourProvider` — 15 in this one file
  alone, not counting whatever's nested inside `EnhancedAppShell.tsx` (which per
  Phase 0.4's investigation independently mounts its own notification system).
  **The "2 theme / 2 keyboard / 3 toast" count in the original audit understates
  it**: grep found *two* theme provider files (`EnterpriseThemeProvider.tsx`,
  `ThemeProvider.tsx`), but the keyboard-shortcut sprawl is much wider — at least
  six distinct implementations (`KeyboardManager`, `ux/keyboard-shortcuts/KeyboardShortcuts`,
  `keyboard/KeyboardShortcuts`, `keyboard/GlobalKeyboardShortcuts`,
  `keyboard/KeyboardShortcutsPanel`, `dashboard/KeyboardShortcutsPanel`, plus
  per-page help modals) and toast sprawl is similarly wider (`EnhancedToastSystem`,
  `toast-system/ToastSystem`, `feedback/EnhancedToast`, `feedback/ToastNotifications`,
  `ui/toast-provider`, `undo-toast/UndoToast` — six-plus files, not three). Do a
  fresh count before scoping this task rather than trusting either number as a
  target list.
- `PageShell` — no such component found; confirmed it needs to be built, not just
  adopted.
- `DataTable` — not verified in this pass (out of scope for this doc's checks);
  confirm the "one sanctioned DataTable" claim against the actual table
  implementations in use before treating it as settled.

**Plan:** this is explicitly "opportunistic, no big bang" per the original plan —
the actual mechanism is a rule (any file you touch for other work gets migrated),
not a dedicated migration project. Concretely:
1. Retire `app/contracts/[id]/enhanced` and `app/contracts/[id]/state-of-the-art` —
   this one *is* a bounded, standalone task (unlike the provider/toast/keyboard
   sprawl) since it's "delete two directories after confirming zero unique
   functionality only they have" rather than an ongoing migration. Do this as its
   own PR, not opportunistically, given the scope is small and clear (same method
   as Phase 0.4's dead-code deletions).
2. Build `PageShell` once, when the next file that would benefit from it is
   touched for unrelated reasons — don't build it speculatively.
3. Provider/toast/keyboard dedup: audit the real current count first (this doc's
   numbers are a starting point, not final), pick the one canonical implementation
   per concern, then apply the "touch it, migrate it" rule going forward. Do not
   attempt to migrate all consumers in one pass.

**Acceptance:** per-PR: no new hand-rolled tables, no new gradient wrappers, no new
providers. The `[id]/enhanced` and `[id]/state-of-the-art` deletion has its own
acceptance criterion: zero broken links after deletion (grep for both route
segments across the app first).

**Risk:** low for the bounded deletion (step 1); the ongoing dedup (steps 2-3) has
no fixed risk profile since it's spread across future unrelated PRs by design.

---

### 3.3 i18n & list performance — M

**Current state (verified, numbers updated from the audit):**
- Locale file sizes: `en.json` 65.2 KB, `de.json` 73.0 KB (both substantially
  complete) vs. `es.json` 4.7 KB, `fr.json` 4.8 KB, `it.json` 4.6 KB — es/fr/it are
  genuinely ~7% the size of the complete locales, confirming the audit's number.
  Phase 0/1 work in this session added a couple of new keys only to `en.json` and
  `de.json` (documented in the Phase 1 doc) — consistent with, not worsening,
  this existing gap.
- `react-virtual` usage: **down to 1 importer** (`components/contracts/VirtualizedContractList.tsx`),
  not 2 as the original audit states — either a file was removed since, or the
  audit counted differently. Either way, the dependency is used in exactly one
  place today.
- Confirmed elsewhere in this doc set: `app/dashboard/page.tsx`'s new widgets
  (Phase 0.3) and the Phase 1 work don't use hardcoded English inside i18n-covered
  modules where `t()` was already in scope — but `spend`/`requests` hubs
  specifically were flagged by the audit as hardcoding English; not independently
  re-verified in this pass.

**Plan:**
1. **Decision needed, not mine to make:** either commit to completing
   `es.json`/`fr.json`/`it.json` to parity with `en.json`/`de.json`, or reduce the
   shipped/selectable locale list to `en`/`de` until they're real. Shipping locale
   options that silently fall back to English for 93% of strings is worse than not
   offering them — a user who picks Spanish and gets English everywhere has no way
   to know the app doesn't actually support their language.
2. New modules going forward must use `useTranslations` from first commit — this is
   a policy/review-gate item (matches the plan's "no hardcoded user-facing strings
   in touched modules" acceptance line), not a one-time fix.
3. Virtualize long lists past whatever row-count threshold the plan settles on
   ("N rows" — not specified in the source plan; pick a number, e.g. 200+, based on
   where users have reported or profiling shows jank) — inbox (1.4) and contracts
   list are the two named candidates; contracts already has `VirtualizedContractList`
   as a precedent to extend from, inbox will need it built fresh once 1.4 exists.

**Acceptance:** no hardcoded user-facing strings in touched modules; inbox/contracts
lists virtualized past the chosen row threshold.

**Depends on:** 1.4 (inbox must exist before it can be virtualized).

**Risk:** low technically; the real blocker is the product decision in step 1,
which needs a human call (translation budget/vendor vs. reduced locale list), not
an engineering one.

---

## Suggested order (Phase 2/3, assuming Phase 1 is done or well underway)

1. **2.1** — do together with Phase 1.2 (same function in the write gateway);
   ship with every agent defaulting to `review` mode, nothing auto-upgraded.
2. **2.4's investigation step** (find/fix the missing `/api/v2/stream` source) —
   do this early and separately from the rest of 2.4's UI work, since it blocks
   everything else in that task and might reveal the real scope is bigger.
3. **2.2, 2.3** — cheap once 1.5/1.3/2.1 exist; can be done in either order or
   together.
4. **3.2 step 1** (delete `[id]/enhanced` + `[id]/state-of-the-art`) — bounded,
   can happen any time independent of the rest of this plan.
5. **3.3 step 1** (the locale decision) — flag to a human early; it gates 3.3's
   other steps and has no engineering-only resolution.
6. **3.1** — largest and highest-risk; do last, once 1.1 (evidence), 1.4 (inbox
   action model), and 2.4 (run-progress event source) exist to build on.

## Explicit go/no-go points (Phase 2/3, in addition to Phase 1's)

- **2.1's enforcement logic** — this is the task in this entire plan (Phase 0-3)
  with the highest blast radius if wrong: a threshold bug means real contract
  field writes get auto-applied without human review. Wants explicit sign-off on
  the threshold-comparison implementation before it's live for any tenant, and
  should ship behind a per-tenant kill switch if one doesn't already exist.
- **3.2's provider/toast/keyboard consolidation** — picking "the one canonical
  implementation per concern" is a design decision with real behavioral
  consequences (whichever toast system loses gets its call sites migrated); flag
  the chosen canonical implementations before migrating call sites, not after.
- **3.3's locale decision** — explicitly not an engineering call; needs a human
  answer before any code changes in that task.

---

## Phase 2 & 3 — status (implemented)

| Task | Status | Where |
|------|--------|--------|
| **2.1** Autonomy settings | Done | `AgentAutonomyConfig` table + migration; `packages/utils/src/agent-autonomy.ts` + tests; write-gateway enforcement; `GET/PUT /api/agents/autonomy`; Labs `AgentAutonomySettingsPanel` (defaults **review**) |
| **2.2** Graduation nudges | Done | `GET/POST /api/agents/autonomy/graduation`; `GraduationNudgeCard` on dashboard + inbox (≥10 decisions, ≥90% acceptance) |
| **2.3** Auto-approval digest | Done | `GET /api/agents/auto-applied`; `AutoApprovalDigestCard` with revert links |
| **2.4** Run inspector | Done | `GET /api/agents/runs/[runId]`; SSE shim `GET /api/v2/stream/[runId]`; rebuilt `run-detail-client.tsx`; inbox goal deep-link → `/runs/{id}` |
| **3.1** Chat ↔ agents | Done | Contigo Labs uses `FloatingAIBubble mode="embedded"` only (hand-rolled EmbeddedChatInterface removed); `/agent <name>` dispatch via `/api/agents/execute`; legacy `/api/ai/chat` kept as intentional non-stream fallback |
| **3.2** Contract detail dupes | Done | Deleted `contracts/[id]/enhanced` + `state-of-the-art`; route-splitting aliases to canonical page. Provider/toast dedup remains opportunistic. |
| **3.3** i18n + lists | Done | Selectable locales reduced to **en/de**; inbox virtualized at ≥50 rows via `@tanstack/react-virtual` |

Migration: `20260806140000_agentic_ux_phase2`. Global kill switch for writes remains `AGENT_WRITES_ENABLED`.

### Follow-through (finished)

- Settings language selector limited to **en/de** (matches i18n shipping policy).
- Agent directory cards show live **autonomy mode badges** (default `review`).
- Goal executor (`autonomous-orchestrator`) respects `AgentAutonomyConfig` (fail-closed to HITL).
- Chat surfaces **inline approve/reject** strip (`ChatApprovalStrip`) + `/agent` dispatch + run links.
- Canonical UI note: `docs/planning/AGENTIC_UX_CANONICAL_UI.md` (opportunistic provider/toast/keyboard rule).
