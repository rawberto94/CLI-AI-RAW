/**
 * useExtractionInsights Hook
 * 
 * React hook for accessing real-time AI extraction insights
 * and quality metrics.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionInsights {
  currentPerformance: {
    successRate: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
  trends: {
    successRateTrend: 'improving' | 'stable' | 'declining';
    confidenceTrend: 'improving' | 'stable' | 'declining';
    processingTimeTrend: 'improving' | 'stable' | 'declining';
  };
  recommendations: string[];
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    fieldType?: string;
  }>;
}

export interface QualityScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    accuracy: number;
    confidence: number;
    efficiency: number;
    userSatisfaction: number;
  };
}

export interface UseExtractionInsightsResult {
  insights: ExtractionInsights | null;
  quality: QualityScore | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordEvent: (event: ExtractionEvent) => Promise<void>;
}

export interface ExtractionEvent {
  contractId: string;
  eventType: 'extraction_started' | 'extraction_completed' | 'field_corrected' | 'field_extracted';
  fieldKey?: string;
  fieldType?: string;
  confidence?: number;
  originalValue?: any;
  correctedValue?: any;
  processingTimeMs?: number;
  modelUsed?: string;
  success?: boolean;
  errorMessage?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useExtractionInsights(options: {
  tenantId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
} = {}): UseExtractionInsightsResult {
  const {
    tenantId = 'demo',
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [insights, setInsights] = useState<ExtractionInsights | null>(null);
  const [quality, setQuality] = useState<QualityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai/extraction-insights?type=all', {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setInsights(data.data.realtime);
        setQuality(data.data.quality);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
      console.error('Failed to fetch extraction insights:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const recordEvent = useCallback(async (event: ExtractionEvent) => {
    try {
      const response = await fetch('/api/ai/extraction-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.error('Failed to record extraction event');
      }
    } catch (err) {
      console.error('Error recording extraction event:', err);
    }
  }, [tenantId]);

  // Initial fetch
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchInsights, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchInsights]);

  return {
    insights,
    quality,
    loading,
    error,
    refresh: fetchInsights,
    recordEvent,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getTrendIcon(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving':
      return '📈';
    case 'declining':
      return '📉';
    case 'stable':
    default:
      return '➡️';
  }
}

export function getTrendColor(trend: 'improving' | 'stable' | 'declining'): string {
  switch (trend) {
    case 'improving':
      return 'text-green-600';
    case 'declining':
      return 'text-red-600';
    case 'stable':
    default:
      return 'text-gray-600';
  }
}

export function getGradeColor(grade: 'A' | 'B' | 'C' | 'D' | 'F'): string {
  switch (grade) {
    case 'A':
      return 'text-green-600 bg-green-100';
    case 'B':
      return 'text-blue-600 bg-blue-100';
    case 'C':
      return 'text-yellow-600 bg-yellow-100';
    case 'D':
      return 'text-orange-600 bg-orange-100';
    case 'F':
      return 'text-red-600 bg-red-100';
  }
}

export function formatProcessingTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}
