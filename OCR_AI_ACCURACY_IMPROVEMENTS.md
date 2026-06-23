# OCR & AI Analysis Accuracy Improvements

## Current State Analysis

### OCR Pipeline
The current system uses a multi-stage OCR approach:

1. **Azure Document Intelligence** (primary)
   - Structured extraction for form-like PDFs
   - Per-word confidence scores
   - Field extraction with bounding boxes
   - Contract-specific templates

2. **GPT-4o Vision** (fallback for scanned PDFs)
   - Full PDF text extraction with markdown formatting
   - Signature page inspection (native PDF + rendered PNG)
   - Handwriting detection and transcription

3. **Regex-based parsing** (supplemental)
   - Date pattern matching (15+ patterns)
   - Currency detection (4 currencies)
   - Party extraction with role normalization
   - Financial value parsing

4. **Text preprocessing**
   - Whitespace normalization
   - Page number removal
   - Table preservation (markdown, tab-separated, pipe-separated)
   - Consecutive newline collapse
   - Character/encoding normalization

### Confidence Scoring
Current approach:
- Heuristic-based estimation (85% baseline for machine-readable PDFs)
- Penalties: non-ASCII ratio, isolated characters, short documents
- Bonuses: legal language detection
- Range: 0.1 to 1.0

**Problem**: No per-field confidence, only document-level estimates

### AI Extraction
Current approach:
- GPT-4o for artifact generation (14 types)
- Structured metadata extraction
- Party/entity extraction
- Financial validation with cross-checks
- Signature status detection

**Problem**: Single-model dependency, no ensemble voting or cross-validation

---

## 🚨 Identified Accuracy Gaps

| Gap | Severity | Impact | Example |
|-----|----------|--------|---------|
| No per-field confidence | HIGH | Can't detect which fields are unreliable | TCV extracted with 95% confidence but actually 65% |
| Single-model extraction | HIGH | No fallback if model fails or hallucinates | Wrong party extracted, no validation from alternate path |
| Financial cross-validation weak | HIGH | Cannot detect inconsistent amounts | Duplicate payments in schedule sum to 2x total value |
| Entity resolution limited | MEDIUM | Duplicate/variant party names not merged | "ACME Inc" vs "ACME Incorporated" treated as different entities |
| Date parsing brittle | MEDIUM | Fails on non-standard formats | European date format (DD.MM.YYYY) not recognized |
| Signature detection text-only | MEDIUM | Visual signatures missed | Contract marked as unsigned when actually signed and scanned |
| No validation rule engine | MEDIUM | Impossible values accepted | Negative contract values, end date before start date |
| Currency detection basic | LOW | Wrong currency applied | USD applied instead of CHF (Swiss context) |

---

## ✅ Recommended Improvements (Prioritized)

### Priority 1: Multi-Model Ensemble & Confidence Scoring

**Improvement 1.1: Per-Field Confidence Scoring**

Implement field-level confidence tracking:

```typescript
interface ExtractedField {
  value: any;
  confidence: number;        // 0-1, now standardized
  source: 'azure' | 'gpt4' | 'regex' | 'ensemble';
  alternatives?: Array<{
    value: any;
    confidence: number;
    source: string;
  }>;
  validationIssues?: string[];
}

interface EnhancedExtraction {
  title: ExtractedField;
  contractType: ExtractedField;
  totalValue: ExtractedField;
  startDate: ExtractedField;
  endDate: ExtractedField;
  clientName: ExtractedField;
  supplierName: ExtractedField;
  parties: ExtractedField[];
  // ... all fields now have confidence
}
```

Benefits:
- ✅ Know which fields to trust
- ✅ Prioritize low-confidence fields for human review
- ✅ Provide confidence hints in UI
- ✅ Support confidence-based automation (auto-apply high-confidence, hold low-confidence)

**Improvement 1.2: Ensemble Extraction (Multiple Paths)**

Run multiple extraction paths in parallel:

```
Document → Path A: Azure DI (if structured PDF)
        → Path B: GPT-4o extraction
        → Path C: Regex fallback
        → Consensus: Vote on best extraction + combine confidence
```

Implementation:
```typescript
async function extractWithEnsemble(
  fileContent: Buffer,
  isStructuredPdf: boolean
): Promise<EnhancedExtraction> {
  const results = await Promise.all([
    isStructuredPdf ? extractAzureDI(fileContent) : null,
    extractGPT4o(fileContent),
    extractRegex(rawText),
  ].filter(Boolean));

  return ensembleVote(results);
}

function ensembleVote(
  results: ExtractedField[][]
): EnhancedExtraction {
  // For each field:
  // 1. Compare all values
  // 2. Calculate consensus (2/3 match = high confidence)
  // 3. Use highest confidence where agreement
  // 4. Flag conflicts for review
  // 5. Store all alternatives
}
```

Benefits:
- ✅ Fallback if one path fails
- ✅ Cross-validate results
- ✅ Higher accuracy through voting
- ✅ Detect hallucinations (all paths disagree)

### Priority 2: Financial & Date Validation

**Improvement 2.1: Comprehensive Financial Validation**

```typescript
interface FinancialValidation {
  totalValue: number;
  validationChecks: Array<{
    check: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
  }>;
  confidence: number;
}

function validateFinancialData(
  artifact: any,
  extracted: BasicContractExtraction
): FinancialValidation {
  const checks = [
    // Check 1: Internal consistency
    checkPaymentScheduleSum(artifact),
    
    // Check 2: Extracted value alignment
    checkExtractedVsCalculated(artifact, extracted),
    
    // Check 3: Reasonable ranges
    checkValueReasonableness(artifact),
    
    // Check 4: No duplicate counting
    checkNoDuplicatePayments(artifact),
    
    // Check 5: Currency consistency
    checkCurrencyConsistency(artifact),
  ];
  
  return {
    totalValue: calculateBestValue(...),
    validationChecks: checks,
    confidence: calculateConfidence(checks),
  };
}
```

**Improvement 2.2: Enhanced Date Parsing**

```typescript
const ENHANCED_DATE_PATTERNS = {
  // European formats
  EUROPEAN_FULL: /(\d{1,2})[\.\s](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\.\s](\d{4})/i,
  EUROPEAN_SHORT: /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY (Swiss/DE)
  
  // ISO formats
  ISO_DATE: /(\d{4})-(\d{2})-(\d{2})/,
  
  // Contextual patterns
  FISCAL_YEAR: /fiscal\s+year\s+(\d{4})/i,
  CALENDAR_YEAR: /calendar\s+year\s+(\d{4})/i,
  
  // Relative dates
  DAYS_FROM_NOW: /(\d+)\s+days?\s+from\s+(?:now|today|signature|execution)/i,
  MONTHS_FROM_SIGNATURE: /(\d+)\s+months?\s+from\s+(?:signature|execution|effective date)/i,
};

function parseSmartDate(
  dateText: string,
  context: { effectiveDate?: Date; signatureDate?: Date }
): { value: Date | null; confidence: number; pattern: string } {
  // Try all patterns in priority order
  // Use context to calculate relative dates
  // Return confidence based on pattern match quality
}
```

### Priority 3: Entity Resolution & Deduplication

**Improvement 3.1: Smart Party Deduplication**

```typescript
interface PartyResolution {
  canonical: string;
  variants: string[];
  confidence: number;
  metadata: {
    jurisdiction?: string;
    entityType?: string;
    registrationNumber?: string;
  };
}

function deduplicatePartiesEnhanced(
  parties: ExtractedParty[]
): PartyResolution[] {
  const clusters = new Map<string, PartyResolution>();

  for (const party of parties) {
    // 1. Exact match
    const exactKey = party.name.toLowerCase();
    if (clusters.has(exactKey)) {
      clusters.get(exactKey)!.variants.push(party.name);
      continue;
    }

    // 2. Fuzzy match (Levenshtein distance)
    const similarKey = findSimilarParty(party.name, clusters, 0.85);
    if (similarKey) {
      clusters.get(similarKey)!.variants.push(party.name);
      continue;
    }

    // 3. Legal name normalization
    // "ACME Inc" vs "ACME Incorporated" vs "ACME Inc."
    const normalizedKey = normalizeLegalName(party.name);
    const existingNormalized = Array.from(clusters.keys())
      .find(k => normalizeLegalName(k) === normalizedKey);
    if (existingNormalized) {
      clusters.get(existingNormalized)!.variants.push(party.name);
      continue;
    }

    // 4. New canonical
    clusters.set(exactKey, {
      canonical: party.name,
      variants: [],
      confidence: 0.95,
      metadata: extractPartyMetadata(party.name),
    });
  }

  return Array.from(clusters.values());
}

function normalizeLegalName(name: string): string {
  // Remove legal suffixes and normalize
  return name
    .replace(/\b(inc|incorporated|ltd|limited|llc|corp|corporation|co|ag|gmbh|sarl|sas|bv|nv)\b/gi, '')
    .replace(/[,.\s]+/g, ' ')
    .trim()
    .toLowerCase();
}
```

### Priority 4: Signature Detection Enhancement

**Improvement 4.1: Multi-Modal Signature Detection**

```typescript
interface SignatureDetectionResult {
  status: 'signed' | 'partially_signed' | 'unsigned' | 'unknown';
  confidence: number;
  evidence: {
    textualSignatures: { count: number; confidence: number };
    visualSignatures: { count: number; confidence: number };
    executionLanguage: { found: boolean; confidence: number };
  };
  signers: Array<{
    name: string;
    title?: string;
    dateOfSignature?: string;
    source: 'textual' | 'visual';
  }>;
}

async function detectSignatureMultiModal(
  fileContent: Buffer,
  extractedText: string,
  pageCount: number
): Promise<SignatureDetectionResult> {
  const [textualEvidence, visualEvidence] = await Promise.all([
    // Path 1: Text-based detection
    assessSignatureEvidenceEnhanced(extractedText),
    
    // Path 2: Visual inspection
    assessPDFSignatureVisually(fileContent, pageCount, extractedText),
  ]);

  // Combine evidence with weighted scoring
  const confidence = combineSignatureConfidence([
    { evidence: textualEvidence, weight: 0.4 },
    { evidence: visualEvidence, weight: 0.6 },  // Visual more reliable
  ]);

  return {
    status: determineSignatureStatus(textualEvidence, visualEvidence),
    confidence,
    evidence: {
      textualSignatures: textualEvidence,
      visualSignatures: visualEvidence,
      executionLanguage: { found: true, confidence: 0.9 },  // "IN WITNESS WHEREOF"
    },
    signers: mergeSigners(textualEvidence.signers, visualEvidence.signers),
  };
}
```

### Priority 5: Validation Rule Engine

**Improvement 5.1: Pluggable Validation Rules**

```typescript
interface ValidationRule {
  name: string;
  apply(extraction: EnhancedExtraction): ValidationResult;
  severity: 'error' | 'warning' | 'info';
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'date-logic',
    apply: (extraction) => {
      const start = extraction.startDate.value;
      const end = extraction.endDate.value;
      if (start && end && start > end) {
        return {
          valid: false,
          severity: 'error',
          message: 'End date before start date',
        };
      }
      return { valid: true };
    },
  },
  {
    name: 'financial-reasonableness',
    apply: (extraction) => {
      const value = extraction.totalValue.value;
      // Validate: not negative, not impossibly large, reasonable for industry
      if (value < 0) return { valid: false, message: 'Negative contract value' };
      if (value > 1e12) return { valid: false, message: 'Unreasonably large value' };
      return { valid: true };
    },
  },
  {
    name: 'party-populated',
    apply: (extraction) => {
      if (!extraction.clientName.value || !extraction.supplierName.value) {
        return { valid: false, message: 'Missing party information' };
      }
      return { valid: true };
    },
  },
];

function validateExtraction(extraction: EnhancedExtraction) {
  const results = VALIDATION_RULES.map(rule => ({
    ...rule.apply(extraction),
    rule: rule.name,
  }));

  return {
    valid: results.every(r => r.valid),
    issues: results.filter(r => !r.valid),
    warnings: results.filter(r => r.severity === 'warning'),
  };
}
```

### Priority 6: Model Feedback Loop

**Improvement 6.1: Learning from Corrections**

```typescript
interface ExtractionFeedback {
  contractId: string;
  field: string;
  modelExtraction: any;
  userCorrection: any;
  confidence: number;
  wasCorrect: boolean;  // True if model got it right
  source: 'azure' | 'gpt4' | 'regex' | 'ensemble';
  timestamp: Date;
}

async function recordExtractionFeedback(feedback: ExtractionFeedback) {
  // 1. Save to DB (ExtractionCorrection table already exists)
  await prisma.extractionCorrection.create({
    data: {
      tenantId: feedback.contractId.split('_')[0],
      contractId: feedback.contractId,
      fieldName: feedback.field,
      originalValue: JSON.stringify(feedback.modelExtraction),
      correctedValue: JSON.stringify(feedback.userCorrection),
      confidence: feedback.confidence,
      wasCorrect: feedback.wasCorrect,
      source: feedback.source,
      feedbackType: 'correction',
      modelUsed: 'gpt-4o-2024-11-20',
      promptVersion: 'v2',
    },
  });

  // 2. Analyze patterns
  const patterns = await identifyPatternsInCorrections([feedback]);
  
  // 3. Trigger model fine-tuning if threshold reached
  if (patterns.errorRate > 0.15) {
    await queueModelFineTuning({
      field: feedback.field,
      errorRate: patterns.errorRate,
      samples: patterns.failureExamples,
    });
  }
}
```

---

## Implementation Roadmap

| Priority | Feature | Effort | Benefit | Timeline |
|----------|---------|--------|---------|----------|
| **1** | Per-field confidence tracking | 2w | High - enable confidence-based UI/automation | Immediate |
| **1** | Ensemble extraction voting | 2w | High - improve accuracy by 15-20% | Week 2-3 |
| **2** | Financial validation rules | 1w | High - catch inconsistencies | Week 1 |
| **2** | Enhanced date parsing | 1w | Medium - 10% accuracy improvement | Week 2 |
| **3** | Party deduplication (fuzzy) | 1.5w | Medium - cleaner party data | Week 3 |
| **4** | Multi-modal signature detection | 1w | Medium - better signature coverage | Week 4 |
| **5** | Validation rule engine | 1.5w | Medium - flexible validation | Week 4-5 |
| **6** | Model feedback loop | 1w | Low - foundation for future ML improvements | Week 5 |

---

## Success Metrics

- ✅ **Extraction Accuracy**: 95%+ for high-confidence fields (≥0.85)
- ✅ **Per-Field Coverage**: 80%+ fields have per-field confidence
- ✅ **Ensemble Agreement**: 85%+ consensus between 2+ extraction paths
- ✅ **Financial Validation**: 100% of contracts pass basic validation rules
- ✅ **Party Deduplication**: 95%+ of duplicate parties correctly merged
- ✅ **Signature Detection**: 90%+ accuracy on signed vs unsigned
- ✅ **User Correction Rate**: < 5% fields require correction after extraction
