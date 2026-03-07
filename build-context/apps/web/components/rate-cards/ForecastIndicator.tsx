'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

interface ForecastIndicatorProps {
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high';
  twelveMonthChange: number;
  confidence: number;
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

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

function getTrendIcon(trendDirection: string, size: string = 'w-4 h-4') {
  switch (trendDirection) {
    case 'increasing':
      return <TrendingUp className={`${size} text-red-600`} />;
    case 'decreasing':
      return <TrendingDown className={`${size} text-green-600`} />;
    case 'stable':
      return <Minus className={`${size} text-gray-600`} />;
    default:
      return null;
  }
}

function getTrendLabel(trendDirection: string): string {
  switch (trendDirection) {
    case 'increasing':
      return 'Increasing';
    case 'decreasing':
      return 'Decreasing';
    case 'stable':
      return 'Stable';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Forecast Indicator Component
// ============================================================================

export function ForecastIndicator({
  trendDirection,
  riskLevel,
  twelveMonthChange,
  confidence,
  compact = false,
}: ForecastIndicatorProps) {
  const isHighRisk = riskLevel === 'high';
  const isSignificantChange = Math.abs(twelveMonthChange) > 10;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {getTrendIcon(trendDirection, 'w-3 h-3')}
              {isHighRisk && <AlertTriangle className="w-3 h-3 text-red-600" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs space-y-1">
              <div><strong>Trend:</strong> {getTrendLabel(trendDirection)}</div>
              <div><strong>12-Mo Change:</strong> {twelveMonthChange > 0 ? '+' : ''}{twelveMonthChange.toFixed(1)}%</div>
              <div><strong>Risk:</strong> {riskLevel.toUpperCase()}</div>
              <div><strong>Confidence:</strong> {confidence.toFixed(0)}%</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Trend Icon and Change */}
      <div className="flex items-center gap-1">
        {getTrendIcon(trendDirection)}
        <span className={`text-sm font-medium ${
          twelveMonthChange > 0 ? 'text-red-600' : 
          twelveMonthChange < 0 ? 'text-green-600' : 
          'text-gray-600'
        }`}>
          {twelveMonthChange > 0 ? '+' : ''}{twelveMonthChange.toFixed(1)}%
        </span>
      </div>

      {/* Risk Badge */}
      <Badge className={`${getRiskLevelColor(riskLevel)} text-xs`}>
        {riskLevel.toUpperCase()}
      </Badge>

      {/* High Risk Warning */}
      {isHighRisk && isSignificantChange && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="w-4 h-4 text-red-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <strong>High Risk Alert:</strong> This rate is expected to increase significantly.
                Consider renegotiating or exploring alternatives.
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Confidence Indicator */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-gray-500 cursor-help">
              {confidence.toFixed(0)}% conf.
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              Forecast confidence level based on historical data quality and model accuracy.
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
