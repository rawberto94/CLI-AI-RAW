/**
 * useMetadataExtraction Hook
 * 
 * React hook for AI-powered metadata extraction with schema awareness.
 * Provides extraction, validation, and application of metadata fields.
 */

import { useState, useCallback } from 'react';
import type { MetadataExtractionResult, ExtractionResult, ExtractionOptions } from '@/lib/ai/metadata-extractor';

interface UseMetadataExtractionOptions {
  contractId: string;
  tenantId?: string;
  autoExtract?: boolean;
  onExtractionComplete?: (result: MetadataExtractionResult) => void;
  onError?: (error: Error) => void;
}

interface ExtractionState {
  isExtracting: boolean;
  isApplying: boolean;
  lastExtraction: MetadataExtractionResult | null;
  error: string | null;
  progress: {
    phase: 'idle' | 'extracting' | 'validating' | 'complete' | 'error';
    message: string;
    percent: number;
  };
}

export function useMetadataExtraction(options: UseMetadataExtractionOptions) {
  const { contractId, tenantId = 'demo', onExtractionComplete, onError } = options;

  const [state, setState] = useState<ExtractionState>({
    isExtracting: false,
    isApplying: false,
    lastExtraction: null,
    error: null,
    progress: {
      phase: 'idle',
      message: 'Ready to extract',
      percent: 0,
    },
  });

  // Extract metadata from contract
  const extractMetadata = useCallback(async (
    documentText?: string,
    extractionOptions?: ExtractionOptions
  ): Promise<MetadataExtractionResult | null> => {
    setState(prev => ({
      ...prev,
      isExtracting: true,
      error: null,
      progress: { phase: 'extracting', message: 'Starting extraction...', percent: 10 },
    }));

    try {
      setState(prev => ({
        ...prev,
        progress: { phase: 'extracting', message: 'Analyzing document with AI...', percent: 30 },
      }));

      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          documentText,
          useContractText: !documentText,
          options: extractionOptions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Extraction failed');
      }

      setState(prev => ({
        ...prev,
        progress: { phase: 'validating', message: 'Validating extracted fields...', percent: 70 },
      }));

      const { data } = await response.json();

      setState(prev => ({
        ...prev,
        isExtracting: false,
        lastExtraction: data,
        progress: { phase: 'complete', message: 'Extraction complete', percent: 100 },
      }));

      onExtractionComplete?.(data);
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isExtracting: false,
        error: errorMessage,
        progress: { phase: 'error', message: errorMessage, percent: 0 },
      }));
      onError?.(error as Error);
      return null;
    }
  }, [contractId, tenantId, onExtractionComplete, onError]);

  // Extract specific fields
  const extractFields = useCallback(async (
    fieldIds: string[],
    documentText?: string
  ): Promise<MetadataExtractionResult | null> => {
    return extractMetadata(documentText, { 
      skipFields: [], 
      priorityFields: fieldIds 
    });
  }, [extractMetadata]);

  // Re-extract low confidence fields
  const reExtractLowConfidence = useCallback(async (
    confidenceThreshold = 0.7
  ): Promise<MetadataExtractionResult | null> => {
    if (!state.lastExtraction) {
      setState(prev => ({ ...prev, error: 'No previous extraction to improve' }));
      return null;
    }

    const lowConfidenceIds = state.lastExtraction.results
      .filter(r => r.confidence < confidenceThreshold)
      .map(r => r.fieldId);

    if (lowConfidenceIds.length === 0) {
      return state.lastExtraction;
    }

    return extractMetadata(undefined, {
      priorityFields: lowConfidenceIds,
      maxPasses: 3,
      enableMultiPass: true,
    });
  }, [state.lastExtraction, extractMetadata]);

  // Apply extracted metadata to contract
  const applyMetadata = useCallback(async (
    fields?: Record<string, any>,
    options?: {
      applyHighConfidenceOnly?: boolean;
      confidenceThreshold?: number;
      markAsValidated?: boolean;
    }
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isApplying: true, error: null }));

    try {
      // Use provided fields or all extracted fields
      const fieldsToApply = fields || state.lastExtraction?.rawExtractions;
      
      if (!fieldsToApply || Object.keys(fieldsToApply).length === 0) {
        throw new Error('No fields to apply');
      }

      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          fields: fieldsToApply,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply metadata');
      }

      setState(prev => ({ ...prev, isApplying: false }));
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isApplying: false,
        error: errorMessage,
      }));
      onError?.(error as Error);
      return false;
    }
  }, [contractId, tenantId, state.lastExtraction, onError]);

  // Get extraction results
  const getExtractionResults = useCallback(async (): Promise<any | null> => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
        headers: { 'x-tenant-id': tenantId },
      });

      if (!response.ok) {
        return null;
      }

      const { data } = await response.json();
      return data;

    } catch {
      return null;
    }
  }, [contractId, tenantId]);

  // Clear extraction state
  const clearExtraction = useCallback(() => {
    setState({
      isExtracting: false,
      isApplying: false,
      lastExtraction: null,
      error: null,
      progress: { phase: 'idle', message: 'Ready to extract', percent: 0 },
    });
  }, []);

  // Get fields by confidence level
  const getFieldsByConfidence = useCallback((
    threshold: number,
    above = true
  ): ExtractionResult[] => {
    if (!state.lastExtraction) return [];
    
    return state.lastExtraction.results.filter(r => 
      above ? r.confidence >= threshold : r.confidence < threshold
    );
  }, [state.lastExtraction]);

  // Get fields that require human review
  const getFieldsRequiringReview = useCallback((): ExtractionResult[] => {
    if (!state.lastExtraction) return [];
    return state.lastExtraction.results.filter(r => r.requiresHumanReview);
  }, [state.lastExtraction]);

  // Get fields by category
  const getFieldsByCategory = useCallback((
    category: string
  ): ExtractionResult[] => {
    if (!state.lastExtraction) return [];
    return state.lastExtraction.results.filter(r => r.category === category);
  }, [state.lastExtraction]);

  // Update a single field's value
  const updateFieldValue = useCallback((
    fieldId: string,
    newValue: any
  ) => {
    setState(prev => {
      if (!prev.lastExtraction) return prev;

      const updatedResults = prev.lastExtraction.results.map(r => {
        if (r.fieldId === fieldId) {
          return {
            ...r,
            value: newValue,
            rawValue: String(newValue),
            validationStatus: 'valid' as const,
            requiresHumanReview: false,
          };
        }
        return r;
      });

      return {
        ...prev,
        lastExtraction: {
          ...prev.lastExtraction,
          results: updatedResults,
          rawExtractions: {
            ...prev.lastExtraction.rawExtractions,
            [prev.lastExtraction.results.find(r => r.fieldId === fieldId)?.fieldName || '']: newValue,
          },
        },
      };
    });
  }, []);

  return {
    // State
    ...state,
    extraction: state.lastExtraction,
    
    // Actions
    extractMetadata,
    extractFields,
    reExtractLowConfidence,
    applyMetadata,
    getExtractionResults,
    clearExtraction,
    updateFieldValue,
    
    // Selectors
    getFieldsByConfidence,
    getFieldsRequiringReview,
    getFieldsByCategory,
    
    // Computed
    hasExtraction: !!state.lastExtraction,
    highConfidenceCount: state.lastExtraction?.summary.highConfidenceFields || 0,
    lowConfidenceCount: state.lastExtraction?.summary.lowConfidenceFields || 0,
    needsReviewCount: state.lastExtraction?.results.filter(r => r.requiresHumanReview).length || 0,
    averageConfidence: state.lastExtraction?.summary.averageConfidence || 0,
  };
}

export type UseMetadataExtractionReturn = ReturnType<typeof useMetadataExtraction>;
