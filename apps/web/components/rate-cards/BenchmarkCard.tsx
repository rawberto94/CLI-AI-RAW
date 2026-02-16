'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BenchmarkStatistics {
  sampleSize: number;
  mean: number;
  median: number;
  mode?: number;
  standardDeviation: number;
  min: number;
  max: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

interface MarketPosition {
  rate: number;
  percentileRank: number;
  position: 'BOTTOM_DECILE' | 'BOTTOM_QUARTILE' | 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'TOP_QUARTILE' | 'TOP_DECILE';
  deviation: number;
  deviationPercent: number;
}

interface BenchmarkCardProps {
  statistics?: BenchmarkStatistics;
  marketPosition?: MarketPosition;
  competitorCount?: number;
  calculatedAt?: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPositionColor(position: MarketPosition['position']): string {
  switch (position) {
    case 'BOTTOM_DECILE':
    case 'BOTTOM_QUARTILE':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'BELOW_AVERAGE':
      return 'bg-violet-100 text-violet-800 border-violet-300';
    case 'AVERAGE':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'ABOVE_AVERAGE':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'TOP_QUARTILE':
    case 'TOP_DECILE':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function getPositionLabel(position: MarketPosition['position']): string {
  switch (position) {
    case 'BOTTOM_DECILE':
      return 'Excellent (Bottom 10%)';
    case 'BOTTOM_QUARTILE':
      return 'Very Good (Bottom 25%)';
    case 'BELOW_AVERAGE':
      return 'Good (Below Average)';
    case 'AVERAGE':
      return 'Average';
    case 'ABOVE_AVERAGE':
      return 'Above Average';
    case 'TOP_QUARTILE':
      return 'High (Top 25%)';
    case 'TOP_DECILE':
      return 'Very High (Top 10%)';
    default:
      return 'Unknown';
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// Percentile Distribution Chart Component
// ============================================================================

function PercentileDistributionChart({ 
  statistics, 
  currentRate 
}: { 
  statistics: BenchmarkStatistics; 
  currentRate: number;
}) {
  const percentiles = [
    { label: 'Min', value: statistics.min, percentile: 0 },
    { label: 'P10', value: statistics.p10, percentile: 10 },
    { label: 'P25', value: statistics.p25, percentile: 25 },
    { label: 'P50', value: statistics.p50, percentile: 50 },
    { label: 'P75', value: statistics.p75, percentile: 75 },
    { label: 'P90', value: statistics.p90, percentile: 90 },
    { label: 'Max', value: statistics.max, percentile: 100 },
  ];

  const range = statistics.max - statistics.min;
  const getPosition = (value: number) => {
    if (range === 0) return 50;
    return ((value - statistics.min) / range) * 100;
  };

  const currentPosition = getPosition(currentRate);

  return (
    <div className="space-y-4">
      {/* Visual percentile bar */}
      <div className="relative h-12 bg-gradient-to-r from-violet-200 via-yellow-200 to-red-200 rounded-lg">
        {/* Percentile markers */}
        {percentiles.map((p, idx) => {
          const position = getPosition(p.value);
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-0.5 h-full bg-gray-400" />
            </div>
          );
        })}

        {/* Current rate indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${currentPosition}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div className="w-3 h-3 bg-violet-600 rounded-full border-2 border-white shadow-lg" />
          <div className="absolute top-6 bg-violet-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            Your Rate
          </div>
        </div>
      </div>

      {/* Percentile labels */}
      <div className="relative h-8">
        {percentiles.map((p, idx) => {
          const position = getPosition(p.value);
          return (
            <div
              key={idx}
              className="absolute flex flex-col items-center text-xs"
              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
            >
              <div className="font-medium text-gray-700">{p.label}</div>
              <div className="text-gray-500">{formatCurrency(p.value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Benchmark Card Component
// ============================================================================

// Mock/Default data for when no props are provided
const defaultStatistics: BenchmarkStatistics = {
  sampleSize: 45,
  mean: 850,
  median: 825,
  mode: 800,
  standardDeviation: 125,
  min: 550,
  max: 1200,
  p10: 650,
  p25: 725,
  p50: 825,
  p75: 950,
  p90: 1050,
  p95: 1125,
};

const defaultMarketPosition: MarketPosition = {
  rate: 920,
  percentileRank: 68,
  position: 'ABOVE_AVERAGE',
  deviation: 95,
  deviationPercent: 11.5,
};

export function BenchmarkCard(props: BenchmarkCardProps = {}) {
  const {
    statistics = defaultStatistics,
    marketPosition = defaultMarketPosition,
    competitorCount = 45,
    calculatedAt = new Date(),
  } = props || {};
  
  const isLowConfidence = statistics?.sampleSize < 10;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Market Benchmark</CardTitle>
          <div className="text-sm text-gray-500">
            Updated {new Date(calculatedAt).toLocaleDateString()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Low confidence warning */}
        {isLowConfidence && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Limited Data:</strong> Only {statistics.sampleSize} comparable rates found. 
              Benchmark should be used with caution.
            </div>
          </div>
        )}

        {/* Market Position Badge */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">Market Position</div>
            <Badge className={`${getPositionColor(marketPosition.position)} text-base px-3 py-1`}>
              {getPositionLabel(marketPosition.position)}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600 mb-1">Percentile Rank</div>
            <div className="text-2xl font-bold text-gray-900">
              {marketPosition.percentileRank.toFixed(0)}
              <span className="text-sm font-normal text-gray-500">th</span>
            </div>
          </div>
        </div>

        {/* Deviation from median */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          {marketPosition.deviation > 0 ? (
            <TrendingUp className="w-5 h-5 text-red-600" />
          ) : marketPosition.deviation < 0 ? (
            <TrendingDown className="w-5 h-5 text-green-600" />
          ) : (
            <Minus className="w-5 h-5 text-gray-600" />
          )}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              {Math.abs(marketPosition.deviation) > 0 ? (
                <>
                  {formatCurrency(Math.abs(marketPosition.deviation))} {marketPosition.deviation > 0 ? 'above' : 'below'} market median
                </>
              ) : (
                'At market median'
              )}
            </div>
            <div className="text-xs text-gray-600">
              {Math.abs(marketPosition.deviationPercent).toFixed(1)}% {marketPosition.deviation > 0 ? 'higher' : marketPosition.deviation < 0 ? 'lower' : 'difference'}
            </div>
          </div>
        </div>

        {/* Percentile Distribution Chart */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Rate Distribution</div>
          <PercentileDistributionChart 
            statistics={statistics} 
            currentRate={marketPosition.rate} 
          />
        </div>

        {/* Statistical Summary */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Statistical Summary</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mean:</span>
                <span className="font-medium">{formatCurrency(statistics.mean)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Median:</span>
                <span className="font-medium">{formatCurrency(statistics.median)}</span>
              </div>
              {statistics.mode && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Mode:</span>
                  <span className="font-medium">{formatCurrency(statistics.mode)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Std Dev:</span>
                <span className="font-medium">{formatCurrency(statistics.standardDeviation)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Min:</span>
                <span className="font-medium">{formatCurrency(statistics.min)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Max:</span>
                <span className="font-medium">{formatCurrency(statistics.max)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Range:</span>
                <span className="font-medium">{formatCurrency(statistics.max - statistics.min)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cohort Information */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Sample Size</div>
              <div className="font-medium text-gray-900">{statistics.sampleSize} rates</div>
            </div>
            <div>
              <div className="text-gray-600">Competitors</div>
              <div className="font-medium text-gray-900">{competitorCount} suppliers</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Auto-generated default export
export default BenchmarkCard;
