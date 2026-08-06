# Agentic UX — Phase 1 Detailed Implementation Plan

Companion to `AGENTIC_UX_IMPLEMENTATION_PLAN.md`. That doc states *what* and *why* at
a high level; this one pins down *exactly what to touch* for the remaining work,
verified against the working tree on 2026-08-06. Phase 0 (tasks 0.1–0.4) is done —
see the "Phase 0 — status" section at the bottom for what shipped and where.

Every file:line reference below was checked directly (grep + read), not assumed from
the original audit. Where the audit was slightly off on a location, this doc has the
corrected one.

---

## 1.1 Render evidence in the agent approval queue — M

**Current state (verified):**
- `AgentApprovalQueue.tsx:107-118` — `AgentFieldWrite.citations`/`evidenceChain` are
  typed as `unknown`. Never rendered anywhere in the component.
- `app/api/agents/approvals/route.ts:162-163` — the API already puts
  `decision.citations` / `decision.evidenceChain` into `context.citations` /
  `context.evidenceChain` on every `agent_write` item. Data reaches the client; UI
  just drops it.
- Schema (`packages/clients/db/schema.prisma:5733-5735`, model `AiDecision`):
  `citations Json @default("[]")`, `evidenceChain Json @default("[]") @map("evidence_chain")`.
  No documented shape — first task here is to sniff a few live rows (or the writer
  code that populates them) to nail down the actual JSON shape before typing it.
- Reference rendering pattern to extract from:
  `components/ai/FloatingAIBubble.tsx:2789-2858` — collapsible `<details>` sources
  list, citation chip `[n]`, contract name, heading/section badge, snippet
  (`line-clamp-2`), span offsets, relevance score badge, click → `setActiveCitationPreview`.
  Link-building logic (the "click deep-links to source span" part) is
  `buildCitationHref`/`openCitationInContract` at `FloatingAIBubble.tsx:461-491` —
  builds `/contracts/{id}?tab=details&cite=1&citeIndex=…&citeHeading=…&citeStart=…&citeEnd=…&citeSnippet=…`.

**Plan:**
1. Read `packages/workers/src/services/agent-write-gateway.ts` (and wherever goal
   plans populate `citations`) to confirm the real JSON shape written to
   `AiDecision.citations`/`evidenceChain`. Type it properly (replace `unknown`).
2. Extract `components/ai/CitationList.tsx`: props `{ citations: Citation[];
   emptyLabel?: string }`, reusing the exact chip/snippet/score/link markup from
   `FloatingAIBubble.tsx:2789-2858` and the href-building logic from
   `buildCitationHref` (generalized — it currently closes over `pathname`/`searchParams`
   from the chat component's own hooks, so make those explicit params or use
   `useRouter`/`usePathname` directly inside `CitationList`).
3. Refactor `FloatingAIBubble.tsx` to consume `CitationList` instead of its inline
   JSX (keeps the two surfaces from drifting again — this is the actual point of
   "extract a shared component").
4. In `AgentApprovalQueue.tsx`, render `<CitationList citations={write.citations} />`
   for both item types (field writes and goal plans — goal plans' evidence path
   needs the same shape-sniffing as step 1, likely under a different field name on
   the goal/step record).
5. Empty state: "No evidence recorded" when the array is empty/absent.

**Acceptance:** every approval item with citations shows clickable source spans that
open the contract at the highlighted passage; items without evidence say "no
evidence recorded". No behavior change to `FloatingAIBubble` beyond the refactor.

**Risk:** low — additive UI, no schema/API change. The only real unknown is the
citation JSON shape (step 1) since neither file inspected so far documents it.

---

## 1.2 Old-vs-new diff for field writes — M (backend touch)

**Current state (verified):**
- `AiDecision` (`schema.prisma:5704-5752`) has `output Json` (the proposed value)
  but no previous-value column. Confirmed no `previousValue`/`previous_value` field
  exists anywhere in the model.
- `packages/workers/src/services/agent-write-gateway.ts`, `applyDomainUpdate`
  (~line 142): blind-writes via `prisma.contract.update({ where: { id: entityId },
  data: { [field]: value } })` (same pattern for `ContractMetadata`, `Obligation`) —
  **no read-before-write**, so there is nothing to snapshot yet.

**Plan:**
1. **Migration:** add `previousValue Json? @map("previous_value")` to `AiDecision`.
   Nullable — old decisions won't have it; UI must handle absence gracefully (no
   diff shown, not an error state).
2. **Write gateway:** before `applyDomainUpdate` runs, `SELECT` the current value of
   the target field (per entity: `Contract`, `ContractMetadata`, `Obligation`) and
   persist it into the `AiDecision.previousValue` at proposal time — i.e. when the
   decision is first created as `pending`, not at apply time (the "old" value must
   be the value *before* any change, captured before the human even sees the
   approval item, otherwise a second pending write on the same field would snapshot
   the wrong "old" value).
3. **UI:** in `AgentApprovalQueue.tsx`, render old vs. new side-by-side for each
   field write. Format per field type — reuse whatever formatter the contract detail
   page already uses for that field if one exists (check `app/contracts/[id]/page.tsx`
   before inventing a new one). Highlight the changed portion for text fields;
   plain before/after for scalars.
4. **Regression test:** the approvals route test file already exists
   (`app/api/agents/approvals/route.ts` — check for a co-located `__tests__`, same
   pattern as the notifications SSE route which has one) — extend it to assert
   `previousValue` round-trips.

**Acceptance:** new pending writes show before/after; approving still applies the
new value (no change to apply semantics, only additive capture); old decisions
render without a diff, not an error.

**Depends on:** nothing blocking — can start immediately, independent of 1.1.
**Blocks:** 1.3 (undo needs `previousValue` to restore).

**Risk:** medium. This is the first schema migration in this batch of work — coordinate
timing with whoever owns migrations/deploys for this repo (unlike the CantinaBella
work earlier in this session, I have not been given deploy access or a green light
to run migrations against this project's database, and won't run `prisma migrate`
without explicit confirmation).

---

## 1.3 Undo / revert of applied agent actions — M (depends on 1.2)

**Current state (verified):**
- No `revertedAt` field on `AiDecision`. `outcome` is a free-text `String` column
  (not a real Prisma enum) currently used as `accepted | rejected | modified |
  pending | auto_applied` — adding `reverted` is just a new string value, not an
  enum migration.
- No `POST /api/agents/decisions/[id]/revert` route exists (`app/api/agents/decisions`
  directory needs to be checked for what *does* exist there — likely just a list/get).
- `toastWithUndo` (`lib/toast-utils.ts`) has **zero importers** anywhere in
  `app/`/`components/`/`lib/` (confirmed via grep — only self-referenced inside its
  own file). It's fully dead code today, exactly as flagged.

**Plan:**
1. Add `revertedAt DateTime? @map("reverted_at")` to `AiDecision` (same migration as
   1.2's `previousValue`, or a follow-up — coordinate with 1.2's timing either way).
2. New route `app/api/agents/decisions/[id]/revert/route.ts`: loads the decision,
   requires `previousValue` to be present (else 409 — nothing to revert to) and
   `outcome` to be `accepted`/`auto_applied` (else 400 — can't revert a pending or
   already-reverted decision), calls the *same* `applyDomainUpdate`-shaped write
   path in reverse (write `previousValue` back to the field), writes an audit-log
   entry (check whatever audit-log table/helper the write gateway already uses for
   applied writes, reuse it), sets `outcome: 'reverted'` and `revertedAt: now()`.
3. UI: "Undo" action wherever applied/auto-applied decisions surface — the inbox
   item (1.4, not built yet) and contract activity feed (locate the component that
   renders per-contract activity — likely near `app/contracts/[id]/page.tsx` or a
   dedicated `ActivityFeed`/`AuditTimeline` component). Wire `toastWithUndo` here —
   it's dead exactly because nothing has called it yet, not because it's broken;
   read it first to confirm its API matches this use case before assuming it's a
   drop-in fit.

**Acceptance:** an applied/auto-applied decision with a `previousValue` shows an
Undo action; using it restores the field, marks the decision `reverted`, and is
itself audit-logged.

**Depends on:** 1.2 (needs `previousValue` to exist and be populated).

**Risk:** medium — writes to production data (reverting a field). Needs the same
migration/deploy coordination as 1.2, plus care that the revert path can't be used
to revert an already-reverted or stale decision (race: two revert clicks, or a
newer decision superseding this field since).

---

## 1.4 Unified "Needs you" inbox — L (largest item)

**Current state (verified):**
- No `app/inbox` route, no `app/api/inbox` route — confirmed both absent.
- Items currently live in at least four separate places: agent goal approvals +
  agent field writes (both via `app/api/agents/approvals/route.ts`), workflow
  approvals (`SimpleApprovalsQueue` — locate this component before starting),
  metadata review exceptions, RFx checkpoints. `/approvals` today redirects to
  `/workflows?tab=queue` (per the original audit check) — a fifth, separate surface.

**Plan (per the original plan's own risk note — spike first, this is the risky
part, not the UI):**
1. **Spike the `InboxItem` contract before writing any aggregation code.** Common
   shape across all five source types needs: `id`, `type` (discriminated union),
   `title`, `risk` (numeric or enum — check what field writes already use via
   `priority: 'high'|'medium'` in the approvals route, and reconcile with whatever
   scale workflow approvals and RFx checkpoints use), `value` (for the risk × value
   × deadline sort — this is money/impact, needs a per-type extraction rule since
   a field write and an RFx checkpoint don't have "value" in the same sense),
   `deadline` (nullable — not all item types have one), `deepLink`, `actions`
   (discriminated per type, e.g. approve/reject vs. review vs. sign).
2. Enumerate the actual query for each of the five sources server-side (reuse the
   query logic already in `app/api/agents/approvals/route.ts` for the first two;
   find and reuse the equivalent for `SimpleApprovalsQueue`, metadata review, and
   RFx checkpoints rather than re-deriving them).
3. New `app/api/inbox/route.ts`: one server-side query (or Promise.all of the five
   underlying ones, merged and sorted server-side — "do not merge N sources
   client-side" per the plan, meaning don't ship five separate fetches to the
   browser and reconcile there, not necessarily that the DB layer must be a single
   SQL query) returning `InboxItem[]` sorted by risk × value × deadline.
4. New `app/inbox/page.tsx`: renders the list, type filters, bulk actions for
   homogeneous selections (only enable bulk-act when the selection is all one
   `type`, since actions are type-specific).
5. `EnhancedNavigation.tsx`: single badge count (reuse/replace the "Approvals"
   `pendingApprovals` badge already at `contigo-labs/page.tsx:377-381` — check
   whether that count needs to move to source from `/api/inbox` too, so the two
   badges don't disagree).
6. Retarget `/approvals` → `/inbox` (currently → `/workflows?tab=queue`); confirm
   nothing else hard-links `/workflows?tab=queue` expecting approvals specifically
   before changing the redirect target, since that's changing existing behavior,
   not just adding a route.

**Acceptance:** all five item types appear, are actionable in place, deep-link
correctly; both legacy queues redirect to the inbox; badge count matches queue
length exactly (not an approximation).

**Risk:** high relative to the rest of this batch — five source systems to
reconcile into one shape, and the redirect change alters existing navigation
behavior. Recommend doing the spike (step 1) as its own reviewable unit before
writing the aggregation endpoint.

---

## 1.5 UX telemetry baseline — S (do early in Phase 1 per the plan)

**Current state (verified):** none of the six events exist outside the plan doc's
prose. No `analytics_events` table found; `app/monitoring` and Sentry plumbing
exist but aren't wired to these events.

**Events to emit** (from the plan's "Success metrics" table, `AGENTIC_UX_IMPLEMENTATION_PLAN.md:11-20`):
`approval_requested`, `approval_decided` (carrying latency, outcome, evidence_viewed
boolean), `notification_impression`, `notification_click`, `agent_undo_used`,
`autonomy_changed`.

**Plan:**
1. Decide the sink first: minimal `analytics_events` table (tenantId, event, props
   Json, createdAt — cheap, queryable with plain SQL for the dashboard) vs. piping
   through existing Sentry/monitoring. The plan allows either; a table is simpler to
   query for the dashboard in step 3 and doesn't depend on a third-party retention
   window.
2. Emit points:
   - `approval_requested` — wherever `AiDecision` rows are created as `pending`
     (write gateway) and wherever agent goals enter `AWAITING_APPROVAL`.
   - `approval_decided` — the approve/reject handlers in
     `app/api/agents/approvals/route.ts` (or wherever the accept/reject mutation
     actually lives — the GET-only code read so far doesn't show the write side).
     Needs `evidence_viewed` — set a flag when `CitationList` (1.1) is opened for
     that item, threaded through to the decide call.
   - `notification_impression`/`notification_click` — `AgentNotificationBell.tsx`
     (already merged in Phase 0.1): impression on panel open, click on the existing
     `onClick` handler that navigates via `n.href`.
   - `agent_undo_used` — the revert endpoint from 1.3.
   - `autonomy_changed` — doesn't exist yet (depends on Phase 2.1); stub the event
     name now so 2.1 just calls it, don't build the UI for it here.
3. Minimal internal dashboard page (`app/admin` or similar, admin-audience) querying
   the six metrics from the plan's table.

**Acceptance:** all six success metrics are queryable; dashboard renders them.

**Depends on:** partially on 1.1 (evidence_viewed), 1.3 (undo event), Phase 2.1
(autonomy event, but only the UI for *displaying* that metric — the event name can
be reserved now).

**Risk:** low — additive, no schema risk beyond one small new table (or none, if
piping through existing Sentry).

---

## Suggested order

1. **1.1** (no migration, self-contained, unblocks nothing else but is the safest
   place to build momentum).
2. **1.5 emit points for `approval_requested`/`approval_decided`** — cheap to add
   now while touching the approvals route for other reasons; don't wait for 1.2/1.3.
3. **1.2** (migration + write-gateway snapshot) — get sign-off on running the
   migration before starting.
4. **1.3** (depends on 1.2's `previousValue` existing and being populated for new
   decisions).
5. **1.4 spike** (the `InboxItem` contract) as its own reviewable step, *then* the
   aggregation endpoint and UI.
6. **1.5 remainder** (dashboard page) once 1.1/1.3/1.4 emit points exist to chart.

## Explicit go/no-go points

Per this session's own operating pattern so far: implementation proceeds without
asking each time, but the following need an explicit go-ahead before I run them,
since they're the hard-to-reverse category:
- Running the Prisma migration for 1.2/1.3 (`previousValue`, `revertedAt`) against
  whatever database this environment's `prisma migrate` would target.
- Changing the `/approvals` redirect target in 1.4 (alters existing user-facing
  navigation, not purely additive).
- Anything in Phase 2/3 that touches the write gateway's enforcement logic (2.1) —
  that's the difference between "suggest" and "auto-apply real writes."

---

## Phase 0 — status (for reference, all shipped this session)

- **0.1** — `AgentNotificationBell` merged with the collaboration/system
  notification source (SSE + WebSocket, combined badge, All/Agents/System filter);
  `EnhancedNavigation.tsx` repointed to it.
- **0.2** — `AgentObservabilityDashboard` mounted as a tab in `contigo-labs` +
  `/contigo-labs?tab=observability` nav entry under Platform; i18n keys added to
  `en.json`/`de.json`.
- **0.3** — `PredictiveInsightsWidget` + `AIActivityFeed` mounted by default on
  `/dashboard` (demo-mode gated); `AIDecisionAuditDashboard` given a real route at
  `/governance/ai-decisions` + nav entry.
- **0.4** — Deleted confirmed-dead code: `app/ui-showcase`, `app/ui-enhanced`,
  `app/ui-features` (public unlinked demo routes), `app/contracts/ContractsPageRefactored.tsx`
  (duplicate of the live page), `components/agents/AgentStatus.tsx` (zero real
  importers), `components/collaboration/NotificationCenter.tsx` (orphaned by 0.1;
  the app's actual live notification center was always a separate file,
  `components/notifications/NotificationCenter.tsx`). Cleaned up barrel exports
  pointing at the deleted files.

All four verified via `tsc --noEmit` (0 new errors vs. the pre-existing 17-error
baseline, none in touched files), ESLint (0 errors), and a full production build
(`✓ Compiled successfully`, both new/changed routes present in the build manifest).
Nothing from Phase 0 has been committed or pushed.

---

## Phase 1 — status (shipped)

| Task | Status | Where |
|------|--------|--------|
| **1.1** Evidence in approval queue | Done | `components/ai/CitationList.tsx`, `lib/ai/citations.ts`; wired in `AgentApprovalQueue` + `FloatingAIBubble` |
| **1.2** Old-vs-new diff | Done | `AiDecision.previousValue` + migration; snapshot in `agent-write-gateway`; UI diff in `AgentApprovalQueue` / inbox |
| **1.3** Undo / revert | Done | `POST /api/agents/decisions/[id]/revert`; `toastWithUndo` on apply; contract `AgentWriteUndoBanner` |
| **1.4** Needs you inbox | Done | `GET/POST /api/inbox`, `/inbox` page; `/approvals` → `/inbox`; `/workflows?tab=queue` → `/inbox`; nav badge |
| **1.5** UX telemetry | Done | `analytics_events` table; emit points for all six metrics; `/admin/ux-metrics` dashboard |

Migration applied: `20260806120000_agentic_ux_phase1`. Unit tests: citations, approvals previousValue, revert, inbox aggregation (17 passed).
Nothing from Phase 1 has been committed or pushed unless done separately.
