# Metadata UX & Persistence Improvement Plan

**Date:** 2026-07-13
**Scope:** Contract metadata verification (detail page), metadata quality scoring (list page), row badge layout, and two persistence bugs.
**Status:** Implemented (2026-07-13) — Phases 1–5 complete except 5.7 (deferred component split, intentionally left out). Tests: `app/api/contracts/[id]/metadata/validate/__tests__/route.test.ts`, `app/api/contracts/[id]/metadata/__tests__/route.test.ts`, `lib/contracts/__tests__/metadata-requirements.test.ts`, `lib/contracts/server/__tests__/metadata-quality.test.ts`. Optional data cleanup: `scripts/cleanup-validation-customfields.ts` (dry-run by default; never run without reviewing output first).

Background: the contracts list previously showed a noisy "Metadata NN%" badge on nearly every row. That badge has already been replaced with a critical-issues-only "N fields missing" badge (see `CompactContractRow.tsx`). This plan covers the remaining work: fixing the verification persistence bugs, replacing the 26-field manual verification model with exception-based review, making required fields contract-type-aware, moving row badges off the title line, and cleaning up the metadata detail UI.

---

## Architecture recap (how it works today)

Two storage paths, one working, one half-broken:

| Data | Where it lives | Write path | Status |
|---|---|---|---|
| Field **values** | `Contract.aiMetadata` (JSON, snake_case enterprise schema) + mirrored legacy scalar columns (`contractTitle`, `totalValue`, `effectiveDate`, `expirationDate`, `jurisdiction`, …) | `PUT /api/contracts/[id]/metadata` → `putContractMetadata()` in `apps/web/lib/contracts/server/metadata.ts:780` | ✅ Works (audit log, RAG reindex, version bump) |
| Field **verification status** | `ContractMetadata.customFields._fieldValidations` (JSON map: `{ [fieldKey]: { status, validatedAt, reason } }`) | `PUT /api/contracts/[id]/metadata/validate` → `putContractMetadataValidation()` in `apps/web/lib/contracts/server/metadata.ts:1298` | ⚠️ Single-field path works; bulk path broken (Bug 1) |

The GET (`getContractMetadata()`, `metadata.ts:503`) rebuilds client verification state exclusively from `customFields._fieldValidations` (`metadata.ts:559-562`).

The main UI component is `apps/web/components/contracts/EnhancedContractMetadataSection.tsx` (2,335 lines).

---

## Phase 1 — Persistence bug fixes (highest priority, smallest diffs)

### 1.1 Fix global "Verify all" — it doesn't survive a reload

**Bug:** The page-level "Verify all" button sends an `allFields: { fieldKey: value, ... }` payload (`EnhancedContractMetadataSection.tsx:1884-1888`). The server branch for `allFields` (`metadata.ts:1353-1397`) merges the raw field **values** into `ContractMetadata.customFields` and writes a `_validationStatus` summary — but never writes `_fieldValidations`, which is the only thing GET reads back. Result: UI shows 26/26 verified until refresh, then resets to 0. It also pollutes `customFields` with 26 metadata values that don't belong there.

**Fix (server):** In `putContractMetadataValidation()`, change the `allFields` branch to:
- Accept a `fieldKeys: string[]` payload (keep `allFields` accepted for one release for backward compat, but ignore its values).
- Write one `_fieldValidations[key] = { status: 'validate', validatedAt, validatedBy }` entry per key — same shape the single-field path writes (`metadata.ts:1427-1431`).
- **Do not** merge field values into `customFields`.
- Keep the `_validationStatus` summary if anything reads it (grep first; if nothing reads it, drop it).

**Fix (client):** `handleVerifyAllFields` (`EnhancedContractMetadataSection.tsx:1872-1907`) sends `{ fieldKeys: allUnverifiedFields.map(f => f.key) }` instead of the values map.

**Data cleanup (optional, low risk):** a one-off script to strip stray metadata-value keys from `customFields` where `_validationStatus` exists — only keys that exactly match enterprise schema field keys. Do **not** run automatically; list affected rows first (DB is being seeded with test artifacts — never delete without asking).

**Acceptance:** click Verify all → hard refresh → all fields still verified; `customFields` contains only `_fieldValidations` (+ any genuine custom fields).

### 1.2 Stop reporting success on failed single-field verify

**Bug:** `handleMarkVerified` (`EnhancedContractMetadataSection.tsx:1167-1210`) sets `localVerified = true` up front and shows `toast.success` in **both** the non-OK branch (line ~1202) and the catch branch (line ~1206). A failed API call looks identical to success; the verification silently evaporates on reload.

**Fix:** on failure, revert `setLocalVerified(false)` and show `toast.error('Failed to verify — please retry')`. Keep the optimistic set for perceived speed.

### 1.3 Batch the section-level "Verify all"

`handleVerifyAllSection` (`EnhancedContractMetadataSection.tsx:800-826`) loops one sequential `PUT` per field. After 1.1, point it at the same `fieldKeys` batch payload — one request per section. Also remove the per-field loop's all-or-nothing error handling ambiguity (batch is atomic server-side).

### 1.4 Send `metadataVersion` so optimistic locking actually runs

`putContractMetadata()` supports optimistic locking via `metadataVersion` (409 on mismatch, `metadata.ts:816-824`), but `persistMetadata()` in the client (`EnhancedContractMetadataSection.tsx:1974-1981`) never sends it — the check is dead code.

**Fix:** GET already returns `metadataVersion`; store it in component state, include it in the PUT body, and on 409 show the existing conflict message with a "Reload" action. Update the response handling to store the new version from `data.metadataVersion`.

**Tests for Phase 1:** extend `apps/web/app/api/contracts/[id]/metadata/validate/__tests__/` — bulk verify persists `_fieldValidations`; bulk verify does not write values into `customFields`; single-field verify failure surfaces error; PUT with stale `metadataVersion` → 409.

---

## Phase 2 — Exception-based review (kill the 26-field checklist)

**Problem:** "0 of 26 fields verified" + per-section progress bars + Verify-all + confetti (`EnhancedContractMetadataSection.tsx:1828-1838`) frames blanket verification as mandatory. Across hundreds of contracts that's thousands of clicks, and bulk-clicking Verify-all makes "verified" meaningless.

**Target model:** trust AI-extracted values by default; humans only review **flagged** fields; one contract-level sign-off.

### 2.1 Make "N need review" the only headline metric

- Header (`EnhancedContractMetadataSection.tsx:~2160-2180`): remove "0 of 26 fields verified"; keep/promote the existing `fieldsNeedingAttention.length` badge ("14 need review").
- A field needs review iff (already computed at lines 769-779 / 1100-1103): extraction confidence < 0.8, missing required value (per Phase 3 type-aware rules), or a real classification warning — AND not already verified/corrected.

### 2.2 Contract-level "Confirm reviewed" action

- New button, enabled when `fieldsNeedingAttention.length === 0` (everything flagged has been verified or corrected).
- Persists via the Phase-1 batch endpoint plus a review record: `customFields._reviewStatus = { reviewedBy, reviewedAt }` (reuse `ContractMetadata`; no schema migration needed). Write an audit entry (`AuditAction.CONTRACT_UPDATED` or a dedicated action if one exists — check `AuditAction` enum first).
- GET returns it; header shows "Reviewed by X on DATE" once set. Editing any field afterwards clears the review record (stale review must not linger) — do this server-side in `putContractMetadata()`.

### 2.3 Demote the completion machinery

- Remove: global "Verify all" button, per-section progress bars + "Verify all" links (`:878-899`), the 100% celebration effect + toast (`:1825-1838`).
- Keep: the per-field verify checkmark as an *optional* affordance on flagged fields (it's how a reviewer clears a flag without editing).
- Per-section header chip becomes "N flagged" (amber) or nothing when clean — replaces "0/7 verified".

### 2.4 List page tie-in

`metadataCompletenessLabel` ('ready'/'review'/'incomplete', `collection.ts:231`) stays, but consider surfacing `_reviewStatus` as a `reviewedAt` field on the list payload later so "needs review" can be filtered/sorted. Out of scope unless cheap.

---

## Phase 3 — Contract-type-aware required fields

**Problem:** an NDA is penalized for "missing value" (`missing-value` issue, completeness score) even though NDAs have no contract value. Same likely applies to `billing`/`payment` fields.

### 3.1 Single source of truth for requirements

New module `apps/web/lib/contracts/metadata-requirements.ts` (shared, imported by both server scoring and detail UI):

```ts
// Field keys a contract type does NOT require (subtractive — default = all base required fields)
const TYPE_EXEMPTIONS: Record<string, readonly MetadataFieldKey[]> = {
  'NDA':                      ['tcv_amount', 'currency', 'payment_type', 'billing_frequency_type'],
  'Non-Disclosure Agreement': ['tcv_amount', 'currency', 'payment_type', 'billing_frequency_type'],
  'Partnership Agreement':    ['tcv_amount', 'currency'],
  // extend as needed; keys must exist in CONTRACT_TYPES (lib/contracts/constants.ts:53)
};

export function isFieldRequired(fieldKey: string, contractType: string | null): boolean;
export function requiredIssueKeysForType(contractType: string | null): Set<MetadataIssueKey>;
```

Matching should be case-insensitive and tolerant of the two NDA spellings; fall back to the default rule set for unknown/null types.

### 3.2 Server scoring (`buildMetadataQuality`, `collection.ts:183-234`)

- Add `contractType` (and it's already selecting `category` etc.) to the contract select feeding `buildMetadataQuality` — check both call sites (`:919`, `:952`).
- Skip `missing-value` (and any other exempted issue) when the type exempts it.
- **Completeness denominator must shrink accordingly** — currently hardcoded `6` (`:224`). Compute `requiredCount = requiredIssueKeysForType(type).size` and use it, so an NDA with 5/5 required fields scores 100, not 83.
- ⚠️ Per project rules: run `impact` on `buildMetadataQuality` and `getContractsCollection` before editing (last check: LOW risk), and `detect_changes()` before committing.

### 3.3 The `metadataIssues` **filter** (`buildMetadataIssueFilter`, `collection.ts:236`)

The Prisma where-clause for filtering "missing value" can't easily consult the exemption map in SQL. Two options:

- **Option A (recommended, simple):** add `NOT: { contractType: { in: EXEMPT_TYPES_FOR_VALUE, mode: 'insensitive' } }` to the `missing-value` filter branch. Static list, stays in sync because both read `TYPE_EXEMPTIONS`.
- Option B: leave the filter as a superset and rely on badge/score being type-aware. Cheaper but filter results contradict the badges — avoid.

### 3.4 Detail page

- `EnhancedContractMetadataSection` receives the contract type (it already has metadata; use `contractType` prop or the metadata payload — verify what's passed from `app/contracts/[id]/page.tsx`).
- `isMissingRequired` (used at `:779` and `:1103`) consults `isFieldRequired(field.key, contractType)` instead of raw `field.required`.
- Required asterisk rendering uses the same function (see Phase 5.4).

**Tests:** unit-test `requiredIssueKeysForType`; extend `collection` tests: NDA with no value → no `missing-value` issue, completeness 100 when all remaining required fields present; `metadataIssue=missing-value` filter excludes NDAs.

---

## Phase 4 — Move row status badges off the title line (contracts list)

**Problem:** in `CompactContractRow.tsx`, badges (New, DocumentType, hierarchy, relationship, Failed, High risk, Signature, Processing, "N fields missing") render inline with the title (`:253-317` in current file), so long titles truncate to "TEST_Mutu…".

**Change:** restructure the title cell to two lines:

```
Line 1: [title, full available width, truncate only as last resort]
Line 2: [clock icon + date] [badge rail: New · Failed · High risk · Signature · N fields missing · …]
```

Implementation notes:

- Move every badge except `DocumentTypeBadge` (small, informational — judgement call; if line 1 stays crowded, move it too) into the existing second line `<p>` (`:318-321`), converting it to a `flex items-center gap-1.5 flex-wrap` container holding date + badges.
- Keep at most ~3 badges visible; they're mutually exclusive-ish already (Failed suppresses risk/signature/processing) so overflow is unlikely — don't build a "+N" overflow unless it shows up in practice.
- Row height: badges on line 2 may add ~2-4px; verify the virtualized list (if any) tolerates it — check how the parent renders rows (`ContractsPageRefactored.tsx` / list container) for fixed `itemSize`.
- The "N fields missing" badge stays a `<button>` (click → `?tab=details`), as shipped.

**Acceptance:** a 60-char title shows meaningfully more characters at the same viewport; badges never wrap into a third line at ≥1330px min row width.

---

## Phase 5 — Metadata detail UI cleanup

Ordered by user-visible impact; each is independent.

### 5.1 "Classification Warning" card renders when there is no warning

It shows an amber "Not specified" card on every contract. Fix: skip rendering `document_classification_warning` entirely when the value is empty. It's `system_generated`/`editable: false` in the schema (`contract-metadata-schema.ts:275-284`) — when present, render it as an inline alert attached to the Document Classification field rather than a sibling field card.

### 5.2 Document Classification always flagged amber

Schema hardcodes `ui_attention: 'warning'` (`contract-metadata-schema.ts:271`), so the field flags on every contract even with a clean high-confidence value. Fix: set `ui_attention: 'none'` and let the generic flag logic (low confidence / warning present) drive attention. Grep for other fields with hardcoded non-`none` attention and apply the same reasoning (`document_classification_warning` is `'error'` — fine once 5.1 hides it when empty).

### 5.3 Document Number shows the internal DB id

The field renders the contract cuid (`cmriy…`) as a required, verifiable "Document Number". Fix: render as read-only reference (keep the copy affordance, `CopyableValue`, `EnhancedContractMetadataSection.tsx:1214-1216`), drop `required` and exclude it from review flags/verification counting. If a real human-assigned document number is desired later, that's a separate field.

### 5.4 Required asterisks on nearly everything

With Phase 3's `isFieldRequired`, render the asterisk only for genuinely required fields for that contract type. Also audit the schema: fields like `contract_language`, `document_number`, `contract_short_description` marked `required: true` should likely be optional (`required` currently drives both extraction pressure and UI flagging — check `extraction_hint` consumers before loosening extraction-side behavior; if coupled, split into `required` vs `extraction_required`).

### 5.5 Human-readable value formatting

- Contract Language: `en` → "English" via `new Intl.DisplayNames([locale], { type: 'language' })` with fallback to the raw code.
- Jurisdiction/enums already partially formatted (`formatPaymentType`, etc. at `:1249-1251`) — sweep remaining raw-value renders in `renderValue()`.

### 5.6 Collapse clean sections by default

Sections currently render with `defaultOpen` mostly true → very long page. Change: a section defaults open iff it contains ≥1 flagged field; clean sections collapse (header still shows the field count). Keeps the exception-based model coherent: the page opens showing exactly what needs attention.

### 5.7 (Deferred) Component split

`EnhancedContractMetadataSection.tsx` is 2,335 lines. When next touched substantially, extract: `MetadataField` (field card + edit + verify), `MetadataSection` (collapse + header), `useMetadataPersistence` (fetch/save/verify hooks). No behavior change; do it after Phases 1-2 land, not before (avoid conflating refactor with fixes). Section gradient theming in `SECTION_CONFIG` (`:150+`) has decayed to near-identical violet — flatten to one accent while in there.

---

## Suggested execution order & sizing

| Order | Work | Size | Risk |
|---|---|---|---|
| 1 | Phase 1.1-1.4 (persistence bugs) | S-M | Low — bug fixes with tests |
| 2 | Phase 5.1-5.3 (worst UI noise; independent, tiny) | S | Low |
| 3 | Phase 3 (type-aware requirements) | M | Medium — touches list scoring, filter, detail flags; needs test coverage |
| 4 | Phase 2 (exception-based review) | M-L | Medium — UX model change; do after 1 & 3 so flags are trustworthy |
| 5 | Phase 4 (row badge layout) | S-M | Low — visual; verify row height in the list |
| 6 | Phase 5.4-5.6, then 5.7 | S / L | Low |

Project workflow reminders (CLAUDE.md): run `impact` before editing each symbol (`buildMetadataQuality`, `putContractMetadataValidation`, `CompactContractRow`, `EnhancedContractMetadataSection` internals), warn on HIGH/CRITICAL, and `detect_changes()` before each commit. The DB is seeded with generated test artifacts — never delete/reset test contracts without asking.

## Verification checklist (end-to-end, after each phase)

1. Verify a single field → reload → still verified. Kill the API mid-flight → error toast, field not marked.
2. "Verify all" (section and page) → reload → persisted; `customFields` clean.
3. Two tabs editing the same contract → second save gets 409 with reload prompt.
4. NDA without value: no amber badge on list row, no `missing-value` issue, 100% completeness when the rest is present; `missing-value` filter excludes it.
5. Contract with a genuinely missing counterparty: list badge "1 field missing" → click → lands on Details tab with the Parties section auto-expanded and flagged.
6. Long-titled contract on the list: title readable, badges on the second line.
