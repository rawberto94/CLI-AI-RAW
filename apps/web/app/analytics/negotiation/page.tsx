'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataModeToggle } from '@/components/analytics/DataModeToggle';
import { useNegotiationPrep, type DataMode } from '@/hooks/useProcurementIntelligence';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { Breadcrumbs } from '@/components/analytics/Breadcrumbs';
import { motion } from 'framer-motion';
import {
  Handshake,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Download,
  Filter,
  Lightbulb,
  Award
} from 'lucide-react';
import { toast } from 'sonner';

export default function NegotiationPrepPage() {
  const [mode, setMode] = useState<DataMode>('real');
  const [contractId, setContractId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  const { 
    data, 
    loading, 
    error, 
    metadata,
    refetch 
  } = useNegotiationPrep({
    contractId: contractId || undefined,
    supplierId: supplierId || undefined,
    category: category || undefined
  }, mode);

  const handleRefresh = () => {
    refetch();
  };

  const handleExport = () => {
    if (!data) {
      toast.error('No data to export');
      return;
    }
    try {
      const csvContent = [
        ['Contract/Supplier', 'Leverage Point', 'Impact', 'Trend', 'Recommendation', 'Potential Savings'].join(','),
        ...(data.leveragePoints || []).map((l: any) => [
          l.contractName || l.supplier || 'Unknown',
          l.leveragePoint || 'N/A',
          l.impact || 'N/A',
          l.trend || 'N/A',
          l.recommendation || 'N/A',
          l.potentialSavings || 0
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `negotiation-prep-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Negotiation data exported successfully');
    } catch (_error) {
      toast.error('Failed to export data');
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'low':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      <div className="max-w-[1600px] mx-auto py-8 space-y-6">
        <Breadcrumbs />
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl shadow-lg shadow-violet-500/25">
                <Handshake className="w-7 h-7 text-white" />
              </div>
              Negotiation Preparation
            </h1>
            <p className="text-slate-600 mt-2">
              Strategic insights and leverage points for successful negotiations
            </p>
            {metadata && (
              <p className="text-xs text-slate-500 mt-1">
                Data source: {metadata.source} • Last updated: {new Date(metadata.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <DataModeToggle currentMode={mode} onModeChange={(newMode) => setMode(newMode as 'real' | 'mock')} />
            <Button variant="outline" onClick={handleRefresh} className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExport}
              className="bg-white/80 backdrop-blur-sm border-white/50 hover:bg-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 rounded-lg">
                  <Filter className="w-4 h-4 text-slate-600" />
                </div>
                Negotiation Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-700">Contract ID</label>
                  <Input
                    placeholder="Enter contract ID..."
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-700">Supplier</label>
                  <Input
                    placeholder="Enter supplier ID..."
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-700">Category</label>
                  <Input
                    placeholder="Enter category..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-white"
                  />
            </div>
            <div className="flex items-end">
              <Button className="w-full">
                Generate Prep
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
        </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>
                Error loading negotiation prep data:{' '}
                {error instanceof Error ? error.message : String(error)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Display */}
      {data && !loading && (
        <>
          {/* Market Position Overview */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Supplier Rank</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  #{data.marketPosition.supplierRank}
                </div>
                <p className="text-xs text-muted-foreground">
                  out of {data.marketPosition.totalSuppliers} suppliers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Market Share</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.marketPosition.marketShare.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  of total market
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leverage Points</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.leveragePoints.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  identified opportunities
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Leverage Points */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Leverage Points
                </CardTitle>
                <CardDescription>
                  Strategic advantages and negotiation opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.leveragePoints.map((point: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{point.type}</h4>
                        <Badge 
                          variant="outline" 
                          className={getImpactColor(point.impact)}
                        >
                          {point.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {point.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Historical Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Historical Performance
                </CardTitle>
                <CardDescription>
                  Performance vs benchmarks and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.historicalPerformance.map((metric: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{metric.metric}</div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Current: {metric.current}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Benchmark: {metric.benchmark}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(metric.trend)}
                        <span className="text-xs font-medium capitalize">
                          {metric.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>
                Actionable negotiation strategies with expected savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {data.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium">{rec.action}</h4>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          ${(rec.expectedSavings / 1000).toFixed(0)}K
                        </div>
                        <div className="text-xs text-muted-foreground">
                          potential savings
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {rec.rationale}
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium">Ready to implement</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Savings Summary */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-900">Total Potential Savings</h4>
                    <p className="text-sm text-green-700">
                      Combined impact of all recommendations
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-900">
                      ${(data.recommendations.reduce((sum: number, rec: any) => sum + rec.expectedSavings, 0) / 1000).toFixed(0)}K
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </div>
  );
}
