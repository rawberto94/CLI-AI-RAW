'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';

interface BaselineComparison {
  rateCardEntryId: string;
  baselineId: string;
  baselineName: string;
  baselineType: string;
  actualRate: number;
  baselineRate: number;
  variance: number;
  variancePercentage: number;
  isWithinTolerance: boolean;
  potentialSavings: number;
  status: 'BELOW_BASELINE' | 'AT_BASELINE' | 'ABOVE_BASELINE';
}

interface BaselineComparisonCardProps {
  rateCardEntryId: string;
}

export function BaselineComparisonCard({ rateCardEntryId }: BaselineComparisonCardProps) {
  const [comparisons, setComparisons] = useState<BaselineComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComparisons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCardEntryId]);

  const fetchComparisons = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/rate-cards/${rateCardEntryId}/baseline-comparison`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch baseline comparisons');
      }

      const data = await response.json();
      setComparisons(data.comparisons);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load comparisons');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'BELOW_BASELINE':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'AT_BASELINE':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'ABOVE_BASELINE':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      BELOW_BASELINE: 'default',
      AT_BASELINE: 'secondary',
      ABOVE_BASELINE: 'destructive',
    };
    const labels: Record<string, string> = {
      BELOW_BASELINE: 'Below Baseline',
      AT_BASELINE: 'At Baseline',
      ABOVE_BASELINE: 'Above Baseline',
    };
    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TARGET_RATE: 'Target',
      MARKET_BENCHMARK: 'Market',
      HISTORICAL_BEST: 'Historical',
      NEGOTIATED_CAP: 'Cap',
      INTERNAL_POLICY: 'Policy',
    };
    return (
      <Badge variant="outline">
        {labels[type] || type}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Baseline Comparisons</h3>
        <div className="text-center text-gray-500 py-8">Loading comparisons...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Baseline Comparisons</h3>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Baseline Comparisons</h3>
        <div className="text-center text-gray-500 py-8">
          <Info className="h-12 w-12 mx-auto mb-2 text-gray-400" />
          <p>No applicable baselines found for this rate card.</p>
          <p className="text-sm mt-1">Create baselines to track performance against targets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Baseline Comparisons</h3>
        <Button variant="outline" size="sm" onClick={fetchComparisons}>
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {comparisons.map((comparison) => (
          <div
            key={comparison.baselineId}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(comparison.status)}
                <div>
                  <h4 className="font-medium">{comparison.baselineName}</h4>
                  <div className="flex gap-2 mt-1">
                    {getTypeBadge(comparison.baselineType)}
                    {getStatusBadge(comparison.status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-sm text-gray-500">Actual Rate</p>
                <p className="text-lg font-semibold">
                  ${comparison.actualRate.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Baseline Rate</p>
                <p className="text-lg font-semibold">
                  ${comparison.baselineRate.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
              <div>
                <p className="text-sm text-gray-500">Variance</p>
                <div className="flex items-center gap-1">
                  {comparison.variance > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  )}
                  <p className={`text-lg font-semibold ${
                    comparison.variance > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {comparison.variance > 0 ? '+' : ''}
                    ${Math.abs(comparison.variance).toLocaleString()}
                  </p>
                  <span className={`text-sm ${
                    comparison.variance > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ({comparison.variancePercentage > 0 ? '+' : ''}
                    {comparison.variancePercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              {comparison.potentialSavings > 0 && (
                <div>
                  <p className="text-sm text-gray-500">Potential Savings</p>
                  <p className="text-lg font-semibold text-green-600">
                    ${comparison.potentialSavings.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {!comparison.isWithinTolerance && comparison.status === 'ABOVE_BASELINE' && (
              <div className="mt-3 pt-3 border-t">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Action Required</p>
                      <p className="mt-1">
                        This rate exceeds the baseline by more than the tolerance threshold.
                        Consider negotiating with the supplier or exploring alternatives.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {comparison.isWithinTolerance && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Within tolerance threshold</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
