'use client';

export const dynamic = 'force-dynamic'

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataModeToggle } from '@/components/analytics/DataModeToggle';
import { useSupplierAnalytics, type DataMode } from '@/hooks/useProcurementIntelligence';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { Breadcrumbs } from '@/components/analytics/Breadcrumbs';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Clock,
  Star,
  Building,
  Globe,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

export default function SupplierAnalyticsPage() {
  const [mode, setMode] = useState<DataMode>('real');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [timeframe, setTimeframe] = useState<string>('12months');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { 
    data, 
    loading, 
    error, 
    metadata,
    refetch 
  } = useSupplierAnalytics({
    supplierId: selectedSupplier || undefined,
    timeframe,
    metrics: ['deliveryScore', 'qualityScore', 'costEfficiency', 'riskScore']
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
        ['Supplier', 'Category', 'Performance Score', 'Quality Score', 'Delivery Score', 'Cost Efficiency', 'Risk Level', 'Total Spend'].join(','),
        ...(data.suppliers || []).map((s: any) => [
          s.name || 'Unknown',
          s.category || 'N/A',
          s.performanceScore || 0,
          s.qualityScore || 0,
          s.deliveryScore || 0,
          s.costEfficiency || 0,
          s.riskLevel || 'N/A',
          s.totalSpend || 0
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `supplier-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Supplier analytics exported successfully');
    } catch (_error) {
      toast.error('Failed to export data');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-violet-50/20">
      <div className="container mx-auto py-8 space-y-6">
        <Breadcrumbs />
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-green-500/25">
                <Users className="w-7 h-7 text-white" />
              </div>
              Supplier Analytics
            </h1>
            <p className="text-slate-600 mt-2">
              Comprehensive supplier performance and relationship analytics
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
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-slate-700">Search Suppliers</label>
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-slate-700">Supplier ID</label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Suppliers</SelectItem>
                    {(data?.suppliers || []).map((s: any) => (
                      <SelectItem key={s.id || s.name} value={s.id || s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Timeframe</label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="12months">Last 12 Months</SelectItem>
                  <SelectItem value="24months">Last 24 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Error loading supplier analytics: {error instanceof Error ? error.message : String(error)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Display */}
      {data && !loading && (
        <>
          {/* Performance Overview */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="group relative overflow-hidden bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl hover:shadow-violet-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                <CardTitle className="text-sm font-medium">Delivery Score</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">{data.performance.deliveryScore}%</div>
                <div className="flex items-center mt-2">
                  <div className={`h-2 bg-slate-100 rounded-full flex-1 overflow-hidden`}>
                    <div 
                      className={`h-full ${
                        data.performance.deliveryScore >= 80 ? 'bg-gradient-to-r from-violet-400 to-violet-500' :
                        data.performance.deliveryScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                      }`}
                      style={{ width: `${data.performance.deliveryScore}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl hover:shadow-amber-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Star className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">{data.performance.qualityScore}%</div>
                <div className="flex items-center mt-2">
                  <div className={`h-2 bg-slate-100 rounded-full flex-1 overflow-hidden`}>
                    <div 
                      className={`h-full ${
                        data.performance.qualityScore >= 80 ? 'bg-gradient-to-r from-violet-400 to-violet-500' :
                        data.performance.qualityScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                      }`}
                      style={{ width: `${data.performance.qualityScore}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl hover:shadow-green-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                <CardTitle className="text-sm font-medium">Cost Efficiency</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">{data.performance.costEfficiency}%</div>
                <div className="flex items-center mt-2">
                  <div className={`h-2 bg-slate-100 rounded-full flex-1 overflow-hidden`}>
                    <div 
                      className={`h-full ${
                        data.performance.costEfficiency >= 80 ? 'bg-gradient-to-r from-violet-400 to-violet-500' :
                        data.performance.costEfficiency >= 60 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                      }`}
                      style={{ width: `${data.performance.costEfficiency}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl hover:shadow-rose-200/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
                <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform duration-300">
                  <AlertCircle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold">{data.performance.riskScore}%</div>
                <div className="flex items-center mt-2">
                  <div className={`h-2 bg-slate-100 rounded-full flex-1 overflow-hidden`}>
                    <div 
                      className={`h-full ${
                        data.performance.riskScore <= 20 ? 'bg-gradient-to-r from-violet-400 to-violet-500' :
                        data.performance.riskScore <= 50 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                      }`}
                      style={{ width: `${data.performance.riskScore}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Financial Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Financial Health
                </CardTitle>
                <CardDescription>
                  Financial stability and creditworthiness metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Credit Rating</span>
                  <Badge variant={
                    data.financialHealth.creditRating.startsWith('A') ? 'default' :
                    data.financialHealth.creditRating.startsWith('B') ? 'secondary' : 'destructive'
                  }>
                    {data.financialHealth.creditRating}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Annual Revenue</span>
                  <span className="font-bold">
                    ${(data.financialHealth.revenue / 1000000).toFixed(1)}M
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Profit Margin</span>
                  <span className={`font-bold ${
                    data.financialHealth.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(data.financialHealth.profitMargin * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Debt Ratio</span>
                  <span className={`font-bold ${
                    data.financialHealth.debtRatio <= 0.3 ? 'text-green-600' :
                    data.financialHealth.debtRatio <= 0.6 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {(data.financialHealth.debtRatio * 100).toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Relationship Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Relationship Metrics
                </CardTitle>
                <CardDescription>
                  Contract portfolio and partnership metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Active Contracts</span>
                  <span className="font-bold">{data.relationships.contractCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Value</span>
                  <span className="font-bold">
                    ${(data.relationships.totalValue / 1000000).toFixed(1)}M
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Avg Contract Length</span>
                  <span className="font-bold">{data.relationships.averageContractLength} months</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Renewal Rate</span>
                  <span className={`font-bold ${
                    data.relationships.renewalRate >= 0.8 ? 'text-green-600' :
                    data.relationships.renewalRate >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {(data.relationships.renewalRate * 100).toFixed(0)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Performance Trends
              </CardTitle>
              <CardDescription>
                Historical performance metrics over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.trends.map((trend: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">{trend.metric}</h4>
                      <Badge variant="outline">
                        {trend.values.length} data points
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {trend.values.slice(-6).map((point: any, idx: number) => (
                        <div key={idx} className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">
                            {point.period}
                          </div>
                          <div className="text-sm font-medium">
                            {point.value.toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </div>
  );
}
