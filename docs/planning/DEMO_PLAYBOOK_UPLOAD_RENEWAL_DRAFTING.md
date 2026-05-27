# Contigo Demo Playbook: Upload, Extraction, Renewals, and Drafting

Use this as the practical run-of-show for a customer, investor, partner, or internal stakeholder demo. The goal is not to show every screen. The goal is to make the viewer understand one clear story:

> Contigo turns static contracts into structured intelligence, then turns that intelligence into action: renewal decisions, negotiation preparation, and governed drafting.

## Demo Positioning

### The One-Line Pitch

Contigo is not just a contract repository. It is an AI-native contract workspace that reads agreements, extracts the facts that matter, flags action items, and helps teams create the next document.

### What The Viewer Should Remember

- Uploading a PDF is the start of an intelligence pipeline, not just file storage.
- The platform extracts business facts: parties, dates, value, obligations, risks, renewals, signatures, and financial terms.
- The renewal workflow turns passive expiry dates into an operational queue.
- Drafting closes the loop by creating the renewal, amendment, or new contract with policy-aware AI support.
- The product is useful because it connects review, decision, and action in one workflow.

### Best Audience Framing

For legal teams:

- "You get faster first-pass review, structured evidence, risk visibility, and controlled drafting."

For procurement and finance:

- "You stop missing renewals, price increases, notice windows, and contract value exposure."

For executives:

- "You get contract visibility without asking legal or procurement to manually build spreadsheets."

For technology buyers:

- "The system is tenant-aware, API-driven, built around structured data, and uses AI as part of a controlled workflow rather than a loose chatbot."

## Demo Principle

Do not demo features as isolated menu items. Demo the lifecycle:

1. A contract arrives.
2. Contigo reads it.
3. Contigo turns it into facts and review findings.
4. Those facts create a renewal action.
5. The renewal action creates a draft.
6. The draft is reviewed, improved, and finalized.

That arc sells the product better than clicking through every tab.

## Pre-Demo Checklist

### Data And Environment

- App is running locally or in the demo environment.
- Login works with a seeded demo user, for example `admin@acme.com` / `password123`.
- Have an upload PDF ready. A local sample exists at `realistic_contract.pdf` in the workspace root.
- In the current local demo database, `realistic_contract.pdf` has already been uploaded. Re-uploading that exact file demonstrates duplicate detection, not fresh processing. For a clean live upload moment, use a new PDF; otherwise upload briefly to show duplicate protection, then open the existing processed `realistic_contract.pdf` record.
- Run the renewal seed if the Renewals page is empty:

```bash
pnpm tsx scripts/seed-renewals-demo.ts
```

If you run it against Docker Postgres, use the same `DATABASE_URL` pattern you use for other local scripts. The script is idempotent and creates a demo renewal contract for `acme`, `demo`, `tenant-roberto`, and `tenant-florian`.

### Demo Contracts To Use

Use these two contracts for a smooth story:

- Upload demo: `realistic_contract.pdf` to show ingestion and extraction.
- Renewal demo: `DEMO Renewal Showcase - Cloud Support Agreement` on the Renewals page.
- Drafting demo: `DEMO Renewal Amendment - Helvetic Cloud Services AG` is a prepared renewal-sourced draft for the Copilot editor.

Why two contracts? Upload processing can take time. Start with a live upload to show credibility, then use the already seeded renewal contract to keep the demo moving.

### Browser Setup

- Open `/contracts` in one tab.
- Open `/renewals` in another tab.
- Open `/drafting` or `/drafting/copilot` in a third tab if you want a fast handoff.
- Close the first-run welcome tour before the live demo if it appears for the demo user.
- Keep the terminal hidden unless the viewer is technical.

### Safety Notes

- Do not claim the AI provides legal advice. Say it accelerates review and drafting for human approval.
- Do not over-emphasize confidence percentages. Emphasize evidence, reviewability, and workflow action.
- If AI processing is slow, say: "This runs asynchronously in production, so users can leave the page and come back to completed analysis."

## Recommended 12-Minute Demo Flow

### 0:00-1:00 - Set The Pain

Talk track:

> Most contract systems are good at storing documents, but the business problem is not storage. The problem is knowing what is inside the document and what action to take next. Contigo starts with upload, but the real value is turning the contract into structured operational intelligence.

What to show:

- Contracts or dashboard page.
- Keep this short. The product should do the explaining.

### 1:00-3:00 - Upload A Contract

What to do:

1. Go to `/contracts` or the upload entry point.
2. Upload `realistic_contract.pdf`.
3. Show that the system creates a contract record and starts processing.

Talk track:

> The upload is tenant-scoped, validated, stored, and processed. The important point is that Contigo does not stop at saving the file. It immediately starts extracting text, metadata, financial terms, dates, parties, and review artifacts.

What to emphasize:

- Upload is secure and structured.
- OCR and AI extraction are part of the same pipeline.
- Users do not need to manually fill every field.

Avoid:

- Spending too long on upload mechanics.
- Explaining storage, queues, or architecture unless asked.

### 3:00-5:30 - Show Extraction And Contract Intelligence

What to do:

1. Open the uploaded or already processed contract detail page.
2. Start on the Overview tab.
3. Show the decision snapshot: parties, value, start/end dates, notice, and signature status.
4. Show review findings and risks.
5. Briefly open Details or Analysis to show deeper artifacts.

Talk track:

> This is where the contract stops being a PDF and becomes a business object. We now have structured facts that can power dashboards, search, renewals, risk review, and drafting. The reviewer can quickly see what matters without reading 40 pages first.

Best proof points:

- Parties and supplier/client identity.
- Contract value and currency.
- Effective and end dates.
- Renewal or notice period.
- Risk and compliance findings.
- Extracted artifacts such as Financial, Renewal, Obligations, and Timeline.

If the viewer asks how it works:

> OCR extracts the text and layout. Then AI and deterministic checks extract metadata and generate structured artifacts. Key facts are saved back to the contract record so the UI and workflows can use them immediately.

### 5:30-7:30 - Optional Chatbot Moment

Only include this if you have time or if the audience cares about search and Q&A.

What to ask:

- "What are the payment terms?"
- "When does this contract expire?"
- "What are the main renewal risks?"

Talk track:

> The chatbot is not a generic assistant. It is grounded in the contract record, extracted text, and generated artifacts. The user can ask questions in natural language instead of manually searching across the PDF.

Keep it short. This is a supporting feature, not the main storyline.

### 7:30-9:30 - Show Renewals As The Action Layer

What to do:

1. Go to `/renewals`.
2. Show `DEMO Renewal Showcase - Cloud Support Agreement`.
3. Point out that it is high priority, pending review, 24 days until expiry, notice overdue, and CHF 1.2M value.
4. Switch briefly between List, Calendar, and Timeline if useful.

Talk track:

> This is where extracted contract data becomes operational. Expiry dates, notice periods, value, and risk are no longer buried in PDFs. They become a renewal queue. The team can see what is urgent, what money is exposed, and where action is needed.

Best proof points:

- High priority renewal.
- Overdue notice status.
- Value exposure.
- Supplier name.
- Direct action path into renewal or drafting.

Business value line:

> Missing one notice window or accepting one silent price increase can cost more than the software. Renewals are where contract intelligence becomes measurable business value.

### 9:30-11:30 - Move From Renewal To Drafting

What to do:

1. From the renewal card, choose the renewal wizard or Copilot drafting path.
2. Show that source contract context carries into the drafting flow.
3. Generate or open a renewal-related draft.
4. Show the editor, AI assistant, review panel, clauses, variables, or policy/playbook controls.

Suggested prompt if starting manually:

```text
Draft a renewal amendment for the Cloud Support Agreement with Helvetic Cloud Services AG. Keep the term at 12 months, cap any price increase at 3%, preserve Swiss/EU data residency obligations, and improve SLA credit language.
```

Talk track:

> The product does not stop at identifying the renewal. It helps create the next document. Drafting uses the same contract context, clause logic, and review controls, so users move from analysis to action without starting from a blank page.

What to emphasize:

- AI drafting is governed by user instructions, templates, clauses, and playbooks.
- The editor supports human review and changes.
- The result can become a managed contract again.

### 11:30-12:00 - Close With The Product Thesis

Talk track:

> The core idea is simple: contract data should not be trapped in PDFs. Contigo reads the contract, structures it, creates action queues like renewals, and helps teams draft the next agreement. That is the loop: understand, decide, act.

Close with one of these depending on audience:

- Legal: "Less manual first-pass review, better issue spotting, and safer drafting."
- Procurement: "Better renewal control, value visibility, and supplier negotiation preparation."
- Executive: "A faster path from contract documents to business decisions."

## 20-Minute Expanded Demo

If you have more time, add these sections:

### Search And Portfolio View

Show how uploaded contracts become searchable by supplier, value, date, type, or risk. Position this as portfolio intelligence, not document search.

### Artifact Deep Dive

Open Financial, Renewal, Obligations, Timeline, and Risk artifacts. Explain that each artifact is a structured lens over the same contract.

### Evidence And Human Review

Show that extracted facts can be reviewed. Position this as trust infrastructure: AI accelerates, humans approve.

### Drafting Faithfulness

Show that the system tries to preserve user-requested values in the draft. This is a strong differentiator versus generic AI drafting.

## What To Say By Screen

### Contracts List

> This is the portfolio. It is not just a folder view; it is a structured view of contract obligations, values, dates, and statuses.

### Upload

> We take the document as-is. The user does not need to manually create a perfect intake form before getting value.

### Contract Overview

> This is the executive review surface. It answers: who is involved, what is it worth, when does it start and end, is signature clear, and what needs attention?

### Analysis Or Artifacts

> These are the specialized review layers: financials, obligations, renewal terms, risks, compliance, parties, timeline, and more.

### Renewals

> This is where contract intelligence becomes workflow. The platform converts dates and notice clauses into prioritized actions.

### Drafting

> This is the action layer. We can create the renewal amendment or new contract directly from the context we just analyzed.

## Objection Handling

### "How is this different from a traditional CLM?"

Traditional CLM systems often start with process and repository structure. Contigo's strongest demo angle is intelligence-first: upload a contract, extract the facts, surface action, and draft from context. The value appears quickly, even before a full enterprise process rollout.

### "Can we trust the AI?"

The right answer is not "trust the AI blindly." The answer is:

> Contigo uses AI to accelerate extraction and drafting, but the product is built around review surfaces, structured fields, evidence, and human approval.

### "What happens with scanned PDFs?"

> OCR handles scanned documents and layout extraction. The extracted text becomes the basis for metadata, artifacts, search, and chatbot answers.

### "Can this work with our templates and policies?"

> Yes. Drafting is designed around templates, clauses, policy packs, playbooks, and review controls. The goal is not generic text generation; it is governed drafting.

### "What is the business ROI?"

Use renewal and value leakage:

> If a team misses a renewal notice, accepts an unnoticed price increase, or fails to catch a risky clause, the cost can be immediate and measurable. Contigo turns those buried terms into visible work.

## Demo Fallbacks

### If Upload Processing Takes Too Long

Say:

> Processing normally runs asynchronously. While that finishes, I will open a completed contract so you can see the output.

Then open an already processed contract.

### If AI Generation Is Slow

Say:

> The important part is the workflow shape: source contract context flows into a draft, and the user can review, edit, and finalize. In a live deployment, generation speed depends on model latency and document complexity.

Then show an existing draft or use a shorter prompt.

### If A Field Looks Missing

Say:

> The system flags missing or uncertain fields for review rather than pretending everything is perfect. That is important in contract work: uncertainty should become a review item.

## Demo Do's And Don'ts

Do:

- Keep the story moving from document to decision to action.
- Use the renewal example to make value concrete.
- Show enough detail to build trust, then move on.
- Keep the viewer focused on business outcomes.
- Say "review" and "evidence" often.

Do not:

- Spend five minutes on upload mechanics.
- Read every artifact aloud.
- Sell AI as magic.
- Claim full legal automation.
- Let the demo become a tab-by-tab tour.

## Best Final Message

End with this:

> Contigo helps teams move from contract documents to contract decisions. Upload gives us the data, extraction gives us the facts, renewals show where action is needed, and drafting helps create the next agreement. That is the value loop.

## Quick Reference Run Sheet

| Minute | Screen | Action | Message |
|---|---|---|---|
| 0-1 | Dashboard or Contracts | Set context | Contracts should drive decisions, not sit in folders. |
| 1-3 | Upload | Upload `realistic_contract.pdf` | Upload starts the intelligence pipeline. |
| 3-5.5 | Contract Detail | Show overview and artifacts | The PDF is now structured business data. |
| 5.5-7.5 | Chatbot, optional | Ask one contract question | Users can ask natural questions against grounded contract context. |
| 7.5-9.5 | Renewals | Show demo renewal | Extracted dates and notice terms become prioritized work. |
| 9.5-11.5 | Drafting | Start renewal draft | The next document starts from contract context. |
| 11.5-12 | Any screen | Close | Understand, decide, act. |

## Suggested Demo Script In One Paragraph

> I will show the full loop. First, we upload a contract and let Contigo extract the facts: parties, dates, value, risks, renewal terms, and obligations. Then we use those facts in the contract detail view so a reviewer can understand the agreement quickly. Next, we move to renewals, where the platform converts expiry dates and notice periods into a prioritized action queue. Finally, we use drafting to create the next agreement from that context. The key value is that the contract is no longer a static PDF. It becomes structured intelligence that drives action.
