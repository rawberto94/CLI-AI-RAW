# Confidence Thresholds Standardization Guide

## Overview

This guide standardizes how confidence scores are displayed across the Contigo platform. All confidence scores (0-1 scale) should now use the centralized `confidence-utils.ts` helpers to ensure consistent formatting, thresholds, and UI styling.

## Thresholds (0-1 Scale)

| Threshold | Range | Label | Status | CSS Class | Badge |
|-----------|-------|-------|--------|-----------|-------|
| **HIGH** | ≥ 0.80 | "High confidence" | ✅ Acceptable | `text-emerald-600` | `default` |
| **MEDIUM** | 0.60-0.79 | "Medium confidence" | ⚠️ Warning | `text-amber-600` | `secondary` |
| **LOW** | < 0.60 | "Low confidence" | ❌ Critical | `text-red-600` | `destructive` |

## Where Confidence Appears

### 1. **Field-Level Confidence** (aiMetadata.field_confidence)
Each field in the metadata has its own confidence score stored in `Contract.aiMetadata.field_confidence`:
```json
{
  "field_confidence": {
    "document_title": 0.95,
    "external_parties": 0.78,
    "tcv_amount": 0.42,
    "jurisdiction": 0.88
  }
}
```

### 2. **Document Classification Confidence**
- `Contract.documentClassificationConf` — Is this a real contract? (0-1)
- `Contract.aiMetadata.document_classification_confidence` — Classification confidence (0-1)

### 3. **Artifact Confidence**
- `Artifact.confidence` — Confidence of extracted artifact (0-1)

### 4. **Classification Confidence** (Taxonomy)
- `Contract.classificationConf` — Confidence of category assignment (0-1)

## Usage Examples

### Example 1: Display Field Confidence in UI

**Before (inconsistent):**
```tsx
const confidence = metadata.field_confidence?.document_title;
const label = confidence ? `${Math.round(confidence * 100)}% confidence` : 'Unknown';
```

**After (standardized):**
```tsx
import { getFieldConfidence } from '@/lib/confidence-utils';

const confidenceConfig = getFieldConfidence('document_title', metadata.field_confidence);
if (confidenceConfig) {
  return (
    <span className={getConfidenceClass(confidenceConfig.value)}>
      {confidenceConfig.label} ({confidenceConfig.percentage})
    </span>
  );
}
```

### Example 2: Show Badge with Tooltip

```tsx
import { formatConfidence, getConfidenceBadgeVariant } from '@/lib/confidence-utils';
import { Badge } from '@/components/ui/badge';

export function FieldConfidenceBadge({ confidence }: { confidence: number }) {
  const config = formatConfidence(confidence);
  if (!config) return null;

  return (
    <Badge variant={getConfidenceBadgeVariant(confidence)} title={config.label}>
      {config.percentage}
    </Badge>
  );
}
```

### Example 3: Check if Field Meets Threshold

```tsx
import { meetsConfidenceThreshold, CONFIDENCE_THRESHOLDS } from '@/lib/confidence-utils';

// Accept field only if >= 60% confidence
if (meetsConfidenceThreshold(confidence, CONFIDENCE_THRESHOLDS.MEDIUM)) {
  acceptField();
}

// Require >= 80% for auto-application
if (meetsConfidenceThreshold(confidence, CONFIDENCE_THRESHOLDS.HIGH)) {
  applyAutomatically();
}
```

### Example 4: Display Overall Confidence

```tsx
import { getOverallConfidence } from '@/lib/confidence-utils';

const overall = getOverallConfidence(metadata.field_confidence);
if (overall) {
  return <div>Overall extraction quality: {overall.label}</div>;
}
```

## Components That Should Use This

### Priority 1 (Critical)
- [ ] `EnhancedContractMetadataSection` — Field confidence display in metadata editor
- [ ] `UploadMetadataReviewDialog` — Confidence indicators during review
- [ ] Contract details page — Show confidence for each metadata field
- [ ] Artifact viewer — Display artifact confidence scores

### Priority 2 (High)
- [ ] Dashboard cards — Show overall confidence statistics
- [ ] Model performance page — Confidence metrics across models
- [ ] AI audit reports — Confidence-based recommendations
- [ ] Batch operations — Show confidence in bulk upload results

### Priority 3 (Medium)
- [ ] Settings/admin pages — Confidence threshold configuration
- [ ] Alerts/warnings — Flag low-confidence extractions
- [ ] Export/reports — Include confidence in generated documents

## Implementation Checklist

When updating a component to use standardized confidence:

1. Import utilities:
   ```tsx
   import {
     formatConfidence,
     getFieldConfidence,
     getOverallConfidence,
     getConfidenceClass,
     getConfidenceBadgeVariant,
     meetsConfidenceThreshold,
     CONFIDENCE_THRESHOLDS,
   } from '@/lib/confidence-utils';
   ```

2. Replace inline confidence handling with utility functions

3. Test that confidence displays correctly:
   - ✅ HIGH (≥80%) → Green, "High confidence"
   - ✅ MEDIUM (60-79%) → Yellow/Amber, "Medium confidence"
   - ✅ LOW (<60%) → Red, "Low confidence"

4. Update CSS classes to use returned values instead of hardcoded ones

5. Update badge variants to use `getConfidenceBadgeVariant()`

6. Use `getConfidenceClass()` for consistent text styling

## API Contract Changes

### `/api/contracts/[id]/metadata` PUT Response

Now includes `metadataVersion` for optimistic locking:
```json
{
  "success": true,
  "data": {
    "id": "ctr_123",
    "enterpriseMetadata": { "field_confidence": {...} },
    "metadataVersion": 2,
    "ragReindexQueued": true
  }
}
```

### Request Body for PUT

Now supports `metadataVersion` to prevent concurrent edit conflicts:
```json
{
  "metadata": { ... },
  "metadataVersion": 1
}
```

## Configuration

All thresholds are defined in `confidence-utils.ts`:

```typescript
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,    // >= 80%
  MEDIUM: 0.6,  // 60-79%
  LOW: 0.0,     // < 60%
} as const;
```

To change thresholds globally, modify only this constant.

## Backward Compatibility

The `confidence-utils` functions are defensive and handle:
- ✅ Missing/undefined confidence values
- ✅ Invalid ranges (< 0 or > 1)
- ✅ NaN values
- ✅ Null field_confidence objects

All return `null` for invalid inputs instead of throwing errors.

## Migration Path

1. **Phase 1**: Add utilities, update critical components (Metadata, Upload, Details)
2. **Phase 2**: Update dashboard, reports, admin pages
3. **Phase 3**: Deprecate old confidence formatting code
4. **Phase 4**: Remove deprecated code, audit for consistency

## Future Enhancements

- [ ] Add confidence history tracking (track confidence trends over time)
- [ ] Implement field-specific thresholds (different thresholds per field type)
- [ ] Add user preference overrides (let tenants customize thresholds)
- [ ] Confidence anomaly detection (alert if confidence drops unexpectedly)
- [ ] ML-based confidence calibration (learn from correction patterns)
