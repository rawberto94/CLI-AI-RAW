# ADR: Critical-field single source of truth & agent write policy

**Status:** Accepted (Wave C)  
**Date:** 2026-08-05  
**Related:** [AGENT_READINESS_REVIEW.md](../planning/AGENT_READINESS_REVIEW.md)

## Context

The same facts (TCV, parties, dates, renewal) lived in multiple stores. Agents and UI fell back between them, masking drift. Autonomous agents cannot safely act on multi-writer fields.

## Decision

### Canonical writable store

| Concept | Canonical columns on `Contract` | Derived (regenerated / display) |
|---|---|---|
| TCV | `totalValue`, `currency` | FINANCIAL artifact, `aiMetadata.tcv_*`, metadata mirrors |
| Annual / monthly | `annualValue`, `monthlyValue` | same |
| Start | **`effectiveDate`** (prefer over dual `startDate`) | dates / overview artifacts |
| End | **`expirationDate`** (prefer over dual `endDate`) | dates / overview artifacts |
| Parties | `clientName`, `supplierName`, `external_parties` (JSON) | PARTIES / overview artifacts, metadata `customFields` |
| Renewal | `autoRenewalEnabled`, `renewalTerms`, `noticePeriodDays` | renewal artifact |

### Who may write canonical columns

1. **Extraction pipeline** (OCR / artifact apply / metadata extraction with auto-apply thresholds)  
2. **Human edit APIs** (metadata editor, contract PUT)  
3. **Audit repair tools** (`audit-tcv-quality --apply`, etc.)  

**Agents never write these columns.** The write-gateway denylist enforces this.

### Trust vocabulary

Shared in `@repo/utils` (`field-trust`, `agent-write-policy`, `critical-fields`):

- Thresholds: high **0.85**, medium **0.65**, low **0.4**
- `FieldTrust`: `canonical_verified` | `ai_high` | `ai_review` | `ai_low` | `conflict` | `missing` | `pending_agent`

### Sync enforcer

`runCriticalFieldSync` recomputes derived party mirrors from canonical names when empty, and records TCV/date drift between Contract columns and artifacts into `ContractMetadata.systemFields.criticalFieldSync` for UI badges — it does **not** auto-overwrite canonical columns from artifacts.

### UI

- Prefer API `criticalFields` for chips next to values  
- Client-side party invention from `clientName` is behind `LEGACY_PARTY_FALLBACK` (default on until sync is proven)

## Tenant isolation (Wave D)

- App guard: `packages/clients/db/src/tenant-guard.ts` — writes always require `tenantId`; strict reads via `TENANT_GUARD_STRICT=true`
- Transaction helper: `withTenant(prisma, tenantId, fn)` sets `app.tenant_id` + `app.current_tenant` with `SET LOCAL`
- Migration `20260805120000_tenant_guard_embedding_rls`: backfill embeddings, `tenantId NOT NULL`, RLS **ENABLE** (not FORCE) on core tables
- FORCE RLS is a follow-up after staging soak

## Consequences

- Agents act only on allowlisted non-critical fields via gateway + HITL  
- Portfolio metrics should eventually exclude `ai_low` / `conflict` (follow-up)  
- Dual date columns remain until a dedicated migration collapses `startDate`/`endDate`  
- Apply DB migrate before deploying code that assumes non-null embedding `tenantId`
