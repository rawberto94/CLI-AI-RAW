/**
 * Real-Time Rate Monitoring Dashboard
 * Monitor rate changes and market movements in real-time
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity, RefreshCw, Bell, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface RateChange {
  id: string;
  supplierName: string;
  roleName: string;
  oldRate: number;
  newRate: number;
  currency: string;
  changePercent: number;
  timestamp: string;
  seniority: string;
}

interface RateMonitoringData {
  recentChanges: RateChange[];
  summary: {
    totalRates: number;
    increasedToday: number;
    decreasedToday: number;
    avgChangePercent: number;
  };
  alerts: Array<{
    id: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
    timestamp: string;
  }>;
}

export function RealTimeRateMonitoring() {
  const [data, setData] = useState<RateMonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchMonitoringData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/rate-cards/monitoring/real-time');
      if (!response.ok) throw new Error('Failed to fetch monitoring data');

      const result = await response.json();
      setData(result.data || result);
    } catch {
      toast.error('Failed to load monitoring data');

      // Fallback data for development
      setData({
        recentChanges: [
          {
            id: '1',
            supplierName: 'Acme Consulting',
            roleName: 'Senior Developer',
            oldRate: 850,
            newRate: 900,
            currency: 'USD',
            changePercent: 5.88,
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            seniority: 'SENIOR',
          },
          {
            id: '2',
            supplierName: 'Tech Solutions Inc',
            roleName: 'Principal Architect',
            oldRate: 1200,
            newRate: 1150,
            currency: 'USD',
            changePercent: -4.17,
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            seniority: 'PRINCIPAL',
          },
          {
            id: '3',
            supplierName: 'Global IT Partners',
            roleName: 'Mid-Level Developer',
            oldRate: 600,
            newRate: 650,
            currency: 'USD',
            changePercent: 8.33,
            timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            seniority: 'MID',
          },
        ],
        summary: {
          totalRates: 1250,
          increasedToday: 45,
          decreasedToday: 12,
          avgChangePercent: 3.2,
        },
        alerts: [
          {
            id: '1',
            message: 'Senior Developer rates increased by 8% across 5 suppliers',
            severity: 'high',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: '2',
            message: 'Offshore rates showing unusual volatility',
            severity: 'medium',
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          },
        ],
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchMonitoringData]);

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 5) return 'text-red-600 bg-red-100';
    if (changePercent > 0) return 'text-green-600 bg-green-100';
    if (changePercent < -5) return 'text-violet-600 bg-violet-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-violet-100 text-violet-800 border-violet-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse h-24 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Real-Time Rate Monitoring
          </h2>
          <p className="text-muted-foreground mt-1">
            Live tracking of rate changes and market movements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Bell className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMonitoringData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.totalRates || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active rate cards</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Increased Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data?.summary.increasedToday || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rate increases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Decreased Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">
              {data?.summary.decreasedToday || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rate decreases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Change</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.summary.avgChangePercent ? `${data.summary.avgChangePercent.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average rate change</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-xs mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Changes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Rate Changes</CardTitle>
          <CardDescription>Latest updates to rate cards in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.recentChanges.map((change) => (
              <div
                key={change.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{change.roleName}</span>
                    <Badge variant="outline">{change.seniority}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{change.supplierName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(change.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground line-through">
                      {change.oldRate} {change.currency}
                    </p>
                    <p className="text-lg font-semibold">
                      {change.newRate} {change.currency}
                    </p>
                  </div>

                  <div
                    className={`flex items-center gap-1 px-3 py-1 rounded-full ${getChangeColor(change.changePercent)}`}
                  >
                    {change.changePercent > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="font-semibold">
                      {change.changePercent > 0 ? '+' : ''}
                      {change.changePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data?.recentChanges.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recent rate changes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link href="/rate-cards/alerts">
            <Button variant="outline">
              <Bell className="h-4 w-4 mr-2" />
              Manage Alerts
            </Button>
          </Link>
          <Link href="/rate-cards">
            <Button variant="outline">View All Rate Cards</Button>
          </Link>
          <Button variant="outline" onClick={() => toast.success('Report generation not yet implemented')}>
            Generate Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
