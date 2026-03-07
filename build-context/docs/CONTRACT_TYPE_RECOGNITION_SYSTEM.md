# Contract Type Recognition & Categorization System

## Overview

The Contigo platform uses a multi-layer contract type recognition and categorization system that
automatically:

1. **Detects** the contract type (NDA, MSA, SOW, etc.)
2. **Categorizes** the contract into a taxonomy hierarchy
3. **Stores** all metadata for querying and analytics

## Detection Methods

### 1. AI-Based Detection (Primary)

**Location**:
[packages/workers/src/contract-type-profiles.ts#L3418](packages/workers/src/contract-type-profiles.ts#L3418)

```typescript
export async function detectContractTypeWithAI(text: string): Promise<{
  type: ContractType;
  confidence: number;
  reasoning: string;
  matchedKeywords: string[];
}>;
```

**How it works**:

- Uses OpenAI GPT-4o-mini with structured JSON output
- Analyzes document title, headers, and content
- Considers 69 distinct contract types grouped by category
- Combines AI reasoning with keyword validation
- Returns confidence score (0-1) and reasoning

**Categories Analyzed**:

- Employment & HR (6 types)
- Transactional Documents (8 types)
- Service & Work Agreements (9 types)
- Intellectual Property (5 types)
- Sales & Supply (7 types)
- Financial (4 types)
- Real Estate & Construction (3 types)
- Corporate & Governance (9 types)
- Compliance & Legal (7 types)
- Project & Procurement (4 types)
- Contract Modifications (4 types)
- Preliminary Agreements (2 types)

### 2. Keyword-Based Detection (Fallback)

**Location**:
[packages/workers/src/contract-type-profiles.ts#L3556](packages/workers/src/contract-type-profiles.ts#L3556)

```typescript
export function detectContractTypeKeywords(text: string): {
  type: ContractType;
  confidence: number;
  matchedKeywords: string[];
};
```

**Features**:

- Title/header matches weighted 3x higher
- Strong indicators (exact phrases) get 90% confidence
- Considers keyword specificity and frequency
- Handles ambiguous documents gracefully

**Strong Indicators** (immediate 90% confidence):

- "purchase order" → PURCHASE_ORDER
- "data processing agreement" → DATA_PROCESSING_AGREEMENT
- "master services agreement" → MSA
- "non-disclosure agreement" → NDA
- "statement of work" → SOW
- And 25+ more precise mappings

## Contract Type Profiles

Each of the 69 contract types has a complete profile:

**Location**:
[packages/workers/src/contract-type-profiles.ts#L141](packages/workers/src/contract-type-profiles.ts#L141)

```typescript
export interface ContractTypeProfile {
  displayName: string; // "Non-Disclosure Agreement"
  description: string; // What it covers
  artifactRelevance: Record<ArtifactType, ArtifactRelevance>;
  clauseCategories: string[]; // Relevant clause types
  financialFields: string[]; // Which financial fields matter
  riskCategories: string[]; // Applicable risks
  keyTermsToExtract: string[]; // Important definitions
  extractionHints: string; // AI prompting guidance
  mandatoryFields: string[]; // Required fields
  expectedSections: string[]; // Document structure
}
```

## Categorization Pipeline

### Worker Flow

1. **OCR/Upload** → Contract text extracted
2. **Type Detection**
   ([ocr-artifact-worker.ts#L1416](packages/workers/src/ocr-artifact-worker.ts#L1416)):

   ```typescript
   const contractTypeDetection = await detectContractTypeWithAI(extractedText);
   const detectedContractType = contractTypeDetection.type;
   ```

3. **Profile Loading**:

   ```typescript
   const profile = getContractProfile(detectedContractType);
   ```

4. **Artifact Generation** (based on profile):
   - Only generates relevant artifacts per contract type
   - Marks non-applicable artifacts as such

5. **Categorization Worker**
   ([categorization-worker.ts#L549](packages/workers/src/categorization-worker.ts#L549)):
   - Runs taxonomy-based classification
   - Maps to L1/L2 categories
   - Stores full categorization metadata

## Metadata Storage

### Contract Table Fields

```sql
-- Core type field
contractType        String?  -- "MSA", "NDA", "SOW", etc.

-- Taxonomy reference
contractCategoryId  String?  -- FK to contract_categories table
categoryL1          String?  -- Level 1 category name
categoryL2          String?  -- Level 2 category name

-- Classification metadata
keywords            String[] -- Matched keywords
classifiedAt        DateTime -- When classified

-- JSON fields for detailed data
aiMetadata          Json     -- Type detection details
metadata            Json     -- Full categorization
```

### aiMetadata Structure

```json
{
  "typeDetection": {
    "detectedType": "MSA",
    "confidence": 0.92,
    "matchedKeywords": ["master services agreement", "framework agreement"],
    "aiSuggestedType": "MSA",
    "needsHumanReview": false,
    "detectedAt": "2025-01-15T10:30:00Z"
  }
}
```

### metadata.\_categorization Structure

```json
{
  "_categorization": {
    "contractType": { "value": "MSA", "confidence": 92 },
    "industry": { "value": "TECHNOLOGY", "confidence": 85 },
    "riskLevel": { "value": "MEDIUM", "confidence": 88 },
    "complexity": 65,
    "taxonomy": {
      "categoryL1": {
        "id": "professional-services",
        "name": "Professional Services",
        "matchScore": 85
      },
      "categoryL2": {
        "id": "it-consulting",
        "name": "IT Consulting",
        "matchScore": 72
      },
      "alternatives": [...]
    },
    "categorizedAt": "2025-01-15T10:31:00Z"
  }
}
```

## Confidence Thresholds & Human Review

**Location**: [ocr-artifact-worker.ts#L1575](packages/workers/src/ocr-artifact-worker.ts#L1575)

| Confidence | Action                                            |
| ---------- | ------------------------------------------------- |
| ≥ 75%      | Auto-apply type and category                      |
| 60-74%     | Apply but flag for potential review               |
| < 60%      | Queue for human review (`needsHumanReview: true`) |

```typescript
const needsReview = contractTypeDetection.confidence < 0.6;
if (needsReview) {
  artifact.data._extractionMeta.needsHumanReview = true;
  artifact.data._extractionMeta.reviewReason = `Low confidence (${Math.round(confidence * 100)}%) in contract type detection`;
}
```

## Test Results

**Keyword Detection Accuracy: 100%** (8/8 contract types)

| Contract Type             | Detected                  | Confidence | Correct |
| ------------------------- | ------------------------- | ---------- | ------- |
| NDA                       | NDA                       | 90%        | ✅      |
| SOW                       | SOW                       | 90%        | ✅      |
| MSA                       | MSA                       | 90%        | ✅      |
| EMPLOYMENT                | EMPLOYMENT                | 90%        | ✅      |
| PURCHASE_ORDER            | PURCHASE_ORDER            | 90%        | ✅      |
| INVOICE                   | INVOICE                   | 90%        | ✅      |
| DATA_PROCESSING_AGREEMENT | DATA_PROCESSING_AGREEMENT | 90%        | ✅      |
| LICENSE                   | LICENSE                   | 90%        | ✅      |

## Key Files

1. **Contract Type Profiles & Detection**:
   [packages/workers/src/contract-type-profiles.ts](packages/workers/src/contract-type-profiles.ts)

2. **OCR & Artifact Worker (uses detection)**:
   [packages/workers/src/ocr-artifact-worker.ts](packages/workers/src/ocr-artifact-worker.ts)

3. **Categorization Worker**:
   [packages/workers/src/categorization-worker.ts](packages/workers/src/categorization-worker.ts)

4. **Taxonomy Classifier**:
   [apps/web/lib/ai/contract-classifier-taxonomy.ts](apps/web/lib/ai/contract-classifier-taxonomy.ts)

5. **Contract Categorizer**:
   [apps/web/lib/ai/contract-categorizer.ts](apps/web/lib/ai/contract-categorizer.ts)

6. **Database Schema**: [packages/clients/db/schema.prisma](packages/clients/db/schema.prisma)

## Testing the System

Run the test script:

```bash
npx tsx scripts/test-contract-type-detection.ts
```

This tests:

- Keyword-based detection accuracy
- AI-based detection (if API key set)
- Full categorization flow
- Metadata schema verification
- Confidence threshold logic

## Future Improvements

1. **Add domain-specific dictionaries** for specialized contract types
2. **Implement A/B testing** to compare AI vs keyword detection
3. **Train custom models** on organization-specific contract patterns
4. **Add multi-language support** for international contracts
5. **Implement feedback loop** from human reviews to improve accuracy
