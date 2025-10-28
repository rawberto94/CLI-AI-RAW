'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Activity, Calendar } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TrendAnalysis {
  direction: 'INCREASING' | 'STABLE' | 'DECREASING';
  monthOverMonth?: number;
  quarterOverQuarter?: number;
  yearOverYear?: number;
  confidence: number;
  dataPoints: number;
}

interface TrendVisualizationProps {
  trendAnalysis?: TrendAnalysis;
  currentRate?: number;
  roleStandardized?: string;
  historicalData?: Array<{
    date: Date;
    averageRate: number;
    sampleSize: number;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, includeSign: boolean = true): string {
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function getTrendIcon(direction: TrendAnalysis['direction']) {
  switch (direction) {
    case 'INCREASING':
      return TrendingUp;
    case 'DECREASING':
      return TrendingDown;
    case 'STABLE':
      return Minus;
  }
}

function getTrendColor(direction: TrendAnalysis['direction']): string {
  switch (direction) {
    case 'INCREASING':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'DECREASING':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'STABLE':
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function getTrendLabel(direction: TrendAnalysis['direction']): string {
  switch (direction) {
    case 'INCREASING':
      return 'Increasing';
    case 'DECREASING':
      return 'Decreasing';
    case 'STABLE':
      return 'Stable';
  }
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-300';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-orange-100 text-orange-800 border-orange-300';
}

function generateForecast(
  currentRate: number,
  trendAnalysis: TrendAnalysis
): { rate: number; label: string } | null {
  if (!trendAnalysis.yearOverYear) return null;

  // Simple linear forecast based on YoY trend
  const forecastRate = currentRate * (1 + trendAnalysis.yearOverYear / 100);
  
  return {
    rate: forecastRate,
    label: '12-month forecast',
  };
}

// ============================================================================
// Trend Change Card Component
// ============================================================================

function TrendChangeCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: number;
  icon: React.ElementType;
}) {
  if (value === undefined) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg opacity-50">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <div className="text-sm font-medium text-gray-500">{label}</div>
        </div>
        <div className="text-xs text-gray-400">Insufficient data</div>
      </div>
    );
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = Math.abs(value) < 0.5;

  const colorClass = isNeutral
    ? 'text-gray-600'
    : isPositive
    ? 'text-red-600'
    : 'text-green-600';

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        <div className="text-sm font-medium text-gray-700">{label}</div>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {formatPercent(value, true)}
      </div>
      {isNeutral && (
        <div className="text-xs text-gray-500 mt-1">Minimal change</div>
      )}
    </div>
  );
}

// ============================================================================
// Simple Historical Chart Component
// ============================================================================

function SimpleHistoricalChart({
  data,
  currentRate,
}: {
  data: Array<{ date: Date; averageRate: number; sampleSize: number }>;
  currentRate: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">No historical data available</div>
        </div>
      </div>
    );
  }

  const rates = data.map(d => d.averageRate);
  const minRate = Math.min(...rates, currentRate);
  const maxRate = Math.max(...rates, currentRate);
  const range = maxRate - minRate;
  const padding = range * 0.1;

  const chartMin = minRate - padding;
  const chartMax = maxRate + padding;
  const chartRange = chartMax - chartMin;

  const getY = (rate: number) => {
    return ((chartMax - rate) / chartRange) * 100;
  };

  // Create SVG path for the line
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = getY(d.averageRate);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Determine trend color
  const firstRate = data[0].averageRate;
  const lastRate = data[data.length - 1].averageRate;
  const trendColor = lastRate > firstRate ? '#dc2626' : lastRate < firstRate ? '#16a34a' : '#6b7280';

  return (
    <div className="space-y-3">
      <div className="relative h-48 bg-gradient-to-b from-gray-50 to-white rounded-lg border border-gray-200 p-4">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="#e5e7eb" strokeWidth="0.2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#e5e7eb" strokeWidth="0.2" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="#e5e7eb" strokeWidth="0.2" />

          {/* Area under the line */}
          <path
            d={`${pathD} L 100,100 L 0,100 Z`}
            fill={trendColor}
            fillOpacity="0.1"
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={trendColor}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = getY(d.averageRate);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="0.8"
                fill={trendColor}
                className="hover:r-1.5 transition-all"
              />
            );
          })}

          {/* Current rate indicator */}
          <line
            x1="0"
            y1={getY(currentRate)}
            x2="100"
            y2={getY(currentRate)}
            stroke="#3b82f6"
            strokeWidth="0.3"
            strokeDasharray="2,2"
          />
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2">
          <div>{formatCurrency(chartMax)}</div>
          <div>{formatCurrency((chartMax + chartMin) / 2)}</div>
          <div>{formatCurrency(chartMin)}</div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 px-4">
        <div>{new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
        {data.length > 2 && (
          <div>{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
        )}
        <div>{new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Trend Visualization Component
// ============================================================================

// Mock/Default data
const defaultTrendAnalysis: TrendAnalysis = {
  direction: 'INCREASING',
  monthOverMonth: 2.3,
  quarterOverQuarter: 5.8,
  yearOverYear: 12.4,
  confidence: 0.85,
  dataPoints: 24,
};

const defaultHistoricalData = [
  { date: new Date('2024-01-01'), averageRate: 750, sampleSize: 42 },
  { date: new Date('2024-04-01'), averageRate: 780, sampleSize: 45 },
  { date: new Date('2024-07-01'), averageRate: 805, sampleSize: 48 },
  { date: new Date('2024-10-01'), averageRate: 825, sampleSize: 45 },
  { date: new Date('2025-01-01'), averageRate: 850, sampleSize: 43 },
];

export function TrendVisualization(props: TrendVisualizationProps = {}) {
  const {
    trendAnalysis = defaultTrendAnalysis,
    currentRate = 920,
    roleStandardized = 'Senior Software Developer',
    historicalData = defaultHistoricalData,
  } = props || {};
  
  const TrendIcon = getTrendIcon(trendAnalysis.direction);
  const forecast = generateForecast(currentRate, trendAnalysis);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Market Trend Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={getConfidenceColor(trendAnalysis.confidence)}>
              {getConfidenceLabel(trendAnalysis.confidence)} Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Trend Indicator */}
        <div className={`p-4 rounded-lg border ${getTrendColor(trendAnalysis.direction)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getTrendColor(trendAnalysis.direction)}`}>
                <TrendIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Market Trend</div>
                <div className="text-xl font-bold">
                  {getTrendLabel(trendAnalysis.direction)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Data Points</div>
              <div className="text-lg font-semibold">{trendAnalysis.dataPoints}</div>
            </div>
          </div>
        </div>

        {/* Period-over-Period Changes */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Rate Changes</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TrendChangeCard
              label="Month-over-Month"
              value={trendAnalysis.monthOverMonth}
              icon={Calendar}
            />
            <TrendChangeCard
              label="Quarter-over-Quarter"
              value={trendAnalysis.quarterOverQuarter}
              icon={Calendar}
            />
            <TrendChangeCard
              label="Year-over-Year"
              value={trendAnalysis.yearOverYear}
              icon={Calendar}
            />
          </div>
        </div>

        {/* Historical Trend Chart */}
        {historicalData && historicalData.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Historical Trend</div>
            <SimpleHistoricalChart data={historicalData} currentRate={currentRate} />
          </div>
        )}

        {/* Forecast */}
        {forecast && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900 mb-1">
                  {forecast.label}
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(forecast.rate)}/day
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Based on current {trendAnalysis.direction.toLowerCase()} trend
                  {trendAnalysis.yearOverYear && ` (${formatPercent(trendAnalysis.yearOverYear, true)} YoY)`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trend Insights */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Insights</div>
          <div className="space-y-2">
            {trendAnalysis.direction === 'INCREASING' && trendAnalysis.yearOverYear && trendAnalysis.yearOverYear > 5 && (
              <div className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-red-600">⚠️</span>
                <span>
                  Rates are increasing significantly. Consider locking in current rates or accelerating negotiations.
                </span>
              </div>
            )}
            {trendAnalysis.direction === 'DECREASING' && trendAnalysis.yearOverYear && trendAnalysis.yearOverYear < -5 && (
              <div className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>
                  Rates are declining. Good opportunity to renegotiate or delay commitments for better pricing.
                </span>
              </div>
            )}
            {trendAnalysis.direction === 'STABLE' && (
              <div className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-600">ℹ️</span>
                <span>
                  Market rates are stable. Focus on supplier performance and service quality differentiation.
                </span>
              </div>
            )}
            {trendAnalysis.confidence < 0.5 && (
              <div className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-orange-600">⚠️</span>
                <span>
                  Limited historical data available. Trend analysis should be validated with additional market research.
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
