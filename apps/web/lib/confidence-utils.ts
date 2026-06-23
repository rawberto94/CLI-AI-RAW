/**
 * Centralized confidence threshold utilities for standardizing all confidence scoring
 * across Contigo's metadata, AI confidence, and document classification systems
 */

export interface ConfidenceConfig {
  value: number; // 0-1
  percentage: string; // "85%"
  label: string; // "High confidence" | "Medium confidence" | "Low confidence"
  severity: 'high' | 'medium' | 'low'; // For UI styling
  thresholdStatus: 'acceptable' | 'warning' | 'critical'; // For display state
}

export interface FieldConfidenceMap {
  [fieldName: string]: number; // 0-1 confidence per field
}

/**
 * Confidence thresholds (0-1 scale)
 * These should be standardized across all UI surfaces
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8, // >= 80% — Trust this field, show as confident
  MEDIUM: 0.6, // 60-79% — Show as warning
  LOW: 0.0, // < 60% — Show as critical, require review
} as const;

/**
 * Format a single confidence score into a standardized display object
 * @param confidence Confidence value (0-1)
 * @returns Standardized confidence config for UI display
 */
export function formatConfidence(confidence: number | null | undefined): ConfidenceConfig | null {
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    return null;
  }

  const percentage = Math.round(confidence * 100);
  const thresholdStatus =
    confidence >= CONFIDENCE_THRESHOLDS.HIGH
      ? 'acceptable'
      : confidence >= CONFIDENCE_THRESHOLDS.MEDIUM
        ? 'warning'
        : 'critical';

  const label =
    confidence >= CONFIDENCE_THRESHOLDS.HIGH
      ? 'High confidence'
      : confidence >= CONFIDENCE_THRESHOLDS.MEDIUM
        ? 'Medium confidence'
        : 'Low confidence';

  const severity =
    confidence >= CONFIDENCE_THRESHOLDS.HIGH
      ? 'high'
      : confidence >= CONFIDENCE_THRESHOLDS.MEDIUM
        ? 'medium'
        : 'low';

  return {
    value: confidence,
    percentage: `${percentage}%`,
    label,
    severity,
    thresholdStatus,
  };
}

/**
 * Extract field confidence from aiMetadata.field_confidence object
 * @param fieldName The field to get confidence for (e.g., "document_title", "tcv_amount")
 * @param fieldConfidenceMap The field_confidence object from aiMetadata
 * @returns Standardized confidence config or null if not found
 */
export function getFieldConfidence(
  fieldName: string,
  fieldConfidenceMap?: FieldConfidenceMap | null | any,
): ConfidenceConfig | null {
  if (!fieldConfidenceMap || typeof fieldConfidenceMap !== 'object') {
    return null;
  }

  const confidence = fieldConfidenceMap[fieldName];
  return formatConfidence(confidence);
}

/**
 * Get overall confidence across multiple fields
 * @param fieldConfidenceMap The field_confidence object from aiMetadata
 * @returns Average confidence for all fields
 */
export function getOverallConfidence(fieldConfidenceMap?: FieldConfidenceMap | null | any): ConfidenceConfig | null {
  if (!fieldConfidenceMap || typeof fieldConfidenceMap !== 'object') {
    return null;
  }

  const confidenceValues = Object.values(fieldConfidenceMap).filter(
    (v) => typeof v === 'number' && v >= 0 && v <= 1,
  ) as number[];

  if (confidenceValues.length === 0) {
    return null;
  }

  const average = confidenceValues.reduce((sum, v) => sum + v, 0) / confidenceValues.length;
  return formatConfidence(average);
}

/**
 * Check if a field meets the minimum confidence threshold
 * @param confidence Confidence value (0-1)
 * @param threshold Minimum acceptable threshold (default: MEDIUM)
 * @returns true if confidence >= threshold
 */
export function meetsConfidenceThreshold(
  confidence: number | null | undefined,
  threshold: number = CONFIDENCE_THRESHOLDS.MEDIUM,
): boolean {
  return typeof confidence === 'number' && confidence >= threshold;
}

/**
 * Get CSS class name for confidence styling
 * Use this consistently across all UI components
 * @param confidence Confidence value (0-1)
 * @returns Tailwind class name for styling
 */
export function getConfidenceClass(confidence: number | null | undefined): string {
  const config = formatConfidence(confidence);
  if (!config) return 'text-slate-400'; // Unknown

  switch (config.thresholdStatus) {
    case 'acceptable':
      return 'text-emerald-600'; // Green — high confidence
    case 'warning':
      return 'text-amber-600'; // Yellow — medium confidence
    case 'critical':
      return 'text-red-600'; // Red — low confidence
  }
}

/**
 * Get badge variant for UI display
 * @param confidence Confidence value (0-1)
 * @returns Variant name for Badge component
 */
export function getConfidenceBadgeVariant(
  confidence: number | null | undefined,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const config = formatConfidence(confidence);
  if (!config) return 'secondary';

  switch (config.thresholdStatus) {
    case 'acceptable':
      return 'default';
    case 'warning':
      return 'secondary';
    case 'critical':
      return 'destructive';
  }
}
