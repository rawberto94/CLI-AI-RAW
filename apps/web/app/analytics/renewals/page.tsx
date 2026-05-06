'use client';

export const dynamic = 'force-dynamic'

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataModeToggle } from '@/components/analytics/DataModeToggle';
import { useRenewalRadar, type DataMode } from '@/hooks/useProcurementIntelligence';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { Breadcrumbs } from '@/components/analytics/Breadcrumbs';
import { motion } from 'framer-motion';
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  AlertCircle,
  Bell,
  TrendingUp,
  RefreshCw,
  Download,
  Filter,
  FileText,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

export default function RenewalRadarPage() {
  const [mode, setMode] = useState<DataMode>('real');
  const [timeframe, setTimeframe] = useState<string>('12months');
  const [riskLevel, setRiskLevel] = useState<string>('');

  const { 
    data, 
    loading, 
    error, 
    metadata,
    refetch 
  } = useRenewalRadar({
    timeframe,
    riskLevel: riskLevel || undefined
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
        ['Contract', 'Supplier', 'Renewal Date', 'Days Until Renewal', 'Contract Value', 'Risk Level', 'Status', 'Action Required'].join(','),
        ...(data.upcomingRenewals || []).map((r: any) => [
          r.contractName || 'Unknown',
          r.supplier || 'N/A',
          r.renewalDate || 'N/A',
          r.daysUntilRenewal || 0,
          r.contractValue || 0,
          r.riskLevel || 'N/A',
          r.status || 'N/A',
          r.actionRequired || 'None'
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `renewal-radar-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Renewal data exported successfully');
    } catch (_error) {
      toast.error('Failed to export data');
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRiskBadgeVariant = (risk: string): "default" | "destructive" | "secondary" => {
    switch (risk) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntil = (date: Date) => {
    const days = Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20">
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
              <div className="p-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/25">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              Renewal Radar
            </h1>
            <p className="text-slate-600 mt-2">
              Track upcoming contract renewals and manage renewal processes
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block text-slate-700">Timeframe</label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3months">Next 3 Months</SelectItem>
                    <SelectItem value="6months">Next 6 Months</SelectItem>
                    <SelectItem value="12months">Next 12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-slate-700">Risk Level</label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All Risk Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Risk Levels</SelectItem>
                    <SelectItem value="high">High Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="low">Low Risk</SelectItem>
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
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Couldn’t load renewal radar</p>
                  <p className="text-sm text-rose-700 mt-1">{error instanceof Error ? error.message : String(error)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="flex-shrink-0">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Display */}
      {data && !loading && (
        <>
          {/* Risk Analysis Overview */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.riskAnalysis.totalContracts}
                </div>
                <p className="text-xs text-muted-foreground">
                  Upcoming renewals
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${(data.riskAnalysis.totalValue / 1000000).toFixed(1)}M
                </div>
                <p className="text-xs text-muted-foreground">
                  Contract value at risk
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Risk</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {data.riskAnalysis.riskDistribution.high || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Require immediate attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Action Items</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.actionItems.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending actions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Renewals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Renewals
              </CardTitle>
              <CardDescription>
                Contracts requiring renewal attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.upcomingRenewals.map((renewal: any) => {
                  const daysUntil = getDaysUntil(renewal.renewalDate);
                  return (
                    <div key={renewal.contractId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{renewal.supplier}</h4>
                            <Badge variant={getRiskBadgeVariant(renewal.riskLevel)}>
                              {renewal.riskLevel} risk
                            </Badge>
                            {renewal.autoRenewal && (
                              <Badge variant="outline" className="bg-orange-50">
                                Auto-Renewal
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Contract: {renewal.contractId}</span>
                            <span>•</span>
                            <span>Notice: {renewal.noticePeriod} days</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold">
                            ${(renewal.value / 1000000).toFixed(2)}M
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" />
                            <span className={`text-xs font-medium ${
                              daysUntil < 30 ? 'text-red-600' :
                              daysUntil < 90 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {daysUntil} days
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-sm text-muted-foreground">
                          Renewal Date: {formatDate(renewal.renewalDate)}
                        </span>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Action Items
              </CardTitle>
              <CardDescription>
                Required actions for upcoming renewals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.actionItems.map((action: any, index: number) => {
                  const daysUntilDue = getDaysUntil(action.dueDate);
                  return (
                    <div key={index} className="flex items-start gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getRiskColor(action.priority)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{action.action}</h4>
                          <Badge variant="outline" className={getPriorityColor(action.priority)}>
                            {action.priority} priority
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Contract: {action.contractId}</span>
                          <span>•</span>
                          <span>Due: {formatDate(action.dueDate)}</span>
                          <span>•</span>
                          <span className={
                            daysUntilDue < 7 ? 'text-red-600 font-medium' :
                            daysUntilDue < 30 ? 'text-yellow-600' : ''
                          }>
                            {daysUntilDue} days remaining
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Risk Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Risk Distribution
              </CardTitle>
              <CardDescription>
                Breakdown of contracts by risk level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.riskAnalysis.riskDistribution).map(([level, count]: [string, any]) => {
                  const percentage = (count / data.riskAnalysis.totalContracts) * 100;
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getRiskColor(level)}`} />
                          <span className="text-sm font-medium capitalize">{level} Risk</span>
                        </div>
                        <span className="text-sm font-bold">
                          {count} contracts ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getRiskColor(level)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </div>
  );
}
