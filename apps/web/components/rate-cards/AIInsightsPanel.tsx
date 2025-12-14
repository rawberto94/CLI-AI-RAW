'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BenchmarkInsight {
  rateCardEntryId: string;
  summary: string;
  marketPosition: string;
  keyFindings: string[];
  recommendations: string[];
  confidence: number;
  dataPoints: number;
  generatedAt: Date;
}

interface AIInsightsPanelProps {
  rateCardId: string;
  className?: string;
}

// ============================================================================
// AI Insights Panel Component
// ============================================================================

export function AIInsightsPanel({ rateCardId, className = '' }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<BenchmarkInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rate-cards/${rateCardId}/insights`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch insights');
      }

      setInsights(result.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCardId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchInsights} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={insights.confidence > 0.8 ? 'default' : 'secondary'}>
              {(insights.confidence * 100).toFixed(0)}% Confidence
            </Badge>
            <Button onClick={fetchInsights} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <h4 className="font-semibold text-sm">Market Position</h4>
          </div>
          <Badge variant="outline" className="mb-2">
            {insights.marketPosition}
          </Badge>
          <p className="text-sm text-gray-700">{insights.summary}</p>
          <p className="text-xs text-gray-500 mt-1">
            Based on {insights.dataPoints} comparable rates
          </p>
        </div>

        {/* Key Findings */}
        {insights.keyFindings.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Key Findings
            </h4>
            <ul className="space-y-2">
              {insights.keyFindings.map((finding, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span className="text-gray-700">{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {insights.recommendations.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Recommendations
            </h4>
            <ul className="space-y-2">
              {insights.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-500 mt-0.5">→</span>
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t text-xs text-gray-500">
          Generated {new Date(insights.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
