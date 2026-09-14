Contract extraction review — 2026-09-14

The current pipeline has confirmed correctness defects. The inconsistent results can arise before, during, and after AI generation. A stronger model alone would leave several of these defects intact.

Scope: source review at commit b3a66f4, GitNexus caller inspection, 118 existing focused tests, and isolated execution of existing parser/scoring functions with synthetic inputs. No production contracts, live DI/AI responses, deployed configuration, or production accuracy measurements were examined. Application code was not changed.

The upload path runs OCR/DI, generates artifacts, validates them, maps artifacts to contract columns and enterprise metadata, invokes validation/gap-filling agents, and queues a separate schema-based metadata extractor when enabled. The latter can overwrite core contract columns again. Regeneration also has a separate grouped-artifact path. These paths do not use identical context selection or validation.

1. **High: DI structured fields are discarded by the REST response parser.**

   `packages/workers/src/azure-document-intelligence.ts:702` handles `value`, `valueString`, `valueDate`, and `valueNumber`, but omits `valueArray`, `valueObject`, and several other REST value types. Executing the existing `parseDocuments` function with a standard nested party fixture produced `{type: "array", value: null, confidence: 0.9}`. `analyzeContract` subsequently cannot recover the structured parties. It also reads singular `Jurisdiction`/`GoverningLaw` instead of the documented `Jurisdictions` array. GitNexus confirms this parser is shared by contract, invoice, and query analysis.

   The existing DI contract test at `packages/workers/src/__tests__/azure-document-intelligence.test.ts:349` supplies nested `value` properties instead of the REST representation, so it passes despite the defect. Fix with recursive typed REST decoding and fixtures that match the service schema. Microsoft references: [REST document field schema](https://learn.microsoft.com/en-us/rest/api/aiservices/document-models/get-analyze-result?view=rest-aiservices-v4.0+(2024-11-30)#documentfield), [contract field schema](https://github.com/Azure-Samples/document-intelligence-code-samples/blob/main/schema/2024-11-30-ga/contract.md).

2. **High: schema metadata extraction cannot see most of a long contract.**

   `apps/web/lib/ai/metadata-extractor.ts:236` takes the first 12,000 characters; the second pass at line 297 takes the first 15,000. Neither retrieves the missing section or uses the artifact pipeline's existing section-aware selection. Schedules, later clauses, and signatures can remain invisible on both passes. Both the upload worker and manual extraction API use this class. Replace prefix truncation with field-relevant evidence selection and expose omitted coverage.

3. **High: currency parsing corrupts Swiss and European values.**

   Executing the existing `parseValue` method at `apps/web/lib/ai/metadata-extractor.ts:655` reproduced `CHF 1’500.00 → 1`, `EUR 1.500,00 → 1.5`, and `EUR 1500,50 → 150050`. This occurs when the AI returns formatted strings; numeric JSON values do not trigger these examples. The worker can write these results to `totalValue` unless the human TCV lock is present. Use the shared locale-aware amount handling, retain source text, and reject ambiguous formats.

4. **High: automatic application ignores the extractor's validation/review decision.**

   `packages/workers/src/metadata-extraction-worker.ts:233` applies any non-null value above its confidence threshold without requiring `validationStatus === 'valid'` or checking `requiresHumanReview`. The extractor can flag an invalid value or failed custom rule while retaining high confidence. The schema path also records source text without verifying that the quoted evidence exists in the contract. Require valid, grounded evidence before automatic application and preserve corrections across every core field, not only TCV.

5. **High: post-processing substitutes semantic guesses for missing facts.**

   `packages/workers/src/ocr-artifact-worker.ts:3471` uses the latest signing date as an effective date. Line 3527 selects the first numeric day/month duration in `termAndTermination` as notice days, without checking that the duration describes notice. Lines 3770 onward also intermingle execution and effective dates; lines 3953 onward can assign party roles by ordering when roles are unknown. These transformations can introduce errors even if the model correctly leaves a field unknown. Preserve distinct field meanings and represent any derivation with its rule and source evidence.

6. **High for large documents: DI can lose the actual document tail.**

   `packages/workers/src/ocr-artifact-worker.ts:1334` defaults to a 50-page layout cap when a file-size heuristic estimates more pages. The initial metadata pass targets the actual document's first/last pages. At line 1494, however, the returned layout page count is used to recompute the metadata window; after a 50-page capped layout this can replace the actual document tail with pages 49–50. A long document's final signatures/schedules can therefore be omitted from layout and from the replacement metadata pass. Track total pages separately from analyzed pages and make partial coverage explicit. This finding is based on control-flow inspection, not a live long-document run.

7. **Medium: failed metadata calls can appear completed and become sticky.**

   `apps/web/lib/ai/metadata-extractor.ts:266` catches API/parsing failures and returns empty fields. The worker persists the extraction marker and returns `success: true` at line 385 even when all fields fail. Its skip condition at line 153 checks prior extraction/text hash, not successful quality or current schema version. A transient failure can therefore require forced re-extraction even after the service recovers. Distinguish service failure from genuinely absent fields, propagate retryable errors, and include schema/pipeline versions in cache validity.

8. **Medium: automatic and manual metadata extraction omit tenant learning context.**

   Both `packages/workers/src/metadata-extraction-worker.ts:186` and `apps/web/app/api/contracts/[id]/extract-metadata/route.ts:85` omit `tenantId`, `contractType`, and `ourOrganization` from extractor options. The extractor defaults to tenant `demo`, so adaptive lookup does not use the actual tenant's corrections. The organization-aware party prompt is also left without its organization context. Pass trusted tenant/type/organization context from the server.

9. **Medium: analysis confidence is not an accuracy measurement.**

   `apps/web/lib/ai/custom-analysis.ts:679` starts at 70%, increases for citation-shaped strings and response length, and does not use its `originalText` argument. Executing it with unrelated source text and repeated invented "Section 999" statements returned 95%. The enterprise metadata path also assigns fixed confidence values based on field presence (`ocr-artifact-worker.ts:3874`). These scores should not be presented or consumed as verified factual accuracy. Ground evidence first; distinguish extraction completeness, OCR confidence, and field trust.

10. **Conditional service limitation: prebuilt-contract language support.**

    Microsoft's [contract model documentation](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/contract?view=doc-intel-4.0.0) lists English support. The layout path launches a prebuilt-contract metadata pass without a document-language gate. This does not mean multilingual layout OCR is unsupported; it means German/French/Italian contracts should not depend on that specialized English contract model. Actual impact depends on the documents and runtime configuration.

Validation completed:

- Workers: DI adapter, metadata worker, candidate location — 33 tests passed.
- Workers: text selection and artifact prompts — 37 tests passed.
- Shared utilities: extraction validation, contract extraction, critical fields and CI gate — 48 tests passed.
- Isolated execution of existing TypeScript functions confirmed the DI-array, formatted-currency, and confidence-score failures above. These checks used synthetic data and made no model calls.
- The GitNexus index was 54 commits behind and was refreshed. Its graph has bounded/truncated flow coverage; caller results were cross-checked against source. Generated instruction-file changes were removed.

Repair order: correct DI decoding and currency normalization; enforce validation/evidence before writes; repair long-document coverage and metadata context; remove unsupported semantic substitutions; then fix retry/cache behavior and confidence reporting. Validate the repaired path against a labeled set of representative short/long, scanned/native, multilingual contracts, including amendments and rate schedules. Compare expected values against both artifacts and final persisted columns, and measure missing values separately from incorrect values.
