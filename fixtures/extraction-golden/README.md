# Extraction golden set

Labeled cases live in `packages/utils/test/extraction-golden-cases.ts`.

Each case covers a document class the 2026-09-14 review asked to measure:

- short and long
- native / scanned / mixed OCR
- German, French, Italian, English
- MSA, SOW, amendment, rate schedule
- traps: signing date ≠ effective date, party order ≠ roles, term length ≠ notice, day-rate ≠ TCV

The harness (`packages/utils/test/extraction-golden.test.ts`) maps OVERVIEW-like extraction through `mapOverviewToPersistedColumns` (the same persist rules the OCR worker uses) and scores:

| Status | Meaning |
| --- | --- |
| correct | persisted value matches the label |
| missing | label has a value, persist wrote nothing |
| incorrect | persist wrote a different value |
| spurious | label is empty/null, persist invented a value |

CI fails on incorrect, missing, or spurious.

Optional PDFs for the older TCV harness still go in `fixtures/tcv/` with sibling `.expected.json`.
