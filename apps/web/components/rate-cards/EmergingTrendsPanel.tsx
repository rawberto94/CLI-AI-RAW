'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  Briefcase, 
  Users,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface EmergingTrend {
  type: 'RATE_SPIKE' | 'RATE_DROP' | 'NEW_MARKET' | 'HOT_ROLE' | 'SUPPLIER_ENTRY' | 'SUPPLIER_EXIT';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedRoles?: string[];
  affectedCountries?: string[];
  affectedSuppliers?: string[];
  changePercent?: number;
  detectedAt: Date;
  recommendation: string;
}

interface EmergingTrendsPanelProps {
  tenantId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function EmergingTrendsPanel({ 
  tenantId, 
  autoRefresh = false, 
  refreshInterval = 300000 // 5 minutes
}: EmergingTrendsPanelProps) {
  const [trends, setTrends] = useState<EmergingTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadTrends();

    if (autoRefresh) {
      const interval = setInterval(loadTrends, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rate-cards/market-intelligence/trends');
      const data = await response.json();
      setTrends(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading emerging trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (type: EmergingTrend['type']) => {
    switch (type) {
      case 'RATE_SPIKE':
        return <TrendingUp className="h-5 w-5 text-red-500" />;
      case 'RATE_DROP':
        return <TrendingDown className="h-5 w-5 text-green-500" />;
      case 'NEW_MARKET':
        return <Globe className="h-5 w-5 text-blue-500" />;
      case 'HOT_ROLE':
        return <Briefcase className="h-5 w-5 text-orange-500" />;
      case 'SUPPLIER_ENTRY':
        return <Users className="h-5 w-5 text-green-500" />;
      case 'SUPPLIER_EXIT':
        return <Users className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getSeverityColor = (severity: EmergingTrend['severity']) => {
    switch (severity) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getTrendTypeLabel = (type: EmergingTrend['type']) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const groupTrendsBySeverity = () => {
    const grouped = {
      HIGH: trends.filter(t => t.severity === 'HIGH'),
      MEDIUM: trends.filter(t => t.severity === 'MEDIUM'),
      LOW: trends.filter(t => t.severity === 'LOW'),
    };
    return grouped;
  };

  const groupedTrends = groupTrendsBySeverity();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Emerging Trends</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={loadTrends} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{groupedTrends.HIGH.length}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Medium Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{groupedTrends.MEDIUM.length}</div>
            <p className="text-xs text-muted-foreground">Monitor closely</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              Low Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{groupedTrends.LOW.length}</div>
            <p className="text-xs text-muted-foreground">For awareness</p>
          </CardContent>
        </Card>
      </div>

      {/* Trends List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading emerging trends...</p>
          </CardContent>
        </Card>
      ) : trends.length > 0 ? (
        <div className="space-y-4">
          {/* High Priority Trends */}
          {groupedTrends.HIGH.length > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  High Priority Trends
                </CardTitle>
                <CardDescription>These trends require immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {groupedTrends.HIGH.map((trend, index) => (
                    <TrendCard key={index} trend={trend} getTrendIcon={getTrendIcon} getTrendTypeLabel={getTrendTypeLabel} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medium Priority Trends */}
          {groupedTrends.MEDIUM.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Medium Priority Trends
                </CardTitle>
                <CardDescription>Monitor these trends closely</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {groupedTrends.MEDIUM.map((trend, index) => (
                    <TrendCard key={index} trend={trend} getTrendIcon={getTrendIcon} getTrendTypeLabel={getTrendTypeLabel} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Low Priority Trends */}
          {groupedTrends.LOW.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-500" />
                  Low Priority Trends
                </CardTitle>
                <CardDescription>For awareness and future planning</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {groupedTrends.LOW.map((trend, index) => (
                    <TrendCard key={index} trend={trend} getTrendIcon={getTrendIcon} getTrendTypeLabel={getTrendTypeLabel} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No emerging trends detected</p>
            <p className="text-sm text-muted-foreground mt-2">
              The system continuously monitors for significant market changes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TrendCard({ 
  trend, 
  getTrendIcon, 
  getTrendTypeLabel 
}: { 
  trend: EmergingTrend; 
  getTrendIcon: (type: EmergingTrend['type']) => React.ReactElement;
  getTrendTypeLabel: (type: EmergingTrend['type']) => string;
}) {
  return (
    <div className="p-4 border rounded-lg bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getTrendIcon(trend.type)}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-semibold mb-1">{trend.title}</h4>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{getTrendTypeLabel(trend.type)}</Badge>
                <Badge variant={
                  trend.severity === 'HIGH' ? 'destructive' : 
                  trend.severity === 'MEDIUM' ? 'default' : 
                  'secondary'
                }>
                  {trend.severity}
                </Badge>
              </div>
            </div>
            {trend.changePercent !== undefined && (
              <div className={`text-right font-semibold ${
                trend.changePercent > 0 ? 'text-red-500' : 'text-green-500'
              }`}>
                {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{trend.description}</p>

          {/* Affected Items */}
          <div className="flex flex-wrap gap-2 text-xs">
            {trend.affectedRoles && trend.affectedRoles.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded">
                <Briefcase className="h-3 w-3" />
                <span>{trend.affectedRoles.join(', ')}</span>
              </div>
            )}
            {trend.affectedCountries && trend.affectedCountries.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded">
                <Globe className="h-3 w-3" />
                <span>{trend.affectedCountries.join(', ')}</span>
              </div>
            )}
            {trend.affectedSuppliers && trend.affectedSuppliers.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded">
                <Users className="h-3 w-3" />
                <span>{trend.affectedSuppliers.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="flex items-start gap-2 p-3 bg-primary/5 border-l-4 border-primary rounded">
            <ArrowRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Recommended Action</p>
              <p className="text-sm text-muted-foreground">{trend.recommendation}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
