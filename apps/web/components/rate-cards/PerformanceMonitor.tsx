'use client';

/**
 * Performance Monitor Component
 * Displays system performance metrics and optimization controls
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Zap, TrendingUp, AlertCircle } from 'lucide-react';

interface PerformanceMetrics {
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  indexes: Array<{
    table: string;
    index: string;
    scans: number;
    tuplesRead: number;
    tuplesFetched: number;
  }>;
  connectionPool: {
    poolSize: number;
    activeConnections: number;
    recommendations: string[];
  };
  database: Array<{
    table: string;
    rowCount: number;
    totalSize: string;
    indexSize: string;
  }>;
  indexSuggestions: string[];
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rate-cards/performance');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch {
      // Failed to fetch performance metrics
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const executeAction = async (action: string) => {
    try {
      setActionLoading(action);
      const response = await fetch('/api/rate-cards/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        await fetchMetrics();
      }
    } catch {
      // Failed to execute action
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitor</h2>
          <p className="text-sm text-gray-600">System performance metrics and optimization</p>
        </div>
        <Button onClick={fetchMetrics} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Cache Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Cache Performance
          </CardTitle>
          <CardDescription>Redis cache hit rate and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold">{metrics.cache.hitRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Hit Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.cache.hits.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Cache Hits</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.cache.misses.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Cache Misses</div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => executeAction('invalidate_cache')}
              variant="outline"
              size="sm"
              disabled={actionLoading === 'invalidate_cache'}
            >
              {actionLoading === 'invalidate_cache' ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Clear Cache
            </Button>
            <Button
              onClick={() => executeAction('preload_data')}
              variant="outline"
              size="sm"
              disabled={actionLoading === 'preload_data'}
            >
              {actionLoading === 'preload_data' ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Preload Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription>Table sizes and row counts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.database.map((table) => (
              <div key={table.table} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{table.table}</div>
                  <div className="text-sm text-gray-600">
                    {table.rowCount.toLocaleString()} rows
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{table.totalSize}</div>
                  <div className="text-xs text-gray-600">
                    {table.indexSize} indexes
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connection Pool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Connection Pool
          </CardTitle>
          <CardDescription>Database connection pool status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold">{metrics.connectionPool.poolSize}</div>
              <div className="text-sm text-gray-600">Pool Size</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.connectionPool.activeConnections}</div>
              <div className="text-sm text-gray-600">Active Connections</div>
            </div>
          </div>

          {metrics.connectionPool.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Recommendations:</div>
              {metrics.connectionPool.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {rec}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Index Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Index Usage Statistics</CardTitle>
          <CardDescription>Most frequently used indexes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.indexes.slice(0, 10).map((index) => (
              <div key={index.index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="text-sm font-medium">{index.index}</div>
                  <div className="text-xs text-gray-600">{index.table}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{index.scans.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">scans</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optimization Suggestions */}
      {metrics.indexSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Optimization Suggestions
            </CardTitle>
            <CardDescription>Recommended database optimizations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.indexSuggestions.slice(0, 5).map((suggestion, idx) => (
                <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <code className="text-xs">{suggestion}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Actions</CardTitle>
          <CardDescription>Database maintenance and optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              onClick={() => executeAction('refresh_materialized_views')}
              variant="outline"
              disabled={actionLoading === 'refresh_materialized_views'}
            >
              {actionLoading === 'refresh_materialized_views' ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Refresh Materialized Views
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
