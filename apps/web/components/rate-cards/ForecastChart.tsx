'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

interface ForecastPrediction {
  rate: number;
  confidence: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  percentChange: number;
}

interface ForecastData {
  id: string;
  rateCardId: string;
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
  modelVersion: string;
  createdAt: Date;
}

interface ForecastChartProps {
  forecast: ForecastData;
  showConfidenceIntervals?: boolean;
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

function getTrendIcon(trendDirection: string) {
  switch (trendDirection) {
    case 'increasing':
      return <TrendingUp className="w-4 h-4 text-red-600" />;
    case 'decreasing':
      return <TrendingDown className="w-4 h-4 text-green-600" />;
    case 'stable':
      return <Minus className="w-4 h-4 text-gray-600" />;
    default:
      return null;
  }
}

// ============================================================================
// Chart Data Preparation
// ============================================================================

function prepareChartData(forecast: ForecastData) {
  const now = new Date(forecast.forecastDate);
  
  return [
    {
      month: 'Current',
      date: now,
      rate: forecast.currentRate,
      lower: forecast.currentRate,
      upper: forecast.currentRate,
      isActual: true,
    },
    {
      month: '3 Mo',
      date: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      rate: forecast.predictions.threeMonth.rate,
      lower: forecast.predictions.threeMonth.confidenceInterval.lower,
      upper: forecast.predictions.threeMonth.confidenceInterval.upper,
      confidence: forecast.predictions.threeMonth.confidence,
      isActual: false,
    },
    {
      month: '6 Mo',
      date: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      rate: forecast.predictions.sixMonth.rate,
      lower: forecast.predictions.sixMonth.confidenceInterval.lower,
      upper: forecast.predictions.sixMonth.confidenceInterval.upper,
      confidence: forecast.predictions.sixMonth.confidence,
      isActual: false,
    },
    {
      month: '12 Mo',
      date: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      rate: forecast.predictions.twelveMonth.rate,
      lower: forecast.predictions.twelveMonth.confidenceInterval.lower,
      upper: forecast.predictions.twelveMonth.confidenceInterval.upper,
      confidence: forecast.predictions.twelveMonth.confidence,
      isActual: false,
    },
  ];
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
      <div className="font-semibold text-gray-900 mb-2">{data.month}</div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Rate:</span>
          <span className="font-medium">{formatCurrency(data.rate)}</span>
        </div>
        {!data.isActual && (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Range:</span>
              <span className="font-medium text-xs">
                {formatCurrency(data.lower)} - {formatCurrency(data.upper)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Confidence:</span>
              <span className="font-medium">{data.confidence.toFixed(1)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Prediction Summary Component
// ============================================================================

function PredictionSummary({ 
  label, 
  prediction, 
  currentRate 
}: { 
  label: string; 
  prediction: ForecastPrediction;
  currentRate: number;
}) {
  const isIncrease = prediction.percentChange > 0;
  const isSignificant = Math.abs(prediction.percentChange) > 5;

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-xl font-bold text-gray-900">
          {formatCurrency(prediction.rate)}
        </div>
        <div className={`text-sm font-medium ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
          {isIncrease ? '+' : ''}{prediction.percentChange.toFixed(1)}%
        </div>
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Confidence:</span>
          <span className="font-medium">{prediction.confidence.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Range:</span>
          <span className="font-medium">
            {formatCurrency(prediction.confidenceInterval.lower)} - {formatCurrency(prediction.confidenceInterval.upper)}
          </span>
        </div>
      </div>
      {isSignificant && (
        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-700">
          <AlertTriangle className="w-3 h-3" />
          <span>Significant change expected</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Forecast Chart Component
// ============================================================================

export function ForecastChart({ 
  forecast, 
  showConfidenceIntervals = true,
  compact = false 
}: ForecastChartProps) {
  const chartData = prepareChartData(forecast);
  const isLowConfidence = forecast.confidence < 70 || forecast.historicalDataPoints < 6;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">Rate Forecast</CardTitle>
            {getTrendIcon(forecast.trendDirection)}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getRiskLevelColor(forecast.riskLevel)}>
              {forecast.riskLevel.toUpperCase()} RISK
            </Badge>
            <Badge variant="outline" className="text-xs">
              {forecast.confidence.toFixed(0)}% Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Low confidence warning */}
        {isLowConfidence && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Limited Historical Data:</strong> This forecast is based on {forecast.historicalDataPoints} data points. 
              Predictions may be less accurate. Consider gathering more historical data for improved forecasting.
            </div>
          </div>
        )}

        {/* Forecast Chart */}
        <div className="w-full" style={{ height: compact ? 250 : 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />
              
              {/* Confidence interval area */}
              {showConfidenceIntervals && (
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#93c5fd"
                  fillOpacity={0.2}
                  name="Confidence Interval"
                />
              )}
              {showConfidenceIntervals && (
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                />
              )}
              
              {/* Current rate reference line */}
              <ReferenceLine 
                y={forecast.currentRate} 
                stroke="#9ca3af" 
                strokeDasharray="3 3"
                label={{ value: 'Current', position: 'right', fill: '#6b7280', fontSize: 11 }}
              />
              
              {/* Predicted rate line */}
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ fill: '#2563eb', r: 5 }}
                activeDot={{ r: 7 }}
                name="Predicted Rate"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Prediction Summary Cards */}
        {!compact && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PredictionSummary 
              label="3-Month Forecast"
              prediction={forecast.predictions.threeMonth}
              currentRate={forecast.currentRate}
            />
            <PredictionSummary 
              label="6-Month Forecast"
              prediction={forecast.predictions.sixMonth}
              currentRate={forecast.currentRate}
            />
            <PredictionSummary 
              label="12-Month Forecast"
              prediction={forecast.predictions.twelveMonth}
              currentRate={forecast.currentRate}
            />
          </div>
        )}

        {/* Trend Analysis */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getTrendIcon(forecast.trendDirection)}
            </div>
            <div className="flex-1">
              <div className="font-medium text-blue-900 mb-1">Trend Analysis</div>
              <div className="text-sm text-blue-800">
                {forecast.trendDirection === 'increasing' && (
                  <>
                    This rate is showing an <strong>upward trend</strong> with a coefficient of {forecast.trendCoefficient.toFixed(3)}. 
                    Expected to increase by {forecast.predictions.twelveMonth.percentChange.toFixed(1)}% over the next 12 months.
                    {forecast.riskLevel === 'high' && ' Consider renegotiating or exploring alternative suppliers.'}
                  </>
                )}
                {forecast.trendDirection === 'decreasing' && (
                  <>
                    This rate is showing a <strong>downward trend</strong> with a coefficient of {forecast.trendCoefficient.toFixed(3)}. 
                    Expected to decrease by {Math.abs(forecast.predictions.twelveMonth.percentChange).toFixed(1)}% over the next 12 months.
                    This is a favorable market condition.
                  </>
                )}
                {forecast.trendDirection === 'stable' && (
                  <>
                    This rate is showing a <strong>stable trend</strong> with minimal variation. 
                    Expected to remain relatively flat over the next 12 months with less than 5% change.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Model Metadata */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Model Version</div>
              <div className="font-medium text-gray-900">{forecast.modelVersion}</div>
            </div>
            <div>
              <div className="text-gray-600">Data Points</div>
              <div className="font-medium text-gray-900">{forecast.historicalDataPoints}</div>
            </div>
            <div>
              <div className="text-gray-600">Forecast Date</div>
              <div className="font-medium text-gray-900">
                {new Date(forecast.forecastDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Overall Confidence</div>
              <div className="font-medium text-gray-900">{forecast.confidence.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
