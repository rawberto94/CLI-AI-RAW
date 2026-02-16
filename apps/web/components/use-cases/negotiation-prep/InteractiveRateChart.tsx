/**
 * Interactive Rate Chart Component
 * Visualizes rate comparisons with interactive features
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  BarChart3,
  Filter,
  Download,
} from 'lucide-react';

export interface RateDataPoint {
  id: string;
  role: string;
  supplier: string;
  rate: number;
  marketRate?: number;
  previousRate?: number;
  level?: string;
  region?: string;
}

export interface InteractiveRateChartProps {
  data?: RateDataPoint[];
  className?: string;
  title?: string;
  onRateClick?: (rate: RateDataPoint) => void;
}

export function InteractiveRateChart({ 
  data = [], 
  className,
  title = 'Rate Comparison',
  onRateClick 
}: InteractiveRateChartProps) {
  const [sortBy, setSortBy] = useState<'rate' | 'variance'>('rate');
  const [highlightAboveMarket, setHighlightAboveMarket] = useState(true);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === 'variance') {
        const varA = a.marketRate ? ((a.rate - a.marketRate) / a.marketRate) * 100 : 0;
        const varB = b.marketRate ? ((b.rate - b.marketRate) / b.marketRate) * 100 : 0;
        return varB - varA;
      }
      return b.rate - a.rate;
    });
  }, [data, sortBy]);

  const maxRate = useMemo(() => Math.max(...data.map(d => d.rate), 1), [data]);

  const stats = useMemo(() => {
    if (data.length === 0) return { avg: 0, aboveMarket: 0, belowMarket: 0 };
    const avg = data.reduce((sum, d) => sum + d.rate, 0) / data.length;
    const aboveMarket = data.filter(d => d.marketRate && d.rate > d.marketRate).length;
    const belowMarket = data.filter(d => d.marketRate && d.rate < d.marketRate).length;
    return { avg, aboveMarket, belowMarket };
  }, [data]);

  const getVariance = (rate: RateDataPoint) => {
    if (!rate.marketRate) return null;
    return ((rate.rate - rate.marketRate) / rate.marketRate) * 100;
  };

  const getTrend = (rate: RateDataPoint) => {
    if (!rate.previousRate) return null;
    const change = ((rate.rate - rate.previousRate) / rate.previousRate) * 100;
    return change;
  };

  if (data.length === 0) {
    return (
      <Card className={cn('bg-white', className)}>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No rate data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-white', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(sortBy === 'rate' ? 'variance' : 'rate')}
              className="h-8 text-xs"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              Sort by {sortBy === 'rate' ? 'Variance' : 'Rate'}
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <span className="text-slate-600">Avg: ${stats.avg.toFixed(0)}</span>
          </div>
          {stats.aboveMarket > 0 && (
            <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50">
              <TrendingUp className="h-3 w-3 mr-1" />
              {stats.aboveMarket} above market
            </Badge>
          )}
          {stats.belowMarket > 0 && (
            <Badge variant="outline" className="text-violet-600 border-violet-200 bg-violet-50">
              <TrendingDown className="h-3 w-3 mr-1" />
              {stats.belowMarket} below market
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {sortedData.map((rate) => {
            const variance = getVariance(rate);
            const trend = getTrend(rate);
            const barWidth = (rate.rate / maxRate) * 100;
            const isAboveMarket = variance !== null && variance > 0;

            return (
              <div
                key={rate.id}
                className={cn(
                  'relative p-3 rounded-lg border transition-all cursor-pointer hover:border-violet-300 hover:shadow-sm',
                  highlightAboveMarket && isAboveMarket
                    ? 'border-rose-200 bg-rose-50/50'
                    : 'border-slate-200 bg-slate-50/50'
                )}
                onClick={() => onRateClick?.(rate)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-slate-900">{rate.role}</p>
                    <p className="text-xs text-slate-500">
                      {rate.supplier}
                      {rate.level && ` • ${rate.level}`}
                      {rate.region && ` • ${rate.region}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-slate-900">
                      ${rate.rate.toLocaleString()}
                    </p>
                    {rate.marketRate && (
                      <p className="text-xs text-slate-500">
                        Market: ${rate.marketRate.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bar visualization */}
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isAboveMarket ? 'bg-rose-500' : 'bg-violet-500'
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Variance and trend indicators */}
                <div className="flex items-center gap-3 mt-2">
                  {variance !== null && (
                    <span className={cn(
                      'text-xs font-medium flex items-center gap-1',
                      variance > 0 ? 'text-rose-600' : variance < 0 ? 'text-violet-600' : 'text-slate-500'
                    )}>
                      {variance > 0 ? <TrendingUp className="h-3 w-3" /> : 
                       variance < 0 ? <TrendingDown className="h-3 w-3" /> : 
                       <Minus className="h-3 w-3" />}
                      {Math.abs(variance).toFixed(1)}% vs market
                    </span>
                  )}
                  {trend !== null && (
                    <span className={cn(
                      'text-xs flex items-center gap-1',
                      trend > 0 ? 'text-rose-500' : 'text-violet-500'
                    )}>
                      {trend > 0 ? '+' : ''}{trend.toFixed(1)}% YoY
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default InteractiveRateChart;
