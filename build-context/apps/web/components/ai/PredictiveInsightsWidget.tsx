'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Loader2,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  PieChart,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface RenewalPrediction {
  contractId: string;
  contractName: string;
  probability: number;
  confidence: number;
  factors: Array<{ factor: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }>;
  recommendedAction: string;
  predictedDate: string | null;
}

interface CostForecast {
  currentSpend: number;
  projectedSpend: number;
  savingsOpportunities: Array<{ area: string; potentialSavings: number; difficulty: string; description: string }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

interface PortfolioHealth {
  overallScore: number;
  dimensions: Array<{ name: string; score: number; trend: 'up' | 'down' | 'stable' }>;
  riskConcentration: Array<{ category: string; percentage: number; riskLevel: string }>;
  recommendations: string[];
  trajectory: 'improving' | 'declining' | 'stable';
}

interface PredictiveInsightsWidgetProps {
  contractId?: string;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up': case 'increasing': case 'improving':
      return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
    case 'down': case 'decreasing': case 'declining':
      return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
    default:
      return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  }
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function RenewalTab({ contractId }: { contractId?: string }) {
  const { data, isLoading, refetch } = useQuery<RenewalPrediction | null>({
    queryKey: ['prediction', 'renewal', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const res = await fetch('/api/analytics/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ type: 'renewal', contractId }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.prediction || null;
    },
    enabled: !!contractId,
    staleTime: 120_000,
  });

  if (!contractId) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        Select a contract to see renewal predictions
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
        <span className="text-sm text-slate-500">Predicting renewal likelihood...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        No prediction data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Probability gauge */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className={cn("text-3xl font-bold", getScoreColor(data.probability))}>
            {data.probability}%
          </div>
          <p className="text-xs text-slate-500 mt-1">Renewal Probability</p>
        </div>
        <div className="flex-1">
          <Progress value={data.probability} className="h-3" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-400">Unlikely</span>
            <span className="text-[10px] text-slate-400">Certain</span>
          </div>
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Key Factors</h4>
        {data.factors?.slice(0, 5).map((f, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
            {f.impact === 'positive' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : f.impact === 'negative' ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            )}
            <span className="text-xs text-slate-700 flex-1">{f.factor}</span>
            <Badge variant="secondary" className="text-[10px]">{(f.weight * 100).toFixed(0)}%</Badge>
          </div>
        ))}
      </div>

      {/* Recommended action */}
      {data.recommendedAction && (
        <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 mt-0.5 shrink-0" />
            <p className="text-xs text-violet-800">{data.recommendedAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CostTab() {
  const { data, isLoading } = useQuery<CostForecast | null>({
    queryKey: ['prediction', 'cost_forecast'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ type: 'cost_forecast' }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.forecast || null;
    },
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
        <span className="text-sm text-slate-500">Forecasting costs...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="py-8 text-center text-sm text-slate-500">No forecast data available</div>;
  }

  const diff = data.projectedSpend - data.currentSpend;
  const diffPct = data.currentSpend > 0 ? ((diff / data.currentSpend) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-100 p-3">
          <p className="text-xs text-slate-500 mb-1">Current Spend</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(data.currentSpend)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 p-3">
          <p className="text-xs text-slate-500 mb-1">Projected Spend</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-slate-900">{formatCurrency(data.projectedSpend)}</p>
            <span className={cn("text-xs font-medium", diff > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {diff > 0 ? '+' : ''}{diffPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Savings Opportunities */}
      {data.savingsOpportunities?.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Savings Opportunities</h4>
          {data.savingsOpportunities.map((s, i) => (
            <div key={i} className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-900">{s.area}</span>
                <span className="text-xs font-bold text-emerald-700">{formatCurrency(s.potentialSavings)}</span>
              </div>
              <p className="text-[11px] text-slate-600">{s.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioTab() {
  const { data, isLoading } = useQuery<PortfolioHealth | null>({
    queryKey: ['prediction', 'portfolio_health'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ type: 'portfolio_health' }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.health || null;
    },
    staleTime: 300_000,
  });

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
        <span className="text-sm text-slate-500">Analyzing portfolio health...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="py-8 text-center text-sm text-slate-500">No portfolio data available</div>;
  }

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={cn("text-3xl font-bold", getScoreColor(data.overallScore))}>
            {data.overallScore}
          </div>
          <p className="text-xs text-slate-500 mt-1">Health Score</p>
        </div>
        <div className="flex items-center gap-1.5">
          {getTrendIcon(data.trajectory)}
          <span className="text-xs text-slate-600 capitalize">{data.trajectory}</span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Dimensions</h4>
        {data.dimensions?.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-slate-700 w-28 shrink-0">{d.name}</span>
            <Progress value={d.score} className="h-2 flex-1" />
            <div className="flex items-center gap-1 w-14 justify-end">
              <span className={cn("text-xs font-medium", getScoreColor(d.score))}>{d.score}</span>
              {getTrendIcon(d.trend)}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 space-y-1.5">
          <h4 className="text-xs font-medium text-violet-800">AI Recommendations</h4>
          {data.recommendations.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <Sparkles className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
              <p className="text-xs text-violet-700">{r}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PredictiveInsightsWidget({ contractId, className }: PredictiveInsightsWidgetProps) {
  const [tab, setTab] = useState(contractId ? 'renewal' : 'portfolio');

  return (
    <Card className={cn("border-slate-200", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
            <BarChart3 className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm">Predictive Insights</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered predictions & forecasts</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-slate-100/80 p-1 h-auto rounded-lg">
            {contractId && (
              <TabsTrigger value="renewal" className="text-xs py-1.5 rounded-md flex-1">
                <Calendar className="h-3 w-3 mr-1.5" />
                Renewal
              </TabsTrigger>
            )}
            <TabsTrigger value="cost" className="text-xs py-1.5 rounded-md flex-1">
              <DollarSign className="h-3 w-3 mr-1.5" />
              Cost
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="text-xs py-1.5 rounded-md flex-1">
              <PieChart className="h-3 w-3 mr-1.5" />
              Portfolio
            </TabsTrigger>
          </TabsList>
          {contractId && (
            <TabsContent value="renewal" className="mt-4">
              <RenewalTab contractId={contractId} />
            </TabsContent>
          )}
          <TabsContent value="cost" className="mt-4">
            <CostTab />
          </TabsContent>
          <TabsContent value="portfolio" className="mt-4">
            <PortfolioTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
