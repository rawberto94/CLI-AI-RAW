# Drafting Ecosystem Refactor Plan

## Objective

Turn Drafting, Templates, Clauses, and Playbooks into one coherent drafting system instead of four adjacent tools with partial overlap.

## Current Problems

- Playbook selection affects AI behavior, but historically it was not saved with the draft.
- Clause insertion history existed only in local UI state, so provenance disappeared on reload.
- Templates, clause library, and playbooks share the same drafting domain but use different persistence patterns.
- Multiple clause representations exist at once: reusable clause library entries, playbook clauses, embedded template clauses, and embedded draft clauses.

## Target Model

The product should operate as one stack:

1. Playbook defines policy and negotiation posture.
2. Clause Library stores reusable approved language.
3. Template assembles clause references and structure for a document family.
4. Draft persists selected playbook, provenance, and authoring state.
5. Review applies policy and redlining against the same persisted drafting context.

## Phase 1: Implemented In This Change

- Added a durable ContractDraft to Playbook relation.
- Persisted draft playbook selection through create, update, reopen, and duplicate flows.
- Hydrated existing drafts before the copilot canvas mounts so the saved drafting context comes back on reopen.
- Persisted drafting provenance from the canvas into draft JSON so inserted clause and AI source history survives reloads.

## Phase 2: Recommended Next Refactor

- Introduce a first-class draft context object instead of overloading generic JSON buckets.
- Standardize draft provenance to include source type, source record id, insertion mode, and affected text range.
- Make templates reference shared clause library records instead of embedding disconnected clause payloads.
- Make playbook clauses suggest or constrain clause-library choices instead of acting as a separate clause universe.

## Phase 3: Model Consolidation

- Decide the canonical authoring clause model.
- Keep Clause for extracted contract analysis artifacts.
- Keep ClauseLibrary for reusable drafting content.
- Stop resolving template clause references through the extracted Clause model.
- Add a mapping layer between playbook policy rules and clause-library entries.

## Phase 4: Workflow Unification

- Start a draft from template with an attached playbook in one action.
- Show clause provenance and policy-pack attachment in draft metadata and list views.
- Carry the same playbook context from drafting into legal review and negotiation.
- Make duplicate, export, and handoff flows preserve draft context by default.

## Success Criteria

- Reopening a draft restores the same policy pack and provenance trail.
- Duplicating a draft preserves policy context.
- Templates and drafts use the same reusable clause source.
- Review results can explain which playbook and which clause sources shaped the draft.