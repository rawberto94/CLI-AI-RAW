"use client";

/**
 * AI Analytics Dashboard
 * 
 * Displays metrics about AI usage including token consumption,
 * latency, accuracy, cost tracking, and model performance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Clock,
  MessageSquare,
  FileText,
  Brain,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// Types
interface TokenUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

interface ModelMetrics {
  model: string;
  requests: number;
  avgLatency: number;
  successRate: number;
  avgTokens: number;
  cost: number;
}

interface EndpointMetrics {
  endpoint: string;
  calls: number;
  avgLatency: number;
  errorRate: number;
}

interface AIMetrics {
  period: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  tokenUsageByDay: TokenUsage[];
  modelBreakdown: ModelMetrics[];
  endpointBreakdown?: EndpointMetrics[];
  topFeatures: Array<{ feature: string; usage: number }>;
  errors?: Array<{ type: string; count: number; lastOccurred: string }>;
  errorBreakdown?: Array<{ type: string; count: number; lastOccurred?: string }>;
}

// Color palette
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Mock data generator (in production, this would come from your analytics API)
function generateMockMetrics(period: string): AIMetrics {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  
  const tokenUsageByDay: TokenUsage[] = [];
  let totalTokens = 0;
  let totalCost = 0;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const inputTokens = Math.floor(Math.random() * 50000) + 10000;
    const outputTokens = Math.floor(Math.random() * 20000) + 5000;
    const dayTotal = inputTokens + outputTokens;
    const dayCost = (inputTokens * 0.00001) + (outputTokens * 0.00003);
    
    totalTokens += dayTotal;
    totalCost += dayCost;
    
    tokenUsageByDay.push({
      date: date.toISOString().split('T')[0],
      inputTokens,
      outputTokens,
      totalTokens: dayTotal,
      cost: parseFloat(dayCost.toFixed(4)),
    });
  }

  return {
    period,
    totalRequests: Math.floor(Math.random() * 5000) + 1000,
    totalTokens,
    totalCost: parseFloat(totalCost.toFixed(2)),
    avgLatency: Math.floor(Math.random() * 500) + 200,
    successRate: 95 + Math.random() * 4,
    tokenUsageByDay,
    modelBreakdown: [
      {
        model: 'gpt-4o-mini',
        requests: Math.floor(Math.random() * 3000) + 500,
        avgLatency: 280,
        successRate: 98.5,
        avgTokens: 450,
        cost: totalCost * 0.3,
      },
      {
        model: 'gpt-4o',
        requests: Math.floor(Math.random() * 1000) + 100,
        avgLatency: 620,
        successRate: 97.8,
        avgTokens: 820,
        cost: totalCost * 0.6,
      },
      {
        model: 'text-embedding-3-small',
        requests: Math.floor(Math.random() * 2000) + 200,
        avgLatency: 85,
        successRate: 99.9,
        avgTokens: 280,
        cost: totalCost * 0.05,
      },
      {
        model: 'mistral-large',
        requests: Math.floor(Math.random() * 500) + 50,
        avgLatency: 380,
        successRate: 96.2,
        avgTokens: 520,
        cost: totalCost * 0.05,
      },
    ],
    endpointBreakdown: [
      { endpoint: '/api/ai/chat', calls: 2500, avgLatency: 320, errorRate: 1.2 },
      { endpoint: '/api/ai/analyze', calls: 1200, avgLatency: 580, errorRate: 2.1 },
      { endpoint: '/api/ai/compare', calls: 450, avgLatency: 720, errorRate: 3.5 },
      { endpoint: '/api/ai/embeddings', calls: 1800, avgLatency: 95, errorRate: 0.3 },
      { endpoint: '/api/rag/search', calls: 980, avgLatency: 145, errorRate: 0.8 },
    ],
    topFeatures: [
      { feature: 'Contract Chat', usage: 3200 },
      { feature: 'Document Analysis', usage: 1800 },
      { feature: 'Risk Assessment', usage: 1200 },
      { feature: 'Semantic Search', usage: 980 },
      { feature: 'Comparison', usage: 450 },
    ],
    errors: [
      { type: 'Rate Limit', count: 12, lastOccurred: new Date().toISOString() },
      { type: 'Timeout', count: 8, lastOccurred: new Date(Date.now() - 86400000).toISOString() },
      { type: 'Invalid Input', count: 45, lastOccurred: new Date().toISOString() },
      { type: 'Model Error', count: 3, lastOccurred: new Date(Date.now() - 172800000).toISOString() },
    ],
  };
}

// Stat Card Component
function StatCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  format = 'number',
}: {
  title: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  format?: 'number' | 'currency' | 'percent' | 'ms';
}) {
  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return `$${v.toFixed(2)}`;
      case 'percent':
        return `${v.toFixed(1)}%`;
      case 'ms':
        return `${v}ms`;
      default:
        return v.toLocaleString();
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{formatValue(value)}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend === 'up' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{change > 0 ? '+' : ''}{change}%</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <Icon className="w-6 h-6 text-blue-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIAnalyticsDashboard() {
  const [period, setPeriod] = useState('7d');
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load metrics from API
  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch from analytics API
      const response = await fetch(`/api/ai/analytics?period=${period}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // Transform API response to AIMetrics format
        setMetrics({
          period,
          totalRequests: data.data.requests || 0,
          totalTokens: data.data.tokens || 0,
          totalCost: data.data.cost || 0,
          avgLatency: data.data.avgLatency || 0,
          successRate: data.data.successRate || 100,
          tokenUsageByDay: data.data.tokenUsageByDay || [],
          modelBreakdown: data.data.modelBreakdown || [],
          topFeatures: data.data.topFeatures || [],
          errorBreakdown: data.data.errorBreakdown || [],
        });
      } else {
        // No data available - show empty state
        setMetrics({
          period,
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          avgLatency: 0,
          successRate: 100,
          tokenUsageByDay: [],
          modelBreakdown: [],
          topFeatures: [],
          errorBreakdown: [],
        });
      }
    } catch (err) {
      console.error('Failed to load AI analytics:', err);
      setError('Failed to load analytics data');
      // Empty state on error
      setMetrics({
        period,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        avgLatency: 0,
        successRate: 100,
        tokenUsageByDay: [],
        modelBreakdown: [],
        topFeatures: [],
        errorBreakdown: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Export data
  const exportData = useCallback(() => {
    if (!metrics) return;
    
    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-analytics-${period}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metrics, period]);

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI Analytics Dashboard</h2>
          <p className="text-slate-600 mt-1">
            Monitor AI usage, costs, and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={loadMetrics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={metrics.totalRequests}
          change={12}
          trend="up"
          icon={MessageSquare}
        />
        <StatCard
          title="Total Tokens"
          value={metrics.totalTokens}
          change={8}
          trend="up"
          icon={Zap}
        />
        <StatCard
          title="Total Cost"
          value={metrics.totalCost}
          change={-5}
          trend="down"
          icon={DollarSign}
          format="currency"
        />
        <StatCard
          title="Avg Latency"
          value={metrics.avgLatency}
          change={-3}
          trend="down"
          icon={Clock}
          format="ms"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Token Usage Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics.tokenUsageByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString()}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Area
                  type="monotone"
                  dataKey="inputTokens"
                  stackId="1"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.6}
                  name="Input Tokens"
                />
                <Area
                  type="monotone"
                  dataKey="outputTokens"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.6}
                  name="Output Tokens"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.tokenUsageByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Model & Endpoint Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Model Usage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.modelBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="model" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="requests" fill="#3B82F6" name="Requests" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="mt-4 space-y-2">
              {metrics.modelBreakdown.map((model, i) => (
                <div key={model.model} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span>{model.model}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500">
                    <span>{model.avgLatency}ms</span>
                    <span>{model.successRate.toFixed(1)}%</span>
                    <span>${model.cost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Feature Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Top AI Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metrics.topFeatures}
                    dataKey="usage"
                    nameKey="feature"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {metrics.topFeatures.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 space-y-2">
              {metrics.topFeatures.map((feature, i) => (
                <div key={feature.feature} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span>{feature.feature}</span>
                  </div>
                  <span className="text-slate-500">{feature.usage.toLocaleString()} calls</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Endpoint Performance & Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoint Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.endpointBreakdown.map((endpoint) => (
                <div key={endpoint.endpoint} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                      {endpoint.endpoint}
                    </code>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">{endpoint.calls} calls</span>
                      <span className="text-blue-600">{endpoint.avgLatency}ms</span>
                      <Badge variant={endpoint.errorRate < 2 ? 'secondary' : 'destructive'}>
                        {endpoint.errorRate}% errors
                      </Badge>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(endpoint.calls / 3000) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.errors.map((error) => (
                <div
                  key={error.type}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{error.type}</p>
                    <p className="text-sm text-slate-500">
                      Last: {new Date(error.lastOccurred).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={error.count > 20 ? 'destructive' : 'secondary'}>
                    {error.count} occurrences
                  </Badge>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-700">
                  Success Rate: {metrics.successRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AIAnalyticsDashboard;
