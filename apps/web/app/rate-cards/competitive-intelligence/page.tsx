'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitivenessGauge } from '@/components/rate-cards/CompetitivenessGauge';
import { MarketPositionChart } from '@/components/rate-cards/MarketPositionChart';
import { TopOpportunitiesTable } from '@/components/rate-cards/TopOpportunitiesTable';
import { AtRiskRatesAlert } from '@/components/rate-cards/AtRiskRatesAlert';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const fetchCompetitiveMetrics = async () => {
  const response = await fetch('/api/rate-cards/competitive-intelligence?tenantId=default-tenant');
  if (!response.ok) throw new Error('Failed to load competitive intelligence');
  return response.json();
};

export default function CompetitiveIntelligencePage() {
  const { 
    data: metrics, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['competitive-intelligence'],
    queryFn: fetchCompetitiveMetrics,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 blur-2xl rounded-full" />
            <div className="relative p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          </div>
          <p className="text-slate-600">Loading competitive intelligence...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/20 p-8">
        <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
          <CardContent className="pt-6">
            <p className="text-center text-slate-500">
              Failed to load competitive intelligence data
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (metrics.trends.direction === 'improving') {
      return <TrendingUp className="h-5 w-5 text-violet-500" />;
    } else if (metrics.trends.direction === 'declining') {
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    }
    return <Minus className="h-5 w-5 text-slate-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="p-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            <Target className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Competitive Intelligence Dashboard
            </h1>
            <p className="text-slate-600 mt-1">
              Monitor your market position and identify opportunities for improvement
            </p>
          </div>
        </motion.div>

        {/* Overall Score and Market Position */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CompetitivenessGauge
              score={metrics.overallScore}
              ranking={metrics.marketPosition.ranking}
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg h-full">
              <CardHeader>
                <CardTitle>Market Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Percentile Rank</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {metrics.marketPosition.percentile}th
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${metrics.marketPosition.percentile}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 h-2.5 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-sm text-slate-500">Trend</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon()}
                      <span className="font-medium capitalize">{metrics.trends.direction}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg shadow-md">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm font-medium text-slate-700">Price Competitiveness</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  {Math.round(metrics.priceCompetitiveness.score)}%
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  {metrics.priceCompetitiveness.competitiveRatesCount} of{' '}
                  {metrics.priceCompetitiveness.totalRatesCount} rates competitive
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Avg {metrics.priceCompetitiveness.avgRateVsMarket > 0 ? '+' : ''}
                  {metrics.priceCompetitiveness.avgRateVsMarket.toFixed(1)}% vs market
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg shadow-md">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm font-medium text-slate-700">Coverage</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Roles</span>
                    <span className="font-semibold text-slate-700">{metrics.coverageAnalysis.rolesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Geographies</span>
                    <span className="font-semibold text-slate-700">{metrics.coverageAnalysis.geographiesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Suppliers</span>
                    <span className="font-semibold text-slate-700">{metrics.coverageAnalysis.suppliersCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg shadow-md">
                    <TrendingDown className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-sm font-medium text-slate-700">At-Risk Rates</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                  {metrics.atRiskRates.length}
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Rates requiring immediate attention
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

      {/* Market Position Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <MarketPositionChart metrics={metrics} />
      </motion.div>

      {/* Top Opportunities */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <TopOpportunitiesTable opportunities={metrics.topOpportunities} />
      </motion.div>

      {/* At-Risk Rates */}
      {metrics.atRiskRates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <AtRiskRatesAlert atRiskRates={metrics.atRiskRates} />
        </motion.div>
      )}

      {/* Gap Areas */}
      {metrics.coverageAnalysis.gapAreas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Coverage Gaps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {metrics.coverageAnalysis.gapAreas.map((gap: string, index: number) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
                    {gap}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}
      </div>
    </div>
  );
}
