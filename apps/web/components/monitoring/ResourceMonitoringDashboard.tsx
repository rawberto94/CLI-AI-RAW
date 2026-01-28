'use client';

/**
 * Resource Monitoring Dashboard
 * Displays real-time resource metrics (memory, CPU, connections)
 */

import React, { useState, useEffect } from 'react';

interface ResourceMetrics {
  timestamp: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    heapUtilization: string;
    cacheSize: number;
    cacheEntries: number;
    cacheUtilization: string;
    formatted: {
      heapUsed: string;
      heapTotal: string;
      cacheSize: string;
    };
  };
  cpu: {
    usage: string;
    loadAverage: string[];
    cores: number;
    model: string;
    speed: string;
  };
  connections: {
    total: number;
    active: number;
    queued: number;
    byState: Record<string, number>;
  };
  system: {
    platform: string;
    uptime: string;
    memoryUtilization: string;
    hostname: string;
    formatted: {
      freeMemory: string;
      totalMemory: string;
    };
  };
}

interface MetricsSummary {
  duration: number;
  durationFormatted: string;
  summary: {
    memory: { avg: string; min: string; max: string };
    cpu: { avg: string; min: string; max: string };
    connections: { avg: number; min: number; max: number };
  };
}

export default function ResourceMonitoringDashboard() {
  const [metrics, setMetrics] = useState<ResourceMetrics | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchSummary();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/resources?action=current');
      const result = await response.json();

      if (result.success) {
        setMetrics(result.data);
        setError(null);
      } else {
        setError('Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/monitoring/resources?action=summary&duration=3600000');
      const result = await response.json();

      if (result.success) {
        setSummary(result.data);
      }
    } catch {
      // Error handled silently
    }
  };

  const getStatusColor = (value: string): string => {
    const numValue = parseFloat(value);
    if (numValue >= 90) return 'text-red-600';
    if (numValue >= 80) return 'text-orange-600';
    if (numValue >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (value: string): string => {
    const numValue = parseFloat(value);
    if (numValue >= 90) return 'bg-red-500';
    if (numValue >= 80) return 'bg-orange-500';
    if (numValue >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Resource Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded ${
              autoRefresh
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-violet-900 mb-3">
            Last Hour Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-violet-700 font-medium">Memory</p>
              <p className="text-xs text-violet-600">
                Avg: {summary.summary.memory.avg} | Min: {summary.summary.memory.min} | Max: {summary.summary.memory.max}
              </p>
            </div>
            <div>
              <p className="text-sm text-violet-700 font-medium">CPU</p>
              <p className="text-xs text-violet-600">
                Avg: {summary.summary.cpu.avg} | Min: {summary.summary.cpu.min} | Max: {summary.summary.cpu.max}
              </p>
            </div>
            <div>
              <p className="text-sm text-violet-700 font-medium">Connections</p>
              <p className="text-xs text-violet-600">
                Avg: {summary.summary.connections.avg} | Min: {summary.summary.connections.min} | Max: {summary.summary.connections.max}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Memory Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Memory</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-slate-400">Heap Utilization</span>
                <span className={`text-sm font-semibold ${getStatusColor(metrics.memory.heapUtilization)}`}>
                  {metrics.memory.heapUtilization}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(metrics.memory.heapUtilization)}`}
                  style={{ width: metrics.memory.heapUtilization }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {metrics.memory.formatted.heapUsed} / {metrics.memory.formatted.heapTotal}
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-slate-400">Cache Utilization</span>
                <span className={`text-sm font-semibold ${getStatusColor(metrics.memory.cacheUtilization)}`}>
                  {metrics.memory.cacheUtilization}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(metrics.memory.cacheUtilization)}`}
                  style={{ width: metrics.memory.cacheUtilization }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {metrics.memory.formatted.cacheSize} | {metrics.memory.cacheEntries} entries
              </p>
            </div>
          </div>
        </div>

        {/* CPU Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">CPU</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-600 dark:text-slate-400">Usage</span>
                <span className={`text-sm font-semibold ${getStatusColor(metrics.cpu.usage)}`}>
                  {metrics.cpu.usage}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(metrics.cpu.usage)}`}
                  style={{ width: metrics.cpu.usage }}
                ></div>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Cores:</span>
                <span className="font-medium">{metrics.cpu.cores}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Speed:</span>
                <span className="font-medium">{metrics.cpu.speed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Load Avg:</span>
                <span className="font-medium">{metrics.cpu.loadAverage.join(', ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connections Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Connections</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-violet-600">{metrics.connections.total}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{metrics.connections.active}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400">Active</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{metrics.connections.queued}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400">Queued</p>
              </div>
            </div>

            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-700 dark:text-slate-300 mb-2">By State:</p>
              {Object.entries(metrics.connections.byState).map(([state, count]) => (
                <div key={state} className="flex justify-between">
                  <span className="text-gray-600 dark:text-slate-400 capitalize">{state}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">System Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-slate-400">Platform</p>
            <p className="font-medium">{metrics.system.platform}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-slate-400">Hostname</p>
            <p className="font-medium">{metrics.system.hostname}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-slate-400">Uptime</p>
            <p className="font-medium">{metrics.system.uptime}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-slate-400">System Memory</p>
            <p className="font-medium">
              {metrics.system.formatted.freeMemory} / {metrics.system.formatted.totalMemory}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">({metrics.system.memoryUtilization} used)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
