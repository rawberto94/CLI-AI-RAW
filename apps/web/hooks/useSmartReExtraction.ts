/**
 * useSmartReExtraction Hook
 * 
 * Provides functionality for intelligent re-extraction of metadata fields:
 * - Prioritizes low-confidence fields
 * - Uses stronger models for re-extraction
 * - Records feedback for learning
 * - Tracks extraction improvements
 */

import { useState, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  value: any;
  confidence: number | null;
  source?: string;
  alternatives?: Array<{ value: any; confidence: number }>;
}

export interface ReExtractionResult {
  success: boolean;
  fields: ExtractedField[];
  improved: number;
  unchanged: number;
  failed: number;
}

export interface ReExtractionOptions {
  useStrongerModel?: boolean;
  includeContext?: boolean;
  maxRetries?: number;
}

interface UseSmartReExtractionProps {
  contractId: string;
  tenantId?: string;
  onFeedback?: (fieldKey: string, action: "approved" | "corrected" | "rejected", value?: any) => void;
}

interface UseSmartReExtractionReturn {
  reExtractFields: (fieldKeys: string[], options?: ReExtractionOptions) => Promise<ExtractedField[]>;
  recordFeedback: (fieldKey: string, action: "approved" | "corrected" | "rejected", value?: any) => Promise<void>;
  isReExtracting: boolean;
  reExtractionProgress: { current: number; total: number } | null;
  lastResult: ReExtractionResult | null;
  error: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartReExtraction({
  contractId,
  tenantId = "demo",
  onFeedback,
}: UseSmartReExtractionProps): UseSmartReExtractionReturn {
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [reExtractionProgress, setReExtractionProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<ReExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Re-extract specific fields with improved accuracy
   */
  const reExtractFields = useCallback(async (
    fieldKeys: string[],
    options: ReExtractionOptions = {}
  ): Promise<ExtractedField[]> => {
    setIsReExtracting(true);
    setReExtractionProgress({ current: 0, total: fieldKeys.length });
    setError(null);

    const {
      useStrongerModel = true,
      includeContext = true,
      maxRetries = 2,
    } = options;

    try {
      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          fieldKeys,
          reExtract: true,
          options: {
            useStrongerModel,
            includeContext,
            maxRetries,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Re-extraction failed");
      }

      const result = await response.json();
      const fields = result.fields as ExtractedField[];

      // Calculate improvement stats
      let improved = 0;
      let unchanged = 0;
      let failed = 0;

      for (const field of fields) {
        if (field.confidence !== null) {
          if (field.confidence >= 0.8) {
            improved++;
          } else if (field.confidence >= 0.5) {
            unchanged++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      }

      const reExtractionResult: ReExtractionResult = {
        success: true,
        fields,
        improved,
        unchanged,
        failed,
      };

      setLastResult(reExtractionResult);
      return fields;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setLastResult({
        success: false,
        fields: [],
        improved: 0,
        unchanged: 0,
        failed: fieldKeys.length,
      });
      throw err;
    } finally {
      setIsReExtracting(false);
      setReExtractionProgress(null);
    }
  }, [contractId, tenantId]);

  /**
   * Record user feedback for a field
   */
  const recordFeedback = useCallback(async (
    fieldKey: string,
    action: "approved" | "corrected" | "rejected",
    value?: any
  ): Promise<void> => {
    try {
      // Record in analytics
      await fetch("/api/analytics/extraction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          contractId,
          fieldKey,
          action,
          correctedValue: action === "corrected" ? value : undefined,
        }),
      });

      // If correcting, also update the metadata
      if (action === "corrected" && value !== undefined) {
        await fetch(`/api/contracts/${contractId}/metadata`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            [fieldKey]: value,
          }),
        });
      }

      // Call external feedback handler if provided
      onFeedback?.(fieldKey, action, value);
    } catch (err: unknown) {
      throw err;
    }
  }, [contractId, tenantId, onFeedback]);

  return {
    reExtractFields,
    recordFeedback,
    isReExtracting,
    reExtractionProgress,
    lastResult,
    error,
  };
}

export default useSmartReExtraction;
