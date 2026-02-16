# Advanced Extraction Intelligence - Implementation Summary

## Overview

This document describes the advanced extraction intelligence features implemented to improve AI contract extraction accuracy, reliability, and flexibility.

## New Services Created

### 1. Advanced Extraction Intelligence Service

**File:** `packages/data-orchestration/src/services/advanced-extraction-intelligence.service.ts`

Provides sophisticated contract analysis capabilities:

#### Contract Type Profiles

- **30+ contract types** with specialized extraction rules
- Types include: NDA, MSA, SOW, EMPLOYMENT, SAAS, LEASE
- Each profile contains:
  - Critical and optional fields
  - Financial and date fields
  - Party fields
  - Risk categories
  - Typical value ranges
  - Expected sections
  - Validation rules

#### Industry Benchmarking

- Compare extracted values against industry standards
- Supported benchmarks:
  - Payment terms (days)
  - Liability caps
  - Termination notice periods
  - SLA uptime percentages
  - Confidentiality terms
  - Probation periods
  - Non-compete durations

#### Entity Resolution

- Normalize and match party names
- Known entity aliases database
- Fuzzy matching for unknown entities
- Suggest canonical names

#### Missing Field Prediction

- Predict fields that should be present but weren't extracted
- Based on contract type profile
- Suggest where to look in the document

#### Improvement Suggestions

- Identify low-confidence extractions
- Suggest date normalization
- Parse currency values
- Compare against benchmarks

---

### 2. Smart Fallback Chain Service

**File:** `packages/data-orchestration/src/services/smart-fallback-chain.service.ts`

Implements a multi-level fallback chain for reliable extraction:

#### Extraction Levels (in order)

1. **Pattern-based extraction** - Fastest, most reliable (regex patterns)
2. **AI direct extraction** - GPT-based field extraction
3. **Semantic inference** - Find values near semantic hints
4. **Related field inference** - Use values from related fields
5. **Historical lookup** - Use most common values from past contracts
6. **Default value** - Fall back to sensible defaults

#### Features

- Field extraction specifications with:
  - Multiple regex patterns
  - Semantic hints
  - Related fields
  - Value type normalization
- Comprehensive normalizers:
  - Date normalization (various formats → ISO)
  - Currency parsing ($1,234.56 → {amount: 1234.56, currency: "USD"})
  - Duration parsing
  - Percentage parsing
  - Boolean detection

#### Learning from History

- Records extracted values by contract type
- Learns most common values for fields
- Uses historical data when other methods fail

---

### 3. Extraction Learning Service

**File:** `packages/data-orchestration/src/services/extraction-learning.service.ts`

Enables continuous improvement through feedback:

#### Feedback Recording

- Record user confirmations (extraction was correct)
- Record user corrections (extraction was wrong)
- Track extraction source, confidence, and contract type

#### Performance Analytics

- **Field Performance Stats:**
  - Total extractions
  - Accuracy rate
  - Average confidence
  - Confidence calibration score
  - Common error patterns
  - Performance by source and contract type
  - Trend (improving/stable/declining)

#### Confidence Calibration

- Adjust confidence based on historical accuracy
- Account for source performance
- Account for contract type performance
- Learn from user corrections

#### Insights Generation

- Identify low-accuracy fields
- Detect declining trends
- Find common error patterns
- Suggest improvements

#### Export/Import

- Export learning data for backup
- Import learning data for restoration

---

## API Enhancements

### Intelligent Analysis API

**File:** `apps/web/app/api/contracts/intelligent-analysis/route.ts`

Enhanced with:

#### New Request Options

```typescript
interface AnalysisRequest {
  documentText: string;
  contractId?: string;
  contractType?: string; // Hint for contract type
  industry?: string; // Industry context
  options?: {
    skipRiskAnalysis?: boolean;
    skipNegotiationAnalysis?: boolean;
    skipComplianceCheck?: boolean;
    maxFieldsToDiscover?: number;
    targetConfidence?: number;
    enableBenchmarking?: boolean; // Compare to industry benchmarks
    enableLearning?: boolean; // Track for learning
  };
}
```

#### New Response Fields

- **contractTypeProfile** - Contract type info and critical fields
- **industryBenchmarks** - Comparison to market standards
  - `comparisons` - Field-by-field comparison
  - `fieldsCompared` - Count
  - `outliers`, `aboveMarket`, `belowMarket` - Counts
- **missingFields** - Predicted missing information
  - `predictions` - Likely missing fields
  - `criticalMissing`, `likelyMissing` - Counts
- **improvementSuggestions** - Ways to improve extraction
- Calibrated confidence scores with adjustment notes

### Extraction Feedback API (NEW)

**File:** `apps/web/app/api/contracts/extraction-feedback/route.ts`

#### POST - Record Feedback

Single feedback:

```json
{
  "contractId": "...",
  "fieldName": "effective_date",
  "extractedValue": "2024-01-01",
  "correctedValue": "2024-01-15",
  "wasCorrect": false,
  "extractionSource": "ai_direct",
  "extractionConfidence": 0.85,
  "contractType": "MSA"
}
```

Batch feedback:

```json
{
  "contractId": "...",
  "contractType": "MSA",
  "feedback": [
    { "fieldName": "...", "extractedValue": "...", "wasCorrect": true, ... }
  ]
}
```

#### GET - Retrieve Learning Stats

- `?action=stats` - Overall extraction statistics
- `?action=field&field=effective_date` - Stats for specific field
- `?action=insights` - Learning insights and suggestions
- `?action=all-fields` - Performance of all tracked fields

---

## UI Enhancements

### ComprehensiveAIAnalysis Component

**File:** `apps/web/components/artifacts/ComprehensiveAIAnalysis.tsx`

#### New Sections Added

1. **Industry Benchmark Comparison**
   - Visual comparison of extracted values vs market standards
   - Color-coded positions (above/below/at market/outlier)
   - Recommendations for negotiation
   - Trend indicators

2. **Missing Fields Predictions**
   - List of likely missing information
   - Probability indicators
   - Suggested locations in document
   - Priority highlighting for critical fields

3. **Enhanced Field Cards**
   - Calibration notes for adjusted confidence
   - Original vs calibrated confidence
   - Better visual indicators

---

## How It Works Together

### Extraction Flow

```
1. Document received
   ↓
2. Contract type detected (AI + patterns)
   ↓
3. Load type-specific profile
   ↓
4. AI extraction with type-specific prompts
   ↓
5. Pattern-based verification
   ↓
6. Smart fallback for missing fields
   ↓
7. Cross-validation between fields
   ↓
8. Industry benchmark comparison
   ↓
9. Confidence calibration
   ↓
10. Missing field prediction
   ↓
11. Improvement suggestions
```

### Learning Flow

```
1. Extraction completed
   ↓
2. User reviews results
   ↓
3. User confirms/corrects fields
   ↓
4. Feedback API records outcomes
   ↓
5. Learning service updates stats
   ↓
6. Future extractions use calibrated confidence
   ↓
7. Error patterns inform improvements
```

---

## Usage Examples

### Analyze a Contract

```typescript
const response = await fetch('/api/contracts/intelligent-analysis', {
  method: 'POST',
  body: JSON.stringify({
    documentText: contractText,
    contractId: 'contract-123',
    contractType: 'MSA', // Optional hint
    industry: 'technology',
    options: {
      enableBenchmarking: true,
      enableLearning: true
    }
  })
});

const result = await response.json();
// result.industryBenchmarks.comparisons - benchmark comparisons
// result.missingFields.predictions - likely missing fields
// result.improvementSuggestions.suggestions - improvement ideas
```

### Record Feedback

```typescript
await fetch('/api/contracts/extraction-feedback', {
  method: 'POST',
  body: JSON.stringify({
    contractId: 'contract-123',
    fieldName: 'effective_date',
    extractedValue: '2024-01-01',
    correctedValue: '2024-01-15',
    wasCorrect: false,
    extractionSource: 'ai_direct',
    extractionConfidence: 0.85,
    contractType: 'MSA'
  })
});
```

### Get Learning Insights

```typescript
const response = await fetch('/api/contracts/extraction-feedback?action=insights');
const { insights } = await response.json();
// insights - array of learning insights and suggestions
```

---

## Benefits

1. **Higher Accuracy** - Multi-pass extraction with pattern verification
2. **Type-Aware** - Uses specialized profiles for each contract type
3. **Self-Improving** - Learns from user corrections over time
4. **Transparent** - Explains confidence and suggests improvements
5. **Industry Context** - Compares to market benchmarks
6. **Missing Detection** - Predicts fields that should exist
7. **Reliable Fallbacks** - Multiple extraction methods ensure coverage

---

## Future Improvements

1. **Persistent Learning** - Save learning data to database
2. **Model Fine-Tuning** - Use correction data to fine-tune extraction
3. **Batch Learning** - Learn from bulk import corrections
4. **Custom Benchmarks** - Allow organization-specific benchmarks
5. **Template Recognition** - Detect and optimize for common templates
