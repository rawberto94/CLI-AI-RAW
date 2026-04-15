# Drafting Ecosystem UX and IA Proposal

## Product Principle

Document Studio should be the main workspace. Templates, Clauses, and Playbooks should behave as drafting assets that feed Studio, not as equally primary sibling apps.

## Recommended Navigation Shape

- Document Studio
- Templates
- Clause Library
- Policy Packs

## Recommended Meaning Of Each Surface

### Document Studio

- Primary drafting workspace.
- Opens blank drafts, template-based drafts, renewals, and amendments.
- Shows attached policy pack and provenance for inserted language.
- Lets users search and insert clauses without leaving the editor.

### Templates

- Defines reusable document blueprints.
- Should store clause references and structure, not drift into a second drafting editor with disconnected clause state.
- Should let users choose a default policy pack for template families where needed.

### Clause Library

- Stores reusable approved clause language.
- Should be managed centrally and inserted from inside Studio and Templates.
- Should expose origin, usage, risk posture, and recommended policy-pack compatibility.

### Policy Packs

- Defines preferred language, fallbacks, negotiation posture, and red flags.
- Should attach to drafts and optionally to template families.
- Should influence drafting, review, and negotiation consistently.

## Recommended User Flows

### New Draft

1. Choose template or blank draft.
2. Confirm policy pack.
3. Draft inside Studio.
4. Insert clauses from the shared library.
5. Run review with the same attached policy pack.

### From Template

1. Open template.
2. Start draft.
3. Inherit template structure and suggested policy pack.
4. Save provenance as the document evolves.

### From Policy Pack

1. Open policy pack.
2. Start draft in Studio.
3. Carry the selected pack into the new draft record immediately.

## UI Changes Worth Making Next

- In Studio, show the attached policy pack as draft metadata, not only as a top-bar selector.
- Add a provenance panel that distinguishes clause-library, policy-pack, studio-block, and AI-assisted insertions.
- In Templates, replace embedded AI-only clause state with shared clause references.
- In Clause Library, add direct visibility into which templates and drafts reference a clause.
- In Policy Packs, show which active drafts and templates are currently attached.