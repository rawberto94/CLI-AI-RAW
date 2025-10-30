'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ForecastIndicator } from './ForecastIndicator';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface ForecastPrediction {
  rate: number;
  confidence: number;
  percentChange: number;
}

interface ForecastItem {
  id: string;
  rateCardId: string;
  rateCard: {
    id: string;
    role: string;
    currentRate: number;
    country: string;
    supplier: string;
    seniority?: string;
    lineOfService?: string;
  };
  currentRate: number;
  forecastDate: Date;
  predictions: {
    threeMonth: ForecastPrediction;
    sixMonth: ForecastPrediction;
    twelveMonth: ForecastPrediction;
  };
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendCoefficient: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  historicalDataPoints: number;
  createdAt: Date;
}

interface ForecastsListProps {
  forecasts: ForecastItem[];
  showFilters?: boolean;
  compact?: boolean;
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

function getRiskLevelColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'high':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

// ============================================================================
// Forecast Row Component
// ============================================================================

function ForecastRow({ forecast, compact }: { forecast: ForecastItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* Rate Card Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate mb-1">
              {forecast.rateCard.role}
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <span>{forecast.rateCard.supplier}</span>
              <span>•</span>
              <span>{forecast.rateCard.country}</span>
              {forecast.rateCard.seniority && (
                <>
                  <span>•</span>
                  <span>{forecast.rateCard.seniority}</span>
                </>
              )}
            </div>
          </div>

          {/* Current Rate */}
          <div className="text-right mx-4">
            <div className="text-sm text-gray-600">Current</div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(forecast.currentRate)}
            </div>
          </div>

          {/* 12-Month Forecast */}
          <div className="text-right mx-4">
            <div className="text-sm text-gray-600">12-Mo Forecast</div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(forecast.predictions.twelveMonth.rate)}
            </div>
          </div>

          {/* Forecast Indicator */}
          <div className="mx-4">
            <ForecastIndicator
              trendDirection={forecast.trendDirection}
              riskLevel={forecast.riskLevel}
              twelveMonthChange={forecast.predictions.twelveMonth.percentChange}
              confidence={forecast.confidence}
              compact={compact}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link href={`/rate-cards/entries?id=${forecast.rateCardId}`}>
              <Button variant="ghost" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 pt-4">
            {/* 3-Month Forecast */}
            <div className="p-3 bg-white rounded border border-gray-200">
              <div className="text-xs text-gray-600 mb-2">3-Month Forecast</div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {formatCurrency(forecast.predictions.threeMonth.rate)}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${
                  forecast.predictions.threeMonth.percentChange > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {forecast.predictions.threeMonth.percentChange > 0 ? '+' : ''}
                  {forecast.predictions.threeMonth.percentChange.toFixed(1)}%
                </span>
                <span className="text-gray-500">
                  {forecast.predictions.threeMonth.confidence.toFixed(0)}% conf.
                </span>
              </div>
            </div>

            {/* 6-Month Forecast */}
            <div className="p-3 bg-white rounded border border-gray-200">
              <div className="text-xs text-gray-600 mb-2">6-Month Forecast</div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {formatCurrency(forecast.predictions.sixMonth.rate)}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${
                  forecast.predictions.sixMonth.percentChange > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {forecast.predictions.sixMonth.percentChange > 0 ? '+' : ''}
                  {forecast.predictions.sixMonth.percentChange.toFixed(1)}%
                </span>
                <span className="text-gray-500">
                  {forecast.predictions.sixMonth.confidence.toFixed(0)}% conf.
                </span>
              </div>
            </div>

            {/* 12-Month Forecast */}
            <div className="p-3 bg-white rounded border border-gray-200">
              <div className="text-xs text-gray-600 mb-2">12-Month Forecast</div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {formatCurrency(forecast.predictions.twelveMonth.rate)}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${
                  forecast.predictions.twelveMonth.percentChange > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {forecast.predictions.twelveMonth.percentChange > 0 ? '+' : ''}
                  {forecast.predictions.twelveMonth.percentChange.toFixed(1)}%
                </span>
                <span className="text-gray-500">
                  {forecast.predictions.twelveMonth.confidence.toFixed(0)}% conf.
                </span>
              </div>
            </div>
          </div>

          {/* Additional Metadata */}
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-600">Trend Coefficient</div>
              <div className="text-sm font-medium text-gray-900">
                {forecast.trendCoefficient.toFixed(3)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Data Points</div>
              <div className="text-sm font-medium text-gray-900">
                {forecast.historicalDataPoints}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Forecast Date</div>
              <div className="text-sm font-medium text-gray-900">
                {new Date(forecast.forecastDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Overall Confidence</div>
              <div className="text-sm font-medium text-gray-900">
                {forecast.confidence.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Forecasts List Component
// ============================================================================

export function ForecastsList({ 
  forecasts, 
  showFilters = false,
  compact = false 
}: ForecastsListProps) {
  const [sortBy, setSortBy] = useState<'risk' | 'change' | 'confidence'>('risk');
  const [filterRisk, setFilterRisk] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Apply filters and sorting
  let filteredForecasts = [...forecasts];

  if (filterRisk !== 'all') {
    filteredForecasts = filteredForecasts.filter(f => f.riskLevel === filterRisk);
  }

  filteredForecasts.sort((a, b) => {
    switch (sortBy) {
      case 'risk':
        const riskOrder = { high: 3, medium: 2, low: 1 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      case 'change':
        return Math.abs(b.predictions.twelveMonth.percentChange) - Math.abs(a.predictions.twelveMonth.percentChange);
      case 'confidence':
        return b.confidence - a.confidence;
      default:
        return 0;
    }
  });

  if (forecasts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            No forecasts available. Generate forecasts to see predictions.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <div className="flex gap-1">
                  <Button
                    variant={sortBy === 'risk' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy('risk')}
                  >
                    Risk Level
                  </Button>
                  <Button
                    variant={sortBy === 'change' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy('change')}
                  >
                    Change %
                  </Button>
                  <Button
                    variant={sortBy === 'confidence' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy('confidence')}
                  >
                    Confidence
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Filter:</span>
                <div className="flex gap-1">
                  <Button
                    variant={filterRisk === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRisk('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterRisk === 'high' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRisk('high')}
                  >
                    High Risk
                  </Button>
                  <Button
                    variant={filterRisk === 'medium' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRisk('medium')}
                  >
                    Medium Risk
                  </Button>
                  <Button
                    variant={filterRisk === 'low' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterRisk('low')}
                  >
                    Low Risk
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-gray-600">Total Forecasts</div>
            <div className="text-2xl font-bold text-gray-900">{filteredForecasts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-gray-600">High Risk</div>
            <div className="text-2xl font-bold text-red-600">
              {filteredForecasts.filter(f => f.riskLevel === 'high').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-gray-600">Avg Change (12-Mo)</div>
            <div className="text-2xl font-bold text-gray-900">
              {(filteredForecasts.reduce((sum, f) => sum + f.predictions.twelveMonth.percentChange, 0) / filteredForecasts.length).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-gray-600">Avg Confidence</div>
            <div className="text-2xl font-bold text-gray-900">
              {(filteredForecasts.reduce((sum, f) => sum + f.confidence, 0) / filteredForecasts.length).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecasts List */}
      <div className="space-y-2">
        {filteredForecasts.map((forecast) => (
          <ForecastRow key={forecast.id} forecast={forecast} compact={compact} />
        ))}
      </div>
    </div>
  );
}
