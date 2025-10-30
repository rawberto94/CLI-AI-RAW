'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DetectedAnomaly {
  type: 'STATISTICAL_OUTLIER' | 'RATE_SPIKE' | 'INCONSISTENT_CLASSIFICATION' | 'DATA_QUALITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviationSigma: number;
}

interface AnomalyExplanation {
  anomaly: DetectedAnomaly;
  explanation: string;
  possibleCauses: string[];
  recommendations: string[];
  confidence: number;
}

interface AnomalyData {
  rateCardEntryId: string;
  hasAnomaly: boolean;
  anomalies: DetectedAnomaly[];
  overallSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresReview: boolean;
  explanations: AnomalyExplanation[];
}

interface AnomalyAlertProps {
  rateCardId: string;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityIcon(severity: 'LOW' | 'MEDIUM' | 'HIGH') {
  switch (severity) {
    case 'HIGH':
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case 'MEDIUM':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case 'LOW':
      return <Info className="h-5 w-5 text-blue-500" />;
  }
}

function getSeverityColor(severity: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (severity) {
    case 'HIGH':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW':
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}

function getAnomalyTypeLabel(type: DetectedAnomaly['type']): string {
  switch (type) {
    case 'STATISTICAL_OUTLIER':
      return 'Statistical Outlier';
    case 'RATE_SPIKE':
      return 'Rate Spike';
    case 'INCONSISTENT_CLASSIFICATION':
      return 'Classification Issue';
    case 'DATA_QUALITY':
      return 'Data Quality';
  }
}

// ============================================================================
// Anomaly Alert Component
// ============================================================================

export function AnomalyAlert({ rateCardId, className = '' }: AnomalyAlertProps) {
  const [anomalyData, setAnomalyData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchAnomalies = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/rate-cards/${rateCardId}/anomalies`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Failed to fetch anomalies');
        }

        setAnomalyData(result.data);
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching anomalies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnomalies();
  }, [rateCardId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className} border-red-200 bg-red-50`}>
        <CardContent className="py-4">
          <p className="text-sm text-red-600">Failed to load anomaly data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!anomalyData || !anomalyData.hasAnomaly) {
    return null; // Don't show anything if no anomalies
  }

  return (
    <Card className={`${className} border-l-4 ${
      anomalyData.overallSeverity === 'HIGH' ? 'border-l-red-500' :
      anomalyData.overallSeverity === 'MEDIUM' ? 'border-l-yellow-500' :
      'border-l-blue-500'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {getSeverityIcon(anomalyData.overallSeverity)}
            Anomalies Detected
          </CardTitle>
          <Badge variant={anomalyData.requiresReview ? 'destructive' : 'secondary'}>
            {anomalyData.requiresReview ? 'Review Required' : 'For Information'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {anomalyData.explanations.map((explanation, index) => {
          const isExpanded = expandedIndex === index;
          const anomaly = explanation.anomaly;

          return (
            <div
              key={index}
              className={`border rounded-lg p-3 ${getSeverityColor(anomaly.severity)}`}
            >
              {/* Anomaly Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getAnomalyTypeLabel(anomaly.type)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {anomaly.severity}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{anomaly.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="ml-2"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {/* Explanation */}
                  <div>
                    <h5 className="text-xs font-semibold mb-1">Explanation</h5>
                    <p className="text-xs">{explanation.explanation}</p>
                  </div>

                  {/* Possible Causes */}
                  {explanation.possibleCauses.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold mb-1">Possible Causes</h5>
                      <ul className="text-xs space-y-1">
                        {explanation.possibleCauses.map((cause, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {explanation.recommendations.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold mb-1">Recommendations</h5>
                      <ul className="text-xs space-y-1">
                        {explanation.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span>→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Confidence */}
                  <div className="text-xs text-gray-600">
                    Confidence: {(explanation.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
