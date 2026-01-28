/**
 * Market Intelligence Component
 * Displays market trends, benchmarks, and competitive insights
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Building2,
  Users,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface MarketTrend {
  category: string;
  currentRate: number;
  marketAverage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  confidence: number;
}

interface CompetitorInsight {
  name: string;
  rateRange: { min: number; max: number };
  marketShare: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MarketIntelligenceProps {
  className?: string;
  trends?: MarketTrend[];
  competitors?: CompetitorInsight[];
  region?: string;
  lastUpdated?: string;
}

const defaultTrends: MarketTrend[] = [
  { category: 'Software Development', currentRate: 175, marketAverage: 165, trend: 'up', trendPercent: 5.2, confidence: 85 },
  { category: 'Cloud Architecture', currentRate: 210, marketAverage: 225, trend: 'down', trendPercent: -3.1, confidence: 78 },
  { category: 'Data Engineering', currentRate: 185, marketAverage: 180, trend: 'stable', trendPercent: 0.5, confidence: 92 },
  { category: 'Project Management', currentRate: 145, marketAverage: 140, trend: 'up', trendPercent: 2.8, confidence: 88 },
];

const defaultCompetitors: CompetitorInsight[] = [
  { name: 'Accenture', rateRange: { min: 180, max: 320 }, marketShare: 22, trend: 'stable' },
  { name: 'Deloitte', rateRange: { min: 175, max: 310 }, marketShare: 18, trend: 'up' },
  { name: 'IBM', rateRange: { min: 165, max: 290 }, marketShare: 15, trend: 'down' },
  { name: 'Capgemini', rateRange: { min: 155, max: 270 }, marketShare: 12, trend: 'up' },
];

export function MarketIntelligence({ 
  className,
  trends = defaultTrends,
  competitors = defaultCompetitors,
  region = 'North America',
  lastUpdated = 'December 2024',
}: MarketIntelligenceProps) {
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-rose-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-violet-500" />;
      default: return <Minus className="h-4 w-4 text-slate-400" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'text-rose-600';
      case 'down': return 'text-violet-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-violet-500" />
            Market Intelligence
          </h3>
          <p className="text-sm text-slate-500">
            {region} • Updated {lastUpdated}
          </p>
        </div>
        <Badge variant="outline" className="bg-violet-50">
          <Zap className="h-3 w-3 mr-1" />
          AI-Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Trends */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Rate Trends by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trends.map((trend, index) => {
              const variance = ((trend.currentRate - trend.marketAverage) / trend.marketAverage) * 100;
              const isAboveMarket = variance > 0;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{trend.category}</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(trend.trend)}
                      <span className={cn('text-sm font-semibold', getTrendColor(trend.trend))}>
                        {trend.trendPercent > 0 ? '+' : ''}{trend.trendPercent}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>Your rate: ${trend.currentRate}</span>
                        <span>Market avg: ${trend.marketAverage}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            isAboveMarket ? 'bg-rose-400' : 'bg-violet-400'
                          )}
                          style={{ width: `${Math.min(100, (trend.currentRate / trend.marketAverage) * 50)}%` }}
                        />
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5',
                        isAboveMarket ? 'text-rose-600 border-rose-200' : 'text-violet-600 border-violet-200'
                      )}
                    >
                      {isAboveMarket ? '+' : ''}{variance.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    Confidence: {trend.confidence}%
                    {trend.confidence >= 85 ? (
                      <CheckCircle className="h-3 w-3 text-violet-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Competitor Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              Competitor Benchmarks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {competitors.map((competitor, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{competitor.name}</span>
                    {getTrendIcon(competitor.trend)}
                  </div>
                  <span className="text-sm text-slate-600">
                    ${competitor.rateRange.min} - ${competitor.rateRange.max}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Progress value={competitor.marketShare} className="h-2" />
                  </div>
                  <span className="text-xs text-slate-500 w-16 text-right">
                    {competitor.marketShare}% share
                  </span>
                </div>
              </div>
            ))}
            
            <div className="pt-3 border-t mt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Users className="h-4 w-4" />
                <span>Based on analysis of 2,500+ contracts</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MarketIntelligence;
