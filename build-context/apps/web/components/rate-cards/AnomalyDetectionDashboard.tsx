/**
 * Anomaly Detection Dashboard
 * Detects and displays unusual rate patterns and outliers
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Anomaly {
  id: string;
  type: 'price_spike' | 'price_drop' | 'outlier' | 'unusual_pattern';
  severity: 'high' | 'medium' | 'low';
  supplierName: string;
  roleName: string;
  currentRate: number;
  expectedRate: number;
  deviation: number;
  currency: string;
  detectedAt: string;
  status: 'new' | 'acknowledged' | 'resolved' | 'false_positive';
  description: string;
}

interface AnomalyStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  falsePositives: number;
}

export function AnomalyDetectionDashboard() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'acknowledged'>('all');

  const fetchAnomalies = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/rate-cards/anomalies');
      if (!response.ok) throw new Error('Failed to fetch anomalies');

      const result = await response.json();
      setAnomalies(result.anomalies || []);
      setStats(result.stats || null);
    } catch {
      toast.error('Failed to load anomaly data');

      // Fallback data
      const fallbackAnomalies: Anomaly[] = [
        {
          id: '1',
          type: 'price_spike',
          severity: 'high',
          supplierName: 'Acme Consulting',
          roleName: 'Senior Developer',
          currentRate: 1200,
          expectedRate: 850,
          deviation: 41.2,
          currency: 'USD',
          detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'new',
          description: 'Rate increased by 41% above historical average',
        },
        {
          id: '2',
          type: 'outlier',
          severity: 'high',
          supplierName: 'Tech Solutions Inc',
          roleName: 'Junior Developer',
          currentRate: 800,
          expectedRate: 450,
          deviation: 77.8,
          currency: 'USD',
          detectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          status: 'new',
          description: 'Rate significantly above market average for this seniority level',
        },
        {
          id: '3',
          type: 'price_drop',
          severity: 'medium',
          supplierName: 'Global IT Partners',
          roleName: 'Principal Architect',
          currentRate: 900,
          expectedRate: 1250,
          deviation: -28.0,
          currency: 'USD',
          detectedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          status: 'acknowledged',
          description: 'Unusual rate decrease detected - potential data entry error',
        },
        {
          id: '4',
          type: 'unusual_pattern',
          severity: 'low',
          supplierName: 'DevOps Experts',
          roleName: 'DevOps Engineer',
          currentRate: 750,
          expectedRate: 700,
          deviation: 7.1,
          currency: 'USD',
          detectedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          status: 'new',
          description: 'Multiple small rate adjustments in short timeframe',
        },
      ];

      setAnomalies(fallbackAnomalies);
      setStats({
        total: fallbackAnomalies.length,
        high: fallbackAnomalies.filter((a) => a.severity === 'high').length,
        medium: fallbackAnomalies.filter((a) => a.severity === 'medium').length,
        low: fallbackAnomalies.filter((a) => a.severity === 'low').length,
        resolved: 0,
        falsePositives: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const handleStatusUpdate = async (anomalyId: string, newStatus: Anomaly['status']) => {
    try {
      const response = await fetch(`/api/rate-cards/anomalies/${anomalyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update anomaly status');

      setAnomalies((prev) =>
        prev.map((a) => (a.id === anomalyId ? { ...a, status: newStatus } : a))
      );
      toast.success('Anomaly status updated');
      fetchAnomalies(); // Refresh stats
    } catch {
      toast.error('Failed to update status');
    }
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

  const getTypeIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'price_spike':
        return <TrendingUp className="h-5 w-5 text-red-600" />;
      case 'price_drop':
        return <TrendingDown className="h-5 w-5 text-violet-600" />;
      case 'outlier':
        return <Target className="h-5 w-5 text-amber-600" />;
      case 'unusual_pattern':
        return <AlertTriangle className="h-5 w-5 text-violet-600" />;
    }
  };

  const filteredAnomalies =
    filter === 'all'
      ? anomalies
      : anomalies.filter((a) => a.status === filter);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse h-64 bg-gray-200 rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Anomaly Detection
          </h2>
          <p className="text-muted-foreground mt-1">
            Automatically detect unusual rate patterns and outliers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAnomalies}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.high || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.medium || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">{stats?.low || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">False Positives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600 dark:text-slate-400">
              {stats?.falsePositives || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detected Anomalies</CardTitle>
              <CardDescription>Review and manage detected rate anomalies</CardDescription>
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="new">New</TabsTrigger>
                <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAnomalies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No anomalies detected</p>
              </div>
            ) : (
              filteredAnomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`border rounded-lg p-4 ${getSeverityColor(anomaly.severity)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {getTypeIcon(anomaly.type)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{anomaly.roleName}</h4>
                          <Badge variant="outline" className="text-xs">
                            {anomaly.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {anomaly.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{anomaly.supplierName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {anomaly.status === 'new' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(anomaly.id, 'acknowledged')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(anomaly.id, 'false_positive')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            False Positive
                          </Button>
                        </>
                      )}
                      {anomaly.status === 'acknowledged' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleStatusUpdate(anomaly.id, 'resolved')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm mb-3">{anomaly.description}</p>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current Rate</p>
                      <p className="font-semibold">
                        {anomaly.currentRate} {anomaly.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected Rate</p>
                      <p className="font-semibold">
                        {anomaly.expectedRate} {anomaly.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deviation</p>
                      <p className="font-semibold">
                        {anomaly.deviation > 0 ? '+' : ''}
                        {anomaly.deviation.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Detected</p>
                      <p className="font-semibold">
                        {new Date(anomaly.detectedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
