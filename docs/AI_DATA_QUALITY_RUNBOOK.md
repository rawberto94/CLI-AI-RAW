# AI Data Quality Runbook

Use these checks before demos, after extraction changes, and before production releases. They are designed to catch cases where an AI-generated field is plausible-looking but not supported by the strongest evidence in the contract text.

## Total Contract Value Audit

The TCV audit compares stored contract values and FINANCIAL artifacts against deterministic aggregate-value evidence from `rawText`.

Dry run the focused demo set:

```bash
pnpm audit:tcv
```

Dry run all contracts:

```bash
pnpm audit:tcv -- --all
```

Repair mismatches after reviewing the JSON output:

```bash
pnpm audit:tcv -- --all --apply
```

Target a single contract:

```bash
pnpm audit:tcv -- --contract=<contractId>
```

The audit flags records where `Contract.totalValue` or `FINANCIAL.totalValue` is materially below a stronger aggregate amount in the text, such as a transaction fee, total contract value, aggregate consideration, or not-to-exceed amount.

It deliberately does not treat these as TCV by themselves:

- reimbursable expense caps
- liability caps
- insurance amounts
- individual milestones or installments
- unit prices or rate card rows
- penalties, taxes, or examples

## Demo Safety Rule

Before showing a freshly uploaded contract, run a focused audit on it:

```bash
pnpm audit:tcv -- --contract=<contractId>
```

If the audit reports `needs_repair`, inspect the `bestEvidence` quote, then rerun with `--apply` when the quote is clearly the aggregate value.

## Critical Fields Audit

The critical-fields audit applies the same evidence-first pattern to the fields most likely to hurt trust in a demo or review workflow:

- total contract value and currency
- end date / expiration date
- renewal term and auto-renewal signal
- notice period
- signature status
- client and supplier names

Dry run the focused demo set:

```bash
pnpm audit:critical-fields
```

Dry run all contracts:

```bash
pnpm audit:critical-fields -- --all
```

Target a single contract:

```bash
pnpm audit:critical-fields -- --contract=<contractId>
```

Repair deterministic mismatches after reviewing the JSON output:

```bash
pnpm audit:critical-fields -- --contract=<contractId> --apply
```

The command auto-repairs conservative cases such as materially smaller TCVs, fixed-term derived expiration dates, notice period mismatches, missing party names, and signature statuses contradicted by signature evidence. It leaves ambiguous party conflicts and auto-renewal contradictions in `needs_review` instead of forcing an unsafe correction.

## Field Lookup Coverage

Azure Document Intelligence query enrichment now asks bounded lookup questions for the main fields the product surfaces: title, type, effective/end dates, initial and renewal term, notice period, TCV, payment terms, governing law, parties, client, supplier, signature status/date, auto-renewal, termination rights, liability cap, and key obligations.

Those answers are normalized into `diFieldEvidence` and `diFieldMetadata`, then reconciled with deterministic parsers before being mirrored into contract scalars and artifacts. AI generation can still write rich narrative artifacts, but these critical fields have a separate evidence trail and audit path.
