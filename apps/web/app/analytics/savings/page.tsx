'use client';

export const dynamic = 'force-dynamic'

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataModeToggle } from '@/components/analytics/DataModeToggle';
import { useSavingsPipeline, type DataMode } from '@/hooks/useProcurementIntelligence';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { Breadcrumbs } from '@/components/analytics/Breadcrumbs';
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
  RefreshCw,
  Download,
  Filter,
  PieChart,
  BarChart3
} from 'lucide-react';

export default function SavingsPipelinePage() {
  const [mode, setMode] = useState<DataMode>('real');
  const [timeframe, setTimeframe] = useState<string>('12months');
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const { 
    data, 
    loading, 
    error, 
    metadata,
    refetch 
  } = useSavingsPipeline({
    timeframe,
    category: category || undefined,
    status: status || undefined
  }, mode);

  const handleRefresh = () => {
    refetch();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'realized':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'identified':
        return 'bg-yellow-500';
      case 'closed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Breadcrumbs />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            Savings Pipeline
          </h1>
          <p className="text-gray-600 mt-2">
            Track and manage cost savings opportunities across your procurement portfolio
          </p>
          {metadata && (
            <p className="text-xs text-gray-500 mt-1">
              Data source: {metadata.source} • Last updated: {new Date(metadata.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <DataModeToggle currentMode={mode} onModeChange={(newMode) => setMode(newMode as 'real' | 'mock')} />
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  <SelectItem value="Rate Optimization">Rate Optimization</SelectItem>
                  <SelectItem value="Contract Consolidation">Contract Consolidation</SelectItem>
                  <SelectItem value="Volume Discounts">Volume Discounts</SelectItem>
                  <SelectItem value="Process Improvement">Process Improvement</SelectItem>
                  <SelectItem value="Supplier Rationalization">Supplier Rationalization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="realized">Realized</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
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
              <span>Error loading savings pipeline: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Display */}
      {data && !loading && (
        <>
          {/* Pipeline Overview */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(data.pipeline.total / 1000000).toFixed(2)}M
                </div>
                <p className="text-xs text-muted-foreground">
                  Weighted by probability
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Identified</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((data.pipeline.byStatus.identified || 0) / 1000000).toFixed(2)}M
                </div>
                <p className="text-xs text-muted-foreground">
                  Opportunities found
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((data.pipeline.byStatus.in_progress || 0) / 1000000).toFixed(2)}M
                </div>
                <p className="text-xs text-muted-foreground">
                  Being pursued
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Realized</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${((data.pipeline.byStatus.realized || 0) / 1000000).toFixed(2)}M
                </div>
                <p className="text-xs text-muted-foreground">
                  Savings achieved
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Opportunities List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Savings Opportunities
              </CardTitle>
              <CardDescription>
                All identified and tracked savings opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.opportunities.map((opp: any) => (
                  <div key={opp.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{opp.title}</h4>
                          <Badge variant="outline">{opp.category}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>ID: {opp.id}</span>
                          <span>•</span>
                          <span>{opp.timeToRealize} months to realize</span>
                          <span>•</span>
                          <span>{(opp.probability * 100).toFixed(0)}% probability</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold text-green-600">
                          ${(opp.potentialSavings / 1000).toFixed(0)}K
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(opp.status)}`} />
                          <span className="text-xs font-medium">
                            {getStatusLabel(opp.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Savings by Category
              </CardTitle>
              <CardDescription>
                Distribution of savings opportunities across categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.pipeline.byCategory).map(([category, value]: [string, any]) => {
                  const percentage = (value / data.pipeline.total) * 100;
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{category}</span>
                        <span className="text-sm font-bold">
                          ${(value / 1000).toFixed(0)}K ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Pipeline Trends
              </CardTitle>
              <CardDescription>
                Historical view of identified vs realized savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.trends.slice(-6).map((trend: any, index: number) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-muted-foreground">
                      {trend.period}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Identified:</span>
                        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500 flex items-center justify-end pr-2"
                            style={{ width: `${(trend.identified / ((data.trends[data.trends.length - 1] as { identified: number } | undefined)?.identified || 1)) * 100}%` }}
                          >
                            <span className="text-xs font-medium text-white">
                              ${(trend.identified / 1000000).toFixed(1)}M
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Realized:</span>
                        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                          <div 
                            className="h-full bg-green-500 flex items-center justify-end pr-2"
                            style={{ width: `${(trend.realized / ((data.trends[data.trends.length - 1] as { identified: number } | undefined)?.identified || 1)) * 100}%` }}
                          >
                            <span className="text-xs font-medium text-white">
                              ${(trend.realized / 1000000).toFixed(1)}M
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
