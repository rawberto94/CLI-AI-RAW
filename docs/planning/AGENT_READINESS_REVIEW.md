# Agent Readiness Review & Implementation Plan

**Date:** 2026-08-05
**Scope:** Whole-repo audit (data layer, AI pipeline, agent ecosystem, engineering quality) against one question: *is the current "datalake" (AI-generated artifacts + metadata in Postgres) a safe foundation for autonomous procurement / contract-management agents running end-to-end?*
**Method:** Code-verified audit of `packages/clients/db`, `packages/workers`, `packages/agents`, `packages/data-orchestration`, `apps/web`, `scripts/`, `docs/`, CI workflows. Findings below cite exact files/lines.

---

## 1. Verdict

**Do not switch technology.** Postgres + Prisma + pgvector + BullMQ + object storage is the right stack for this system — ahead of most LLM pipelines. The gaps are **governance and consistency**, not tools:

- The same critical facts (TCV, parties, dates) live in 4+ places with no single source of truth, and your own runbook treats pre-demo data repair as routine.
- Tenant isolation is enforced by convention, not by the database. The live RAG write path doesn't even populate `tenantId` on embeddings.
- AI outputs are validated shallowly (`json_object` + `.passthrough()` zod), while the strict client you already built sits unused.
- Three agent frameworks coexist; ~97k lines of `data-orchestration` are effectively dead; several agents silently no-op in production.
- CI can report green while unit tests fail; strict TypeScript is advisory.

A technology switch (lakehouse, dedicated vector DB, new agent framework) would cost months and fix none of these. **Keep the stack. Enforce the discipline.** This is an operational contract-intelligence store that agents will *act* on — a higher bar than a datalake, and the bar is trust, not throughput.

**Readiness estimate:** data foundation ~70% there; autonomy readiness ~40%. Phase 0 below is a hard prerequisite — every procurement-agent scenario (auto-renewal, RFx award, negotiation) sits directly on top of the fields that are currently least trustworthy.

---

## 2. Scorecard

| Area | Grade | Evidence |
|---|---|---|
| Pipeline plumbing (queues, idempotency, retries, DLQ) | Strong | BullMQ, deterministic job IDs, content-hash guards, outbox, circuit breakers — `packages/utils/src/queue/contract-queue.ts` |
| AI artifact provenance | Strong | `Artifact.modelUsed/promptVersion/tokensUsed/processingCost/confidence/qualityScore` — `schema.prisma:1098` |
| Retrieval infra | Strong | pgvector HNSW + halfvec, hybrid BM25/trigram, adaptive chunking |
| Confidence-tiered auto-apply + human review | Good design | ≥0.85 auto, 0.4–0.85 review band, per-tenant calibration from corrections |
| Agent substrate tables | Good on paper | `AgentGoal/Trigger`, `AiDecision` (citations, evidence chains), `ExtractionCorrection`, approval gates |
| Trustworthiness of critical fields | **Weak** | `docs/AI_DATA_QUALITY_RUNBOOK.md` institutionalizes pre-demo TCV/date/party repairs |
| Single source of truth | **Weak** | Same fact in ≥4 places — `docs/OCR_PARTY_SYNC_ISSUE.md`; fix was a UI fallback chain |
| Tenant isolation | **Weak** | No working RLS (stale script references non-existent tables), no-op middleware, nullable `tenantId` |
| Schema governance | **Weak** | 4 parallel migration channels; `embeddingHalf` column in DB but not in Prisma; prod patched by hand |
| AI output validation | Mediocre | `json_object` + `JSON.parse` + `.passthrough()` zod; strict json_schema/AJV client unused in hot path |
| Agent layer coherence | **Weak** | 3 frameworks; ~97k lines mostly-dead `data-orchestration`; agents that read `OPENAI_API_KEY` no-op on Azure |
| Eval / measurement | **Absent** | No eval suite, no prompt regression tests, workers have no test script |
| Type safety / CI honesty | **Weak** | `strict: false`, ~2,200 `any`s, ~4k advisory strict violations; `test:unit \|\| test` masks failures; `tsc \|\| exit 0` |
| Docs | Contradictory | 96 files in `docs/`; agent counts 12/13/15/19/21 across docs — none match code (21 registered) |

---

## 3. Strengths — keep and build on

1. **Real queue architecture**: deterministic job IDs, `@@unique([contractId, type])`, content-hash compare-before-write, DLQ with 30-day retention, transactional `OutboxEvent`, backpressure, TPM-aware pooling, per-tenant cost budgets. Re-running a contract does not duplicate data.
2. **Artifact provenance discipline**: model, prompt version, tokens, cost, confidence, quality/completeness/accuracy scores, user verification flag on every artifact.
3. **Confidence-tiered application with calibration from human corrections** — the correct shape for safe autonomy.
4. **Deterministic audit scripts** (`scripts/audit-tcv-quality.ts`, `scripts/audit-critical-fields.ts`) that re-derive financial facts from `rawText` and compare against AI values — the right idea, currently used as pre-demo firefighting instead of gates.
5. **Observability**: OpenTelemetry + Prometheus + Sentry — better than most products at this stage.
6. **`Obligation` model** (`schema.prisma:1607`): source page, excerpt, confidence, dependencies, escalation, history — the template for agent-facing models.
7. **Production-grade Azure Document Intelligence integration**: structured field evidence, residency controls, cost caps, circuit-breaker fallback chain.

---

## 4. Findings (ranked by damage to autonomous agents)

- **F1 — Agents will act on data you don't trust.** TCV/parties/dates are known-unreliable ("plausible-looking but not supported by the strongest evidence") and stored redundantly (`contract.clientName`, `contract.external_parties`, `ContractMetadata.customFields`, parties artifact). The sync invariant (Option C in `docs/OCR_PARTY_SYNC_ISSUE.md`) was explicitly deferred.
- **F2 — Tenant isolation is convention, not enforcement.** `enable_rls.sql` references tables that don't exist (`ContractClause`, `Tag`, `ApprovalRequest`); the Prisma middleware hard-checks only `create`/`upsert` for 9 models (`packages/clients/db/index.ts:111`); most code paths use plain `new PrismaClient()`; `tenantId` is nullable on `ContractEmbedding`, `ContractVersion`, `WorkflowExecution`; `Party` is global across tenants.
- **F3 — Live RAG write path drops tenant columns.** 4 of 6 `ContractEmbedding` write paths omit `tenantId`/`contractType` (`rag-indexing-worker.ts:610` raw INSERT, `:730` createMany fallback, `advanced-rag.service.ts:1495`, `scripts/generate-embeddings.ts`), while vector search filters strictly on `ce."tenantId"` (`advanced-rag.service.ts:330`) → freshly indexed contracts are invisible to tenant-filtered search until a manual reindex.
- **F4 — Unguarded agent writes.** `agent-orchestrator-worker.ts:541-544` executes `update_field` actions as raw `prisma.contract.update({ [action.field]: action.value })` — no allowlist, no approval gate, no value validation.
- **F5 — The agent layer mostly doesn't run in production.** Default split mode: OCR worker returns early (`ocr-artifact-worker.ts:2631-2638`); the `AGENT_ORCHESTRATION` enqueue at `:4178` is unreachable and `artifact-generator.ts` never enqueues it. Agent repair loops / intelligence passes only fire via cron or manual API calls.
- **F6 — No lineage.** Artifacts overwrite in place on regeneration (`@@unique([contractId, type])`; `generationVersion` increments but history is not retained); no `runId` links an artifact to its producing run; embedding chunks persist only `section` — page/char offsets are computed but dropped (`adaptive-chunker.ts:147`, `rag-indexing-worker.ts:408`).
- **F7 — Duplicate models with no canonical choice.** `Artifact` vs `ContractArtifact` (`schema.prisma:906`) vs `OverviewAnalysis`/`FinancialAnalysis`/`TemplateAnalysis`; `Embedding` (vector as `Json?`, effectively dead) vs `ContractEmbedding`; `AgentMemory` (embedding as `Json?`) vs `AiMemory` (proper `vector(1024)`).
- **F8 — Shallow validation.** Hot path is `response_format: json_object` + `JSON.parse` + zod schemas that are all `.passthrough()` with nearly everything `.optional()` (`packages/workers/src/utils/artifact-schema-validator.ts`). The strict client (`packages/clients/openai/index.ts`: json_schema strict mode / AJV with 3-attempt repair) is built but unused. `packages/schemas` is stale (base marked `TODO`, V1 shapes don't match generator output).
- **F9 — LLM client inconsistency.** Several agents use `new OpenAI({ apiKey: OPENAI_API_KEY })` (`proactive-risk-detector.ts:9`, `packages/agents/autonomous-orchestrator.ts:28`) — silently no-op inside try/catch in the Azure-only deployment. `AZURE_OPENAI_MINI_DEPLOYMENT` is unset in helm, so "mini" calls collapse onto the gpt-4o deployment (cost leak).
- **F10 — Migration sprawl.** 48 Prisma migration dirs + 35 loose numbered `.sql` files in the same folder + 3 in `scripts/migrations/` + `data/production-schema-setup.sql` (manual prod hotfix, 2026-03-19). `embeddingHalf halfvec(1024)` (from `init/03`) is not in the Prisma schema but is queried by `advanced-rag.service.ts:387` — a `migrate diff`/`db push` would drop it. Migration `20260223000000_vector_1024_artifact_chunks` TRUNCATEd `ContractEmbedding`. `packages/clients/db/package.json` migration scripts reference `../../../apps/api/.env`, which doesn't exist.
- **F11 — Quality gates can lie.** CI: `pnpm run test:unit || pnpm run test` (`.github/workflows/ci.yml:90`) — red unit tests can be masked by the e2e fallback's exit code. `strict-core.yml` is `continue-on-error` with ~4k known violations. `packages/data-orchestration` builds with `tsc || exit 0`. `apps/web` has `strict: false`, ~1,249 `: any` + 930 `as any`, and excludes whole API subsystems from typechecking (`tsconfig.json:105-114`). Root `pnpm test` runs Playwright e2e, not unit tests. `packages/workers` has no test script at all.
- **F12 — Three agent frameworks + dead code.** Workers `BaseAgent` (21 registered agents), LangChain `packages/agents` (2,334-line autonomous orchestrator, 867-line ReAct), and ~97.5k lines of `packages/data-orchestration` of which exactly one service (`agentContextEnrichmentService`) is imported. `multi-agent-debate.service.ts` (956 lines) has zero imports. The chat plane (`apps/web/app/api/agents/chat/route.ts`, 21 handlers) shares codenames with worker agents but is separate code — two AI planes that don't intersect.
- **F13 — Security posture.** April 2026 ransomware event artifacts in `tmp/incident-2026-04-23/` (ransomed Postgres). Azure audit (2026-05-29): publicly reachable Key Vault/OpenAI endpoints, `GlobalStandard` embedding deployment violating Swiss residency. Session-cookie dumps in the working tree (`cookies.txt`, `owner_cookies.txt`, `csrf_response.txt`, `signup_stderr*.txt` — gitignored but present).
- **F14 — No measurement loop.** No eval suite, no golden dataset, no prompt regression gates; `ab_test_winners` is read but nothing writes it.
- **F15 — Doc sprawl.** 96 docs in `docs/`; `docs/INDEX.md` claims 34. Agent counts: 12 (audits) → 13 → 15 → 19 → 21 (code). `SYSTEM_ARCHITECTURE.md` is deprecated with a broken successor link. Four overlapping agent improvement plans from Feb 2026, partially landed.

---

## 5. What NOT to do

1. **Don't switch the database, vector store, or queue.** Postgres + pgvector + BullMQ is fit for purpose. A "real lakehouse" (Databricks/Spark/Snowflake) solves an analytics problem you don't have — agents need an operational store with lineage, not a lake. If analytics is ever needed, add CDC to a warehouse later.
2. **Don't add new agents before Phase 0.** Every new autonomous actor multiplies the blast radius of F1–F4.
3. **Don't rewrite the pipeline.** The plumbing is good. Fix enforcement inside it.
4. **Don't keep building on both AI planes** — pick one before the procurement stage (P2-3/P2-4).
5. **Don't write more planning docs** that describe aspiration as fact. This document replaces; it doesn't join the pile (see P2-6).

---

## 6. Implementation plan

Sequencing: Phase 0 is a hard gate for any new autonomy. Phases 1 and 2 partially overlap; within each phase, tickets are ordered by dependency. Effort: **S** ≤2 days, **M** ≈1 week, **L** ≈2–3 weeks (single-engineer estimate, no parallelism assumed).

### Phase 0 — Trust the data (weeks 1–6) — HARD PREREQUISITE

#### P0-1 · Single source of truth for critical fields — L
**Why:** F1. Autonomous renewal/negotiation against a hallucinated TCV is a liability, not a demo bug.
**Files:** `packages/clients/db/schema.prisma` (`Contract`, `ContractMetadata`, `Artifact`), `scripts/audit-tcv-quality.ts`, `scripts/audit-critical-fields.ts`, `apps/web/lib/contracts/**` (UI fallback chains), `docs/OCR_PARTY_SYNC_ISSUE.md`.
**Steps:**
1. Declare the canonical store per critical field (recommendation: relational `Contract` columns for TCV/dates/parties/renewal — queryable, constrainable, indexable).
2. Make every other representation derived: parties artifact and `customFields` mirrors are regenerated from canonical on write, never independently authored by AI.
3. Implement the deferred "sync job" (Option C in the OCR issue doc) as an invariant enforcer, not a UI fallback: a worker that recomputes derived stores from canonical and alerts on drift.
4. Promote `audit-tcv-quality.ts` / `audit-critical-fields.ts` into a CI gate: run against a fixed corpus on every PR that touches extraction/artifact code; fail on mismatch above threshold. Remove the demo-file default scope; corpus = representative contract set.
5. Remove UI fallback chains that mask inconsistency; surface "value unverified" states instead.
**Acceptance:** for TCV, parties, start/end dates, renewal terms — exactly one writable store; derived stores regenerate deterministically; CI gate fails a seeded hallucination test.

#### P0-2 · Tenant isolation enforced at the database — M
**Why:** F2/F3. Agents writing cross-contract workflows amplify any tenant leak.
**Files:** `packages/clients/db/migrations/enable_rls.sql`, `packages/clients/db/index.ts:111`, `apps/web/lib/prisma.ts`, `packages/workers/src/**`, `packages/agents/src/**`, `schema.prisma` (nullable `tenantId` columns, `Party`).
**Steps:**
1. Rewrite RLS policies against the *current* schema (the existing script references tables that no longer exist). Cover `Contract`, `Artifact`, `ContractEmbedding`, `ContractMetadata`, `Obligation`, `ContractVersion`, `WorkflowExecution` at minimum.
2. Set `app.tenant_id` via a session variable on every connection; enforce with `FORCE ROW LEVEL SECURITY`. Workers set it from job payload.
3. Make `tenantId` non-nullable on `ContractEmbedding`, `ContractVersion`, `WorkflowExecution` (backfill first).
4. Scope `Party` per tenant (add `tenantId`, change unique to `@@unique([tenantId, name, type])`) or document a deliberate shared-registry decision.
5. Replace the "silent check" middleware with a hard-fail guard on reads/updates for tenant-scoped models, or delete it once RLS makes it redundant.
6. Add integration tests: tenant A cannot read/write tenant B rows via any client path (app, workers, agents, scripts).
**Acceptance:** RLS enabled in staging with app + workers green; cross-tenant access test suite fails closed; no nullable `tenantId` on the listed tables.

#### P0-3 · Fix embedding tenant columns on all write paths — S
**Why:** F3 — freshly indexed contracts are invisible to tenant-filtered vector search today.
**Files:** `packages/workers/src/rag/rag-indexing-worker.ts:610,730`, `apps/web/lib/rag/advanced-rag.service.ts:1495`, `scripts/generate-embeddings.ts`, `scripts/enhance-chatbot-knowledge.ts`.
**Steps:**
1. Populate `tenantId`/`contractType` in all six write paths (fetch from the parent `Contract` at write time).
2. Backfill existing rows: `UPDATE "ContractEmbedding" ce SET "tenantId" = c."tenantId" FROM "Contract" c WHERE ce."contractId" = c.id AND ce."tenantId" IS NULL`.
3. Add a uniqueness + NOT NULL constraint (after P0-2 backfill) and a regression test asserting every inserted chunk carries tenant columns.
**Acceptance:** zero NULL `tenantId` in `ContractEmbedding`; new uploads are searchable under tenant filter without manual reindex.

#### P0-4 · Allowlist + audit every agent write — M
**Why:** F4. Unguarded arbitrary-field updates are disqualifying for autonomy.
**Files:** `packages/workers/src/agents/agent-orchestrator-worker.ts:541-544`, `schema.prisma` (`AiDecision`), `packages/workers/src/agents/base-agent.ts`.
**Steps:**
1. Introduce a write-gateway service: the only path agents may use to mutate domain tables. Inputs: agent id, entity, field, value, evidence.
2. Per-entity allowlist of agent-mutable fields (start small: status, tags, review flags; **not** TCV/dates/parties — those flow through extraction + human review).
3. Per-field zod validation before write; reject and log on failure.
4. Every write (approved auto or HITL) recorded as an `AiDecision` row with `citations`/`evidenceChain` populated.
5. Approval thresholds: low-risk fields auto-apply, financial/legal fields require `awaiting_approval` gate (the HITL machinery already exists in goal execution).
6. Remove the raw `prisma.contract.update({ [field]: value })` action loop.
**Acceptance:** no agent code path calls Prisma update directly on domain models; 100% of agent writes have an `AiDecision` audit row; attempt to write a non-allowlisted field is rejected and logged.

#### P0-5 · Restore the agent tick in split mode — S
**Why:** F5 — intelligence passes and repair loops silently don't run on upload in the default configuration.
**Files:** `packages/workers/src/ocr-artifact-worker.ts:2631-2638,4178`, `packages/workers/src/artifact-generator.ts` (completion path).
**Steps:**
1. After artifact generation completes (all artifacts terminal), enqueue `AGENT_ORCHESTRATION` with the deterministic jobId convention (`agent-{contractId}-{iteration}`) from `artifact-generator.ts`.
2. Delete or rewire the unreachable enqueue at `ocr-artifact-worker.ts:4178`.
3. Add a test: upload → pipeline completes → orchestrator job exists and reaches terminal state.
**Acceptance:** in split mode, a fresh upload triggers the agent layer end-to-end; verified in staging logs.

#### P0-6 · Close the known security exposures — M
**Why:** F13. Agents with write access raise the blast radius of every open exposure. One ransomware event already happened.
**Files:** `docs/security/AZURE_CYBERSECURITY_AUDIT_2026-05-29.md`, `infrastructure/azure/main.bicep`, `helm/contigo/**`, working tree.
**Steps:**
1. Private endpoints / firewall rules for Key Vault and Azure OpenAI (per the audit's open items).
2. Move the embedding deployment off `GlobalStandard` to a Swiss-resident SKU (residency violation flagged in the audit).
3. Delete cookie/session dumps from the working tree; add a pre-commit/CI check that blocks `*cookies*.txt`, `*_stderr*.txt`, etc.
4. Write the postmortem for `tmp/incident-2026-04-23/` (attack vector: exposed Postgres, weak creds) and verify the fixes: no public DB port, rotated credentials, `priv_esc` role removed.
5. Confirm Defender/backup registration items from the audit are closed.
**Acceptance:** all "open" items in the May 2026 audit closed or explicitly risk-accepted in writing; no secrets/session material in the working tree.

---

### Phase 1 — Make AI output machine-trustworthy (weeks 5–10)

#### P1-1 · Strict structured outputs in the hot path — M
**Why:** F8. Agents need schema-guaranteed data, not "object with maybe these keys."
**Files:** `packages/clients/openai/index.ts` (existing strict client), `packages/workers/src/artifact-generator.ts`, `utils/artifact-prompts.ts`, `metadata-extraction-worker.ts`.
**Steps:**
1. Convert the 15 artifact-type prompts to `json_schema` strict mode (or the AJV + 3-attempt repair path) via the existing client.
2. Same for metadata extraction and categorization calls.
3. Keep the grouped-call optimization (3–4 calls instead of 14) — schema per group.
**Acceptance:** zero `JSON.parse` of raw LLM text in the artifact/metadata path; malformed-output rate measurably drops (log it).

#### P1-2 · Tighten artifact validation; fix or delete `packages/schemas` — S
**Why:** F8. `.passthrough()` + all-optional schemas assert almost nothing.
**Files:** `packages/workers/src/utils/artifact-schema-validator.ts`, `packages/schemas/**`.
**Steps:**
1. For the 5–6 highest-stakes artifact types (financial, parties, dates, obligations, renewal): required keys, no passthrough, semantic checks (dates parse, currency amounts numeric, parties non-empty).
2. Either regenerate `packages/schemas` from the validator schemas (single source) or delete the package. No two divergent schema homes.
**Acceptance:** seeded schema-violating LLM output is rejected and retried; one canonical schema location.

#### P1-3 · One LLM client factory — S
**Why:** F9 — agents silently dead in prod; hidden cost leak on the mini deployment.
**Files:** `proactive-risk-detector.ts:9`, `packages/agents/autonomous-orchestrator.ts:28`, `packages/clients/openai/**`, `helm/contigo/values.yaml`.
**Steps:**
1. Single factory: returns AzureOpenAI clients (full + mini), throws loudly at startup if config is missing.
2. Migrate every `new OpenAI(...)` call site to the factory. Grep-enforce in CI (`new OpenAI` outside the factory = fail).
3. Set `AZURE_OPENAI_MINI_DEPLOYMENT` in helm (or explicitly alias to the main deployment with a cost note).
**Acceptance:** no direct OpenAI client construction outside the factory; agents log real errors instead of no-oping.

#### P1-4 · Canonicalize duplicate models — M
**Why:** F7. Agents will write to the wrong store.
**Files:** `schema.prisma` (`Artifact` vs `ContractArtifact` vs `OverviewAnalysis`/`FinancialAnalysis`/`TemplateAnalysis`; `Embedding` vs `ContractEmbedding`; `AgentMemory` vs `AiMemory`).
**Steps:**
1. Declare canonical: `Artifact`, `ContractEmbedding`, `AiMemory` (proper vector type).
2. Migrate live readers/writers off the duplicates; backfill anything valuable.
3. Drop dead models (`Embedding`, `ContractArtifact`, the three parallel analysis tables, `AgentMemory`) in one migration after a deprecation window.
**Acceptance:** one table per concept; zero code references to the dropped models.

#### P1-5 · First-class lineage — M
**Why:** F6. An agent must answer "which run produced this value, and where's the evidence in the document?"
**Files:** `schema.prisma` (`Artifact`, `Run`, `ContractEmbedding`), `packages/workers/src/artifact-generator.ts`, `rag-indexing-worker.ts:408`, `adaptive-chunker.ts:147`.
**Steps:**
1. Add `runId` to `Artifact` (and `ContractMetadata` AI caches); populate from the processing run.
2. Stop overwrite-on-regenerate: insert a new generation row (or an `ArtifactGeneration` history table) so prior outputs are retained and comparable.
3. Persist `pageStart/pageEnd/startChar/endChar` on `ContractEmbedding` (already computed by the chunker — just store them).
4. Surface lineage in the artifact `_meta` so agents can cite page-level evidence.
**Acceptance:** every artifact value traceable to (run, model, prompt version, source pages); regeneration preserves history.

#### P1-6 · Consolidate migrations under Prisma + drift check — S
**Why:** F10. Four migration channels and an orphan column are a production incident waiting to happen.
**Files:** `packages/clients/db/migrations/**` (48 dirs + 35 loose `.sql`), `scripts/migrations/**`, `data/production-schema-setup.sql`, `init/03-halfvec-quantization.sql`, `packages/clients/db/package.json`.
**Steps:**
1. Bring `embeddingHalf halfvec(1024)` into Prisma as `Unsupported("halfvec(1024)")` (or a tracked raw migration) so `migrate diff` knows about it.
2. Archive loose `.sql` files into `migrations/archive/` with a README stating they are historical; Prisma is the only channel going forward.
3. Fix `packages/clients/db/package.json` scripts (`apps/api/.env` path doesn't exist).
4. CI job: `prisma migrate diff` against a shadow DB; fail on drift.
**Acceptance:** `migrate diff` clean; single migration channel; prod hotfix file reconciled into a proper migration.

---

### Phase 2 — Autonomy readiness (weeks 9–16)

#### P2-1 · Eval harness with golden ground truth — L
**Why:** F14. Without measurement, every prompt/model change is a coin flip, and autonomy can't be gated.
**Steps:**
1. Build a golden set: 30–50 representative contracts with human-verified ground truth for TCV, parties, dates, renewal, obligations, classification.
2. Harness: run extraction/artifacts on the golden set, score field-level accuracy, store results per (model, promptVersion) — extend the `extractFinancialEvidence`/`assessCriticalContractEvidence` deterministic-check pattern.
3. CI gate: prompt/model changes must not regress the golden score beyond a threshold.
4. Wire the `ab_test_winners` write path or delete the A/B machinery.
**Acceptance:** golden-run report in CI; a deliberately degraded prompt fails the gate.

#### P2-2 · Make CI honest — M
**Why:** F11. You cannot gate agent-generated changes on a pipeline that can lie.
**Files:** `.github/workflows/ci.yml:90`, `strict-core.yml`, `packages/data-orchestration/package.json`, `apps/web/tsconfig.json:6,105-114`, root `package.json`.
**Steps:**
1. `test:unit || test` → run both, both must pass. Add postgres/redis services to the CI test job.
2. Root `test` should run unit tests; e2e stays a separate job.
3. `tsc || exit 0` → real build failure.
4. Strict mode: enforce on agent-touched paths first (workers, agents, artifact/metadata libs) via `tsconfig.strict-core.json` as a **failing** check; ratchet the rest (baseline file, no new violations).
5. Add a test script to `packages/workers`; raise coverage thresholds on the write-gateway and validator.
**Acceptance:** CI red when unit tests fail or when agent-path strict violations are introduced.

#### P2-3 · One agent framework — M
**Why:** F12. Three frameworks = triple maintenance and ambiguous ownership for every new capability.
**Steps:**
1. Decide: the workers `BaseAgent` registry (21 agents, wired to the pipeline) is the survivor — the LangChain stack's unique value (goal decomposition, HITL gates) is ported behind the BaseAgent interface, then `packages/agents` is archived.
2. Quarantine `packages/data-orchestration`: extract `agentContextEnrichmentService` into `packages/utils` (its only live consumer), archive the remaining ~97k lines. Fix the swallowed build errors first if anything is salvaged.
3. Delete `multi-agent-debate.service.ts` and other zero-import services.
**Acceptance:** one agent base class, one registry, one place to add a tool; repo builds without the archived packages.

#### P2-4 · Merge the two AI planes — M
**Why:** F12 — chat handlers and worker agents share codenames but not code; capabilities diverge silently.
**Files:** `apps/web/app/api/agents/chat/route.ts` (1,790 lines, 21 handlers), `packages/workers/src/agents/**`.
**Steps:**
1. Chat handlers become thin adapters over a shared tool layer (the same DB-backed capabilities the worker agents use), not parallel GPT-narrative implementations.
2. One codename ↔ one implementation registry; docs generated from the registry, not hand-maintained.
**Acceptance:** removing a capability from the registry removes it from chat and workers simultaneously.

#### P2-5 · RFx: finish the lifecycle or cut scope — M
**Why:** the next stage's flagship. Backend exists (procurement + detection agents, 2 models, opportunities API) but phases 2–6 have no UI, `CreateRFxModal` only toasts, `RFX_*` env vars are unconsumed, Neo4j node types are defined but never populated.
**Files:** `packages/workers/src/agents/rfx-procurement-agent.ts`, `rfx-detection-agent.ts`, `docs/features/RFx_UI_BEHAVIOR_SPEC.md`, `RFx_ENHANCEMENT_ROADMAP.md`.
**Steps:**
1. Implement the 6-phase lifecycle UI with the 5 HITL checkpoints from the spec (award approval = mandatory human).
2. Wire or remove the three `RFX_*` env vars.
3. Decide Neo4j: populate and use it, or remove the dependency — no zombie integrations.
4. All RFx writes flow through the P0-4 write gateway.
**Acceptance:** create → shortlist → bids → compare → award (HITL) → negotiate runs end-to-end in staging with audit rows for every agent action.

#### P2-6 · Doc consolidation — S
**Why:** F15. Contradictory docs mislead humans *and* coding agents.
**Steps:**
1. `docs/architecture/END_TO_END_ARCHITECTURE.md` becomes the single living architecture doc; mark the other ~18 architecture docs as historical (move to `docs/archive/`) and fix the broken supersession link.
2. Regenerate the agent roster from the code registry (script → checked-in generated file).
3. Update `docs/INDEX.md` (claims 34 docs; there are 96).
4. Rule going forward: status claims must cite code; "✅ Complete" requires a linked test or route.
**Acceptance:** one authoritative architecture doc; agent counts in docs match the registry; INDEX accurate.

---

## 7. Dependency map

```
P0-1 (source of truth) ──┐
P0-2 (RLS) ──────────────┼──► P0-4 (write gateway) ──► P2-5 (RFx lifecycle)
P0-3 (embedding tenant) ─┘         │
P0-5 (agent tick) ─────────────────┘
P0-6 (security) ── independent, start immediately
P1-1/P1-2 (strict outputs) ──► P2-1 (eval harness scores them)
P1-3 (client factory) ──► P2-3 (framework consolidation)
P1-4/P1-5 (canonical models, lineage) ──► P2-1, P2-5
P1-6 (migrations) ──► everything schema-related
P2-2 (CI honesty) ── gates all later work
```

Suggested start order (first two weeks): **P0-6** (security, independent), **P0-3** (small, high impact), **P0-5** (small), **P1-6** (unblocks schema work), then **P0-1/P0-2** in parallel.

---

## 8. Definition of done — "agent-ready"

The system is ready for end-to-end procurement/contract-management agents when **all** of these are true:

1. Critical fields (TCV, parties, dates, renewal) have one writable store; the CI invariant gate is green on the golden corpus.
2. RLS enforced in production; cross-tenant test suite fails closed; zero NULL `tenantId` on embeddings.
3. 100% of agent writes go through the gateway: allowlisted, validated, and recorded in `AiDecision` with evidence.
4. Every artifact value traceable to (run, model, prompt version, source page).
5. Strict structured outputs on all extraction/artifact calls; malformed-output retry path proven.
6. Golden-set eval gates every prompt/model change in CI; CI cannot mask failures.
7. One agent framework, one LLM client factory, one table per concept.
8. Agent layer runs automatically on every upload in the default (split) configuration.
9. Security audit items closed; no public data-plane endpoints.
10. Docs match code: one architecture doc, generated agent registry, accurate index.

---

*Sources: code-verified audit of `packages/clients/db/schema.prisma`, `packages/workers/src/**`, `packages/agents/src/**`, `packages/data-orchestration/src/**`, `apps/web/**`, `scripts/`, `.github/workflows/`, `init/`, `data/`, `helm/`, `infrastructure/`, and `docs/` (96 files). Key evidence cited inline per finding.*
